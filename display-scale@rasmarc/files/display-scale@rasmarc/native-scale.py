#!/usr/bin/env python3
"""Use Cinnamon DisplayConfig stages plus a text remainder.

Monitor changes are verified and temporary. No xrandr command is executed.
This subprocess coordinates display, text, recovery state and read-back.
"""
import argparse
from contextlib import contextmanager
import copy
import fcntl
import hashlib
import json
import math
import os
import runpy
from pathlib import Path
import sys
import tempfile
import time

_ = runpy.run_path(str(Path(__file__).with_name("i18n.py")),
    run_name="display_scale_i18n")["_"]

NAME = 'org.cinnamon.Muffin.DisplayConfig'
OBJECT = '/org/cinnamon/Muffin/DisplayConfig'
TEXT_KEY = 'text-scaling-factor'
EPS = .00001


def near(a, b):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a-b) < EPS


def session_token():
    try:
        boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    except OSError:
        boot = ''
    session = os.environ.get('XDG_SESSION_ID', '')
    if not session:
        try:
            session = str(Path(os.environ.get('XAUTHORITY', str(Path.home()/'.Xauthority'))).stat().st_mtime_ns)
        except OSError:
            session = os.environ.get('DBUS_SESSION_BUS_ADDRESS', '')
    return hashlib.sha256((boot+'|'+session+'|'+os.environ.get('DISPLAY', '')).encode()).hexdigest()


def parse_state(reply):
    serial, physical, logical, properties = reply
    monitors = {tuple(spec): (modes, props) for spec, modes, props in physical}
    configuration = []
    for x, y, scale, transform, primary, specs, _props in logical:
        entries = []
        for spec in specs:
            modes, props = monitors[tuple(spec)]
            current = [mode for mode in modes if mode[6].get('is-current', False)]
            if len(current) != 1:
                raise RuntimeError(_("The current monitor mode is ambiguous."))
            mode_id, width, height, refresh, _preferred, scales, _flags = current[0]
            entry = dict(spec=list(spec), mode=mode_id, width=width, height=height,
                         refresh=refresh, scales=list(scales))
            if 'is-underscanning' in props:
                entry['underscanning'] = bool(props['is-underscanning'])
            entries.append(entry)
        configuration.append(dict(x=x, y=y, scale=scale, transform=transform,
                                  primary=primary, monitors=entries))
    return dict(serial=serial, logical=configuration,
                layout_mode=properties.get('layout-mode', 1),
                can_change_layout=properties.get('supports-changing-layout-mode', False),
                ui_scale=properties.get('legacy-ui-scaling-factor', 1),
                fractional=properties.get('x11-fractional-scaling', False))


def single_monitor(state):
    if len(state['logical']) != 1 or len(state['logical'][0]['monitors']) != 1:
        raise RuntimeError(_("Screen scaling currently requires exactly one active monitor."))
    logical = state['logical'][0]
    if logical['x'] != 0 or logical['y'] != 0 or logical['transform'] != 0:
        raise RuntimeError(_("Screen scaling requires an unrotated monitor at the desktop origin."))
    return logical, logical['monitors'][0]


def signature(state):
    logical = copy.deepcopy(state['logical'])
    for item in logical:
        for monitor in item['monitors']:
            monitor.pop('scales', None)
    # Serial, supported-scale lists and derived UI scale may change while the
    # actual monitor configuration remains identical.
    return dict(logical=logical, layout_mode=state['layout_mode'])


def same_config(a, b):
    return signature(a) == signature(b)


def with_scale(state, scale):
    target = copy.deepcopy(state)
    single_monitor(target)[0]['scale'] = scale
    return target


def nominal_scale(scale):
    # Same positive-value rounding as Cinnamon's round_scale_for_ui().
    return math.floor(scale*4+.5)/4


def supported_steps(state):
    _logical, monitor = single_monitor(state)
    stages = {}
    for value in monitor['scales']:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            continue
        actual = float(value)
        nominal = nominal_scale(actual)
        if nominal not in (1, 1.25, 1.5, 1.75, 2):
            continue
        previous = stages.get(nominal)
        if previous is None or (abs(actual-nominal), actual) < (abs(previous-nominal), previous):
            stages[nominal] = actual
    return [stages[nominal] for nominal in sorted(stages)]


