#!/usr/bin/python3
"""Coordinate Onboard and cache transactions without blocking Cinnamon.

Geometry stays in the applet's existing calculation module. This helper waits
for process exit, so Onboard's pending home-rectangle save is finished before
the applet writes its next target. No SIGKILL or process-name-wide kill is used.
"""
import json
import fcntl
import os
import runpy
from pathlib import Path
import signal
import subprocess
import sys
import time
import tempfile
from contextlib import contextmanager

_ = runpy.run_path(str(Path(__file__).with_name("i18n.py")),
    run_name="display_scale_i18n")["_"]

NAME = 'org.onboard.Onboard'
PATH = '/org/onboard/Onboard/Keyboard'
IFACE = NAME + '.Keyboard'
GEOMETRY_SCHEMAS = ('org.onboard.window.landscape', 'org.onboard.window.portrait')
RECT_KEYS = ('x', 'y', 'width', 'height')


def valid_rect(rect):
    return (isinstance(rect, dict) and all(type(rect.get(k)) is int and
            abs(rect[k]) < 2147483647 for k in RECT_KEYS) and
            rect['width'] > 0 and rect['height'] > 0)


def cache_directory():
    root = Path(os.environ.get('XDG_CACHE_HOME') or Path.home() / '.cache')
    if not root.is_absolute():
        root = Path.home() / '.cache'
    return root / 'display-scale@rasmarc'


