#!/usr/bin/env python3
"""Read-only inventory followed by optional, interactive brightness tests."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import sys
import time

# Tunable defaults. No device-specific address is shipped.
BACKEND_PATH = Path(__file__).resolve().parent / 'brightness.py'
UUID = 'adb-tv-brightness@AtomicRobotMan0101'
REPORT_PATH = Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local/state')) / UUID / 'brightness-scan.json'
DROP_FRACTION = 0.20  # Relative reduction from the original value, not 20 percentage points.
HOLD_SECONDS = 3
SETTLE_SECONDS = 2
NAMESPACES = ('global', 'system', 'secure')
BRIGHTNESS_NAME = re.compile(r'brightness|backlight', re.I)
EXCLUDED_NAME = re.compile(r'mode|auto|sensor|timeout|duration|dim|vr|float|adjust|enable|limit|threshold|curve|color|colour|tune', re.I)
DIAGNOSTICS = {
    'properties': ['getprop'],
    'display': ['dumpsys', 'display'],
    'power': ['dumpsys', 'power'],
    'lights': ['dumpsys', 'lights'],
    'services': ['service', 'list'],
    'sysfs': ['sh', '-c', 'for d in /sys/class/backlight/*; do [ -d "$d" ] || continue; echo "$d"; cat "$d/brightness" "$d/max_brightness"; done'],
}

# Discovery must not create bytecode files inside the installed applet.
sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('brightness_backend', BACKEND_PATH)
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


def ask_integer(prompt):
    while True:
        try:
            return int(input(prompt))
        except ValueError:
            print('Enter an integer.')


def scan(device):
    report = {'device': device, 'diagnostics': {}, 'settings': {}, 'candidates': []}
    for name, command in DIAGNOSTICS.items():
        try:
            # The sysfs loop is a fixed shell command, never device-supplied text.
            if name == 'sysfs':
                command = [command[-1]]
            report['diagnostics'][name] = backend.adb('-s', device, 'shell', *command)
        except Exception as error:
            report['diagnostics'][name] = {'error': str(error)}
    for namespace in NAMESPACES:
        try:
            output = backend.adb('-s', device, 'shell', 'settings', 'list', namespace)
            report['settings'][namespace] = output
            for line in output.splitlines():
                key, sep, value = line.partition('=')
                if sep and BRIGHTNESS_NAME.search(key) and re.fullmatch(r'[\w.]+', key):
                    item = {'device': device, 'kind': 'settings', 'namespace': namespace, 'key': key, 'observed': value}
                    item['testable'] = bool(value.isdecimal() and not EXCLUDED_NAME.search(key))
                    report['candidates'].append(item)
        except Exception as error:
            report['settings'][namespace] = {'error': str(error)}
    sysfs = report['diagnostics']['sysfs']
    if isinstance(sysfs, str):
        lines = sysfs.splitlines()
        for i, line in enumerate(lines):
            if re.fullmatch(r'/sys/class/backlight/[\w.:-]+', line) and i + 2 < len(lines):
                if lines[i+1].isdecimal() and lines[i+2].isdecimal():
                    report['candidates'].append({'device': device, 'kind': 'sysfs', 'key': line + '/brightness',
                        'observed': lines[i+1], 'minimum': 0, 'maximum': int(lines[i+2]), 'testable': True})
    report['candidates'].sort(key=lambda c: (c['key'] != 'picture_backlight', c['key']))
    return report


def test_candidate(candidate):
    config = {**backend.DEFAULTS, **candidate}
    if config['kind'] == 'settings':
        print('Android settings do not declare their numeric range. Confirm it from device documentation.')
        config['minimum'] = ask_integer('Minimum supported value: ')
        config['maximum'] = ask_integer('Maximum supported value: ')
    if not 0 <= config['minimum'] < config['maximum']:
        print('Invalid range; skipping.')
        return None
    config = backend.validate_config(config)
    original = backend.read_raw(config)
    lowered = max(config['minimum'], round(original * (1 - DROP_FRACTION)))
    if lowered >= original:
        print('Already at minimum; cannot perform a reduction.')
        return None
    print(f'Test: {original} → {lowered} for {HOLD_SECONDS}s → {original}')
    input('Press Enter to test, or Ctrl-C to stop: ')
    # Restore even if writing fails, the user interrupts, or a subsequent read fails.
    try:
        backend.write_raw(config, lowered)
        if backend.read_raw(config) != lowered:
            raise RuntimeError('Reduced value did not read back correctly')
        time.sleep(HOLD_SECONDS)
    finally:
        try:
            backend.write_raw(config, original)
            if backend.read_raw(config) != original:
                raise RuntimeError('Original value did not read back correctly')
        except BaseException as error:
            raise RuntimeError(f'RESTORATION FAILED: restore {config["key"]} to {original}. {error}') from error
    time.sleep(SETTLE_SECONDS)
    while True:
        answer = input('Did this drop and increase the brightness of your screen? [Y/N] ').strip().lower()
        if answer == 'y':
            return {key: config[key] for key in backend.DEFAULTS}
        if answer == 'n':
            return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', help='ADB serial or host:port; must already be connected')
    parser.add_argument('--scan-only', action='store_true', help='Inventory only; never change brightness')
    parser.add_argument('--report', type=Path, default=REPORT_PATH)
    args = parser.parse_args()
    devices = [line.split()[0] for line in backend.adb('devices').splitlines()[1:] if len(line.split()) >= 2 and line.split()[1] == 'device']
    if not devices:
        raise RuntimeError('No authorised ADB devices. Run adb devices and authorise/connect the TV first.')
    if args.device:
        if args.device not in devices:
            raise RuntimeError('Selected device is not connected and authorised')
        device = args.device
    elif len(devices) == 1:
        device = devices[0]
    else:
        for index, serial in enumerate(devices, 1):
            print(f'{index}: {serial}')
        selection = ask_integer('Select device number: ')
        if not 1 <= selection <= len(devices):
            raise ValueError('Invalid device selection')
        device = devices[selection - 1]
    print(f'Scanning {device}; this stage only reads data…')
    report = scan(device)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Detailed inventory saved to {args.report} (may contain device/network identifiers).')
    for index, candidate in enumerate(report['candidates'], 1):
        print(f'{index}: {candidate.get("namespace", "sysfs")}/{candidate["key"]} = {candidate["observed"]}'
              + ('' if candidate['testable'] else ' [diagnostic only: mode/automatic/non-integer setting]'))
    if args.scan_only:
        return
    for candidate in report['candidates']:
        if not candidate['testable']:
            continue
        print(f'\nCandidate: {candidate.get("namespace", "sysfs")}/{candidate["key"]}')
        answer = input('Test this candidate? [Y/N/Q] ').strip().lower()
        if answer == 'q':
            return
        if answer != 'y':
            continue
        try:
            config = test_candidate(candidate)
        except RuntimeError as error:
            # Stop on any test failure: continuing could leave a changed controller behind.
            raise RuntimeError(f'Test stopped: {error}') from error
        if config:
            backend.CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            backend.CONFIG_PATH.write_text(json.dumps(config, indent=2) + '\n')
            print(f'Confirmed controller saved to {backend.CONFIG_PATH}')
            print('Copy these values into the applet’s Configure dialog:')
            print(json.dumps(config, indent=2))
            return
    print('Candidates exhausted; no confirmed controller saved. Vendor-specific controls may require further investigation.')


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: sys.exit('Terminated'))
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(f'Stopped: {error}', file=sys.stderr)
        sys.exit(1)