def plan(state, percent, mode, switch_point=100):
    if not isinstance(percent, (int, float)) or not math.isfinite(percent) or not 100 <= percent <= 200:
        raise RuntimeError(_("The scaling value must be between 100 and 200 percent."))
    if (isinstance(switch_point, bool) or not isinstance(switch_point, (int, float)) or
        not math.isfinite(switch_point) or switch_point not in (50, 75, 100, 125, 150)):
        raise RuntimeError(_("The switch point must be 50, 75, 100, 125 or 150."))
    try:
        steps = supported_steps(state)
    except RuntimeError:
        if mode == 'text':
            return dict(scale=None, text=percent/100, percent=percent, steps=[])
        raise
    if not steps or not any(near(step, 1) for step in steps):
        raise RuntimeError(_("Cinnamon does not offer a suitable scale for this monitor mode."))
    scale = steps[0]
    if mode != 'text':
        labels = [nominal_scale(step) for step in steps]
        for index, (lower, upper) in enumerate(zip(labels, labels[1:])):
            boundary = lower + (upper-lower)*switch_point/100
            # Early positions retain the lower stage on an exact tie.
            # At/after the nominal stage, reaching the boundary advances.
            # A delayed final boundary may lie above the selectable range.
            if percent/100 > boundary or (switch_point >= 100 and percent/100 >= boundary):
                scale = steps[index+1]
            else:
                break
    return dict(scale=scale, text=percent/100/scale, percent=percent, steps=steps)


class GioBackend:
    def __init__(self):
        from gi.repository import Gio, GLib
        self.Gio, self.GLib = Gio, GLib
        self.connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        self.settings = Gio.Settings.new('org.cinnamon.desktop.interface')
        self.timings = []

    def call(self, method, parameters=None):
        started = time.monotonic()
        try:
            return self.connection.call_sync(NAME, OBJECT, NAME, method, parameters, None,
                self.Gio.DBusCallFlags.NO_AUTO_START, 5000, None)
        finally:
            self.timings.append(dict(method=method, ms=round((time.monotonic()-started)*1000)))

    def query(self):
        return parse_state(self.call('GetCurrentState').unpack())

    def parameters(self, current, target, method):
        logical = []
        for item in target['logical']:
            monitors = []
            for monitor in item['monitors']:
                props = {}
                if 'underscanning' in monitor:
                    # Mint's actual implementation uses this spelling, while
                    # the XML comment still describes an older spelling.
                    props['underscanning'] = self.GLib.Variant('b', monitor['underscanning'])
                monitors.append((monitor['spec'][0], monitor['mode'], props))
            logical.append((item['x'], item['y'], item['scale'], item['transform'], item['primary'], monitors))
        props = {}
        if current['can_change_layout']:
            props['layout-mode'] = self.GLib.Variant('u', target['layout_mode'])
        elif current['layout_mode'] != target['layout_mode']:
            raise RuntimeError(_("The display mode has changed in the meantime."))
        return self.GLib.Variant('(uua(iiduba(ssa{sv}))a{sv})',
                                 (current['serial'], method, logical, props))

    def verify(self, current, target):
        self.call('ApplyMonitorsConfig', self.parameters(current, target, 0))

    def configure(self, current, target):
        self.verify(current, target)
        self.call('ApplyMonitorsConfig', self.parameters(current, target, 1))

    def text(self):
        return self.settings.get_double(TEXT_KEY)

    def writable(self):
        return self.settings.is_writable(TEXT_KEY)

    def set_text(self, value):
        if not near(self.text(), value):
            if not self.writable() or not self.settings.set_double(TEXT_KEY, value):
                raise RuntimeError(_("The font setting is not writable."))
            self.Gio.Settings.sync()
        if not near(self.text(), value):
            raise RuntimeError(_("The text scaling factor was not applied."))

    def settle_fonts(self):
        time.sleep(.15)  # In a subprocess; Cinnamon's event loop keeps running.