def atomic_json(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.' + path.name + '-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
            json.dump(value, output, ensure_ascii=False)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


class GeometryStore:
    """One lease per controller; all disk/dconf waits happen outside Cinnamon.

    A new controller claims the lease under the same lock as geometry writes.
    Work submitted by a removed controller can therefore never write over the
    new controller, even when helper processes complete in a different order.
    """
    def __init__(self, session, directory=None):
        self.session = session
        self.directory = directory or cache_directory()
        self.checkpoint = self.directory / 'onboard-position.json'
        self.owner = self.directory / 'onboard-owner.json'

    @contextmanager
    def locked(self):
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor = os.open(self.directory / 'onboard-position.lock', os.O_CREAT | os.O_RDWR, 0o600)
        with os.fdopen(descriptor, 'w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            yield

    @staticmethod
    def read(path):
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except (FileNotFoundError, ValueError):
            return None

    def clear(self):
        self.checkpoint.unlink(missing_ok=True)

    @staticmethod
    def valid(record):
        return (isinstance(record, dict) and record.get('schemaId') in GEOMETRY_SCHEMAS and
                valid_rect(record.get('original')) and valid_rect(record.get('expected')) and
                all(record.get(key) is None or valid_rect(record[key]) for key in ('source', 'stored')))

    def known(self, record):
        current = self.session.geometry(record['schemaId'])
        return any(current == record.get(key) for key in ('original', 'expected', 'source', 'stored'))

    def restore(self, record, request):
        if not self.valid(record) or not self.session.has_geometry(record['schemaId']):
            return
        if not record.get('source') and not self.known(record):
            self.clear()
            return
        restart = None
        try:
            if record.get('source'):
                # A pending five-second HOME save must be flushed before the
                # final restoration. Do this once, without a Cinnamon timer.
                response = stop(self.session, {key: request.get(key) for key in ('owner', 'pid')})
                restart = response.get('restart')
                if response.get('error'):
                    raise RuntimeError(response['error'])
            if self.known(record):
                self.session.apply_geometry(record['schemaId'], record['original'])
            self.clear()
        finally:
            if restart and restart.get('stopped'):
                start(self.session, restart)

    def run(self, action, request):
        token = request.get('token')
        if not isinstance(token, str) or not token:
            raise RuntimeError(_("Onboard's restart data is invalid."))
        with self.locked():
            if action == 'claim':
                lease = self.read(self.owner)
                boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
                created = request.get('created', 0)
                if (isinstance(lease, dict) and lease.get('boot') == boot and
                        lease.get('created', 0) > created):
                    return {'owned': False}
                previous = self.read(self.checkpoint)
                if self.valid(previous):
                    self.restore(previous, {})
                atomic_json(self.owner, {'token': token, 'created': created, 'boot': boot, 'active': True})
                return {'owned': True}
            lease = self.read(self.owner)
            if not isinstance(lease, dict) or lease.get('token') != token or not lease.get('active'):
                return {'owned': False, 'applied': False}
            if action == 'release':
                atomic_json(self.owner, {**lease, 'active': False})
            elif action == 'clear':
                self.clear()
            elif action == 'restore':
                self.restore(request.get('record'), request)
            elif action == 'apply':
                record = request.get('record')
                if not self.valid(record):
                    raise RuntimeError(_("Invalid Onboard geometry."))
                if not self.known({**record, 'expected': request.get('previous')}):
                    self.clear()
                    return {'owned': True, 'applied': False}
                if self.session.geometry(record['schemaId']) != record['expected']:
                    # Checkpoint must be durable BEFORE changing any geometry.
                    atomic_json(self.checkpoint, record)
                    self.session.apply_geometry(record['schemaId'], record['expected'])
                return {'owned': True, 'applied': True}
            else:
                raise RuntimeError(_("Unknown Onboard action."))
            return {'owned': True}


class Session:
    def __init__(self):
        from gi.repository import Gio, GLib
        self.Gio, self.GLib = Gio, GLib
        self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)

    def call(self, destination, path, interface, method, parameters=None):
        return self.bus.call_sync(destination, path, interface, method, parameters,
                                  None, self.Gio.DBusCallFlags.NONE, 2000, None).unpack()

    def owner(self):
        try:
            return self.call('org.freedesktop.DBus', '/org/freedesktop/DBus',
                             'org.freedesktop.DBus', 'GetNameOwner',
                             self.GLib.Variant('(s)', (NAME,)))[0]
        except self.GLib.Error as error:
            if 'NameHasNoOwner' in str(error) or 'ServiceUnknown' in str(error):
                return None
            raise

    def pid(self, owner):
        return self.call('org.freedesktop.DBus', '/org/freedesktop/DBus',
                         'org.freedesktop.DBus', 'GetConnectionUnixProcessID',
                         self.GLib.Variant('(s)', (owner,)))[0]

    def visible(self, owner):
        try:
            return bool(self.call(owner, PATH, 'org.freedesktop.DBus.Properties',
                                  'Get', self.GLib.Variant('(ss)', (IFACE, 'Visible')))[0])
        except self.GLib.Error:
            return None

    def restore_visibility(self, owner, visible):
        if isinstance(visible, bool):
            self.call(owner, PATH, IFACE, 'Show' if visible else 'Hide')

    def geometry(self, schema):
        if schema not in GEOMETRY_SCHEMAS:
            raise RuntimeError(_("Unknown Onboard geometry section."))
        # Create this reader only AFTER the old process has exited. Its view
        # must include the home rectangle saved by Onboard's cleanup.
        settings = self.Gio.Settings.new(schema)
        return {key: settings.get_int(key) for key in ('x', 'y', 'width', 'height')}

    def has_geometry(self, schema):
        source = self.Gio.SettingsSchemaSource.get_default()
        return bool(source and source.lookup(schema, True))

    def apply_geometry(self, schema, rect):
        if schema not in GEOMETRY_SCHEMAS or not valid_rect(rect):
            raise RuntimeError(_("Invalid Onboard geometry."))
        settings = self.Gio.Settings.new(schema)
        if not all(settings.is_writable(key) for key in RECT_KEYS):
            raise RuntimeError(_("Onboard's geometry settings are read-only."))
        settings.delay()
        try:
            for key in RECT_KEYS:
                if not settings.set_int(key, rect[key]):
                    raise RuntimeError(_("Onboard's geometry could not be applied."))
            settings.apply()
            self.Gio.Settings.sync()
        except Exception:
            settings.revert()
            raise


def process_status(pid):
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 1:
        return None
    directory = Path('/proc') / str(pid)
    try:
        fields = (directory / 'stat').read_text().rpartition(')')[2].split()
        return dict(uid=directory.stat().st_uid, state=fields[0], start=fields[19])
    except (FileNotFoundError, ProcessLookupError):
        return None


def capture(pid, visible):
    status = process_status(pid)
    if not status or status['state'] in ('Z', 'X'):
        return None
    if status['uid'] != os.getuid():
        raise RuntimeError(_("Onboard does not belong to the current user session."))
    directory = Path('/proc') / str(pid)
    try:
        argv = [os.fsdecode(value) for value in (directory / 'cmdline').read_bytes().split(b'\0') if value]
    except (FileNotFoundError, ProcessLookupError):
        return None
    try:
        cwd = os.readlink(directory / 'cwd')
    except (FileNotFoundError, PermissionError):
        cwd = None
    direct = argv and Path(argv[0]).name == 'onboard'
    interpreted = len(argv) > 1 and Path(argv[0]).name.startswith('python') and Path(argv[1]).name == 'onboard'
    if not (direct or interpreted):
        raise RuntimeError(_("The identified process is not an Onboard keyboard."))
    if interpreted and not cwd and not os.path.isabs(argv[1]):
        raise RuntimeError(_("Onboard's relative executable path could not be resolved for restart."))
    return dict(pid=pid, start=status['start'], uid=status['uid'], argv=argv,
                cwd=cwd, visible=visible)


def alive(state):
    status = process_status(state['pid'])
    return bool(status and status['start'] == state['start'] and
                status['uid'] == state['uid'] and status['state'] not in ('Z', 'X'))


def wait_exit(state, timeout=8):
    deadline = time.monotonic() + timeout
    while alive(state):
        if time.monotonic() >= deadline:
            raise RuntimeError(_("Onboard did not exit normally. The screen scaling change has been stopped."))
        time.sleep(.04)


def stop(session, request):
    owner = session.owner()
    if request.get('owner') and owner != request['owner']:
        # The instance captured by the applet has already exited or changed.
        return {}
    pid = session.pid(owner) if owner else request.get('pid')
    state = capture(pid, session.visible(owner) if owner else None)
    if not state:
        return {}
    state['stopped'] = False
    state['schemaId'] = request.get('schemaId')
    try:
        try:
            if alive(state):
                os.kill(state['pid'], signal.SIGTERM)
            wait_exit(state)
        except ProcessLookupError:
            pass
        state['stopped'] = True
        if state['schemaId']:
            state['geometry'] = session.geometry(state['schemaId'])
        return {'restart': state}
    except Exception as error:
        # Keep enough information to resume after a failure as well.
        return {'restart': state, 'error': str(error)}


def start(session, state):
    if state.get('uid') != os.getuid() or not isinstance(state.get('argv'), list) or not state['argv']:
        raise RuntimeError(_("Onboard's restart data is invalid."))
    wait_exit(state)
    owner = session.owner()
    if owner:
        return {'owner': owner, 'existing': True}
    cwd = state.get('cwd')
    if not cwd or not os.path.isdir(cwd):
        cwd = None
    argv = state['argv']
    if len(argv) > 1 and Path(argv[0]).name.startswith('python') and Path(argv[1]).name == 'onboard':
        # /proc/cmdline includes the shebang interpreter even after a normal
        # script launch. Execute the same Onboard script directly, retaining
        # its arguments, so the kernel's process name remains "onboard".
        argv = argv[1:]
    child = subprocess.Popen(argv, cwd=cwd, stdin=subprocess.DEVNULL,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             close_fds=True, start_new_session=True)
    deadline = time.monotonic() + 10
    while True:
        owner = session.owner()
        if owner:
            session.restore_visibility(owner, state.get('visible'))
            return {'owner': owner, 'pid': child.pid}
        if child.poll() is not None:
            raise RuntimeError(_("Onboard exited during restart (status {}).").format(child.returncode))
        if time.monotonic() >= deadline:
            # The launched process remains alive; never spawn a second copy.
            raise RuntimeError(_("Onboard started but has not yet registered with the session."))
        time.sleep(.05)


def main():
    try:
        request = json.load(sys.stdin)
        action = sys.argv[1] if len(sys.argv) == 2 else ''
        if action == 'trace':
            atomic_json(cache_directory() / 'last-switch.json', request)
            result = {}
        elif action in ('claim', 'release', 'clear', 'restore', 'apply'):
            result = GeometryStore(Session()).run(action, request)
        elif action == 'stop':
            session = Session()
            result = stop(session, request)
        elif action == 'start':
            result = start(Session(), request)
        else:
            raise RuntimeError(_("Unknown Onboard action."))
    except Exception as error:
        result = {'error': str(error)}
    print(json.dumps(result), flush=True)
    return 1 if result.get('error') else 0


if __name__ == '__main__':
    sys.exit(main())