class StateFile:
    def __init__(self, path):
        self.path = Path(path)

    def read(self):
        try:
            data = json.loads(self.path.read_text())
            if (isinstance(data, dict) and data.get('version') == 1 and
                all(key in data for key in ('baseline', 'expected', 'baseline_text', 'text', 'session', 'mode')) and
                data['mode'] in ('text', 'screen') and
                isinstance(data['baseline'], dict) and isinstance(data['expected'], dict) and
                all('logical' in data[key] and 'layout_mode' in data[key] for key in ('baseline', 'expected')) and
                (not data.get('pending') or ('before' in data and 'before_text' in data))):
                return data
        except (OSError, ValueError, TypeError, AttributeError):
            pass
        return None

    def write(self, data):
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        descriptor, name = tempfile.mkstemp(prefix='native-', dir=self.path.parent)
        try:
            with os.fdopen(descriptor, 'w') as stream:
                json.dump(data, stream)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name, self.path)
        finally:
            if os.path.exists(name):
                os.unlink(name)

    def restore(self, data):
        if data is None:
            self.path.unlink(missing_ok=True)
        else:
            self.write(data)


class NativeScaler:
    def __init__(self, backend, state_file, session=None):
        self.backend, self.file = backend, state_file
        self.session = session if session is not None else session_token()

    def owned(self, data, current, text):
        return bool(data and not data.get('pending') and data.get('session') == self.session
                    and same_config(data['expected'], current) and near(data['text'], text))

    def response(self, current, mode=None, data=None):
        text = self.backend.text()
        try:
            logical, _monitor = single_monitor(current)
            scale, steps, ui_scale = logical['scale'], supported_steps(current), current['ui_scale']
            if not isinstance(ui_scale, (int, float)) or ui_scale <= 0:
                raise RuntimeError(_("Cinnamon reported an invalid UI scaling factor."))
            if mode is None:
                mode = data['mode'] if self.owned(data, current, text) else ('screen' if scale > 1 else 'text')
            return dict(available=True, ui_mode=mode == 'screen',
                        percent=scale*text*100 if mode == 'screen' else text*100,
                        screen_percent=scale*100, screen_stage_percent=nominal_scale(scale)*100,
                        output_percent=scale/ui_scale*100,
                        text_factor=text, native_ui_scale=ui_scale,
                        supported_percent=[nominal_scale(step)*100 for step in steps],
                        supported_scales=steps, temporary=True,
                        recovery_needed=bool(data and data.get('pending')))
        except RuntimeError as error:
            return dict(available=False, ui_mode=False, percent=text*100, text_factor=text,
                        screen_percent=100, output_percent=100, reason=str(error))

    def status(self):
        return self.response(self.backend.query(), data=self.file.read())

    def startup(self):
        current, text, data = self.backend.query(), self.backend.text(), self.file.read()
        if not data:
            return self.response(current)
        if data.get('pending'):
            if same_config(current, data['baseline']) and any(near(text, value) for value in
                    (data['before_text'], data['text'], 1)):
                self.backend.set_text(data['baseline_text'])
                self.file.restore(None)
                return self.response(current)
            return self.restore()
        if same_config(current, data['expected']) and near(text, data['text']):
            if data.get('session') != self.session:
                data['session'] = self.session
                self.file.write(data)
        elif data['mode'] == 'screen' and same_config(current, data['baseline']) and near(text, data['text']):
            # A restarted shell, new login or native display reset restored the
            # saved profile. Remove only our otherwise stranded text remainder.
            self.backend.set_text(data['baseline_text'])
            self.file.restore(None)
            return self.response(current, mode='text' if near(single_monitor(current)[0]['scale'], 1) else None)
        return self.response(current, data=data)

    def read_back(self, expected):
        current = self.backend.query()
        if not same_config(current, expected):
            raise RuntimeError(_("The requested Cinnamon scale was not applied, or the display configuration changed."))
        return current

    def rollback(self, before, before_text, attempted, target_text):
        current, text = self.backend.query(), self.backend.text()
        if not (same_config(current, before) or same_config(current, attempted)) or not any(near(text, n) for n in (before_text, target_text, 1)):
            raise RuntimeError(_("The display or font setting was changed outside the applet; it will not be overwritten automatically."))
        if not same_config(current, before):
            self.backend.configure(current, before)
            self.read_back(before)
        self.backend.set_text(before_text)

    def apply(self, percent, mode, switch_point=100):
        before, before_text, old = self.backend.query(), self.backend.text(), self.file.read()
        if old and old.get('pending'):
            raise RuntimeError(_("A previous change is incomplete. Run native-scale.py restore first."))
        requested = plan(before, percent, mode, switch_point)
        target = with_scale(before, requested['scale']) if requested['scale'] is not None else before
        target_text = requested['text']
        configure = not same_config(before, target)
        neutralize = configure and not near(before_text, 1)
        if (not near(before_text, target_text) or neutralize) and not self.backend.writable():
            raise RuntimeError(_("The font setting is not writable."))
        baseline = old['baseline'] if self.owned(old, before, before_text) else before
        baseline_text = old['baseline_text'] if self.owned(old, before, before_text) else before_text
        pending = dict(version=1, session=self.session, baseline=baseline, baseline_text=baseline_text,
                       expected=target, text=target_text, mode=mode, percent=percent,
                       switch_point=switch_point, pending=True, before=before, before_text=before_text)
        self.file.write(pending)  # Recovery must be writable before desktop changes.
        try:
            if configure:
                self.backend.verify(before, target)
                if not near(before_text, 1):
                    self.backend.set_text(1)
                    self.backend.settle_fonts()
                fresh = self.backend.query()
                if not same_config(fresh, before):
                    raise RuntimeError(_("The display configuration changed during the switch."))
                self.backend.configure(fresh, target)
                current = self.read_back(target)
            else:
                current = before
            self.backend.set_text(target_text)
            current = self.read_back(target)
            complete = dict(pending, expected=current, pending=False)
            complete.pop('before', None)
            complete.pop('before_text', None)
            self.file.write(complete)
        except Exception as error:
            try:
                self.rollback(before, before_text, target, target_text)
                self.file.restore(old)
            except Exception as recovery_error:
                raise RuntimeError(_('{error}\nReset failed: {recovery_error}').format(
                    error=error, recovery_error=recovery_error)) from error
            raise
        return self.response(current, mode=mode, data=complete)

    def restore(self):
        current, text, data = self.backend.query(), self.backend.text(), self.file.read()
        if not data:
            return self.response(current)
        if data.get('pending'):
            target, target_text = data['before'], data['before_text']
            self.rollback(target, target_text, data['expected'], data['text'])
        else:
            if not same_config(current, data['expected']) or not near(text, data['text']):
                raise RuntimeError(_("The display or font setting was changed outside the applet; it will not be overwritten."))
            target, target_text = data['baseline'], data['baseline_text']
            self.rollback(target, target_text, data['expected'], data['text'])
        self.file.restore(None)
        return self.response(self.backend.query())


@contextmanager
def mutation_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open('a') as stream:
        deadline = time.monotonic()+1
        while True:
            try:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise RuntimeError(_("A scaling change is already in progress."))
                time.sleep(.02)
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['status', 'startup', 'ui', 'text', 'restore'])
    parser.add_argument('percent', type=float, nargs='?')
    parser.add_argument('--switch-point', type=float, default=100)
    args = parser.parse_args()
    started, backend = time.monotonic(), None
    try:
        if os.environ.get('XDG_SESSION_TYPE') == 'wayland':
            raise RuntimeError(_("This applet requires an X11 session."))
        backend = GioBackend()
        cache = Path(os.environ.get('XDG_CACHE_HOME', str(Path.home()/'.cache')))/'display-scale@rasmarc'
        scaler = NativeScaler(backend, StateFile(cache/'native-state.json'))
        if args.action == 'status':
            result = scaler.status()
        else:
            with mutation_lock(cache/'native.lock'):
                if args.action in ('ui', 'text'):
                    if args.percent is None:
                        raise RuntimeError(_("The scaling value is missing."))
                    result = scaler.apply(args.percent, 'screen' if args.action == 'ui' else 'text', args.switch_point)
                else:
                    result = getattr(scaler, args.action)()
        if args.action != 'status':
            result['diagnostics'] = dict(total_ms=round((time.monotonic()-started)*1000), calls=backend.timings)
        print(json.dumps(result))
        return 0
    except Exception as error:
        print(json.dumps(dict(error=str(error), diagnostics=dict(total_ms=round((time.monotonic()-started)*1000),
              calls=backend.timings if backend else []))))
        return 1


if __name__ == '__main__':
    sys.exit(main())

