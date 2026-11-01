#!/usr/bin/env python3
"""ADB brightness backend; configuration and tunable defaults are below."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

# Defaults and discovery proposal location. Applet settings are supplied by Cinnamon.
UUID = 'adb-tv-brightness@AtomicRobotMan0101'
CONFIG_PATH = Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local/state')) / UUID / 'confirmed-controller.json'
ADB = 'adb'
TIMEOUT = 6
DEFAULTS = {'device': '', 'kind': 'settings', 'namespace': 'global',
            'key': 'picture_backlight', 'minimum': 0, 'maximum': 100, 'step': 5}


def validate_config(config):
    config = {**DEFAULTS, **config}
    if not isinstance(config['device'], str) or not re.fullmatch(r'[A-Za-z0-9_.:\[\]-]+', config['device']) or config['device'].startswith('-'):
        raise ValueError('Set a valid ADB serial or TV address:port in Configure')
    if config['kind'] not in ('settings', 'sysfs'):
        raise ValueError('Unsupported brightness controller')
    if config['kind'] == 'settings':
        if config['namespace'] not in ('system', 'secure', 'global') or not re.fullmatch(r'[A-Za-z0-9_.]+', config['key']):
            raise ValueError('Invalid Android setting')
    elif not re.fullmatch(r'/sys/(?:class/backlight|devices)/[A-Za-z0-9_./:-]+/brightness', config['key']) or '..' in config['key']:
        raise ValueError('Invalid sysfs path')
    for key in ('minimum', 'maximum', 'step'):
        if type(config[key]) is not int:
            raise ValueError('Brightness limits and step must be integers')
    if not 0 <= config['minimum'] < config['maximum'] <= 65535 or not 1 <= config['step'] <= 100:
        raise ValueError('Invalid brightness range or step')
    return config


def adb(*args):
    result = subprocess.run([ADB, *args], capture_output=True, text=True, timeout=TIMEOUT)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or 'ADB command failed')
    return result.stdout.strip()


def connect(config):
    if ':' in config['device']:
        adb('connect', config['device'])


def read_raw(config):
    prefix = ('-s', config['device'], 'shell')
    if config['kind'] == 'settings':
        raw = adb(*prefix, 'settings', 'get', config['namespace'], config['key'])
    else:
        raw = adb(*prefix, 'cat', config['key'])
    value = int(raw)
    if not config['minimum'] <= value <= config['maximum']:
        raise ValueError('Controller value is outside the configured range')
    return value


def write_raw(config, value):
    if not config['minimum'] <= value <= config['maximum']:
        raise ValueError('Brightness is outside the configured range')
    prefix = ('-s', config['device'], 'shell')
    if config['kind'] == 'settings':
        adb(*prefix, 'settings', 'put', config['namespace'], config['key'], str(value))
    else:
        adb(*prefix, f'echo {int(value)} > {config["key"]}')


def target(current, steps, step=5):
    for _ in range(abs(steps)):
        current = min(100, (current // step + 1) * step) if steps > 0 else max(0, ((current - 1) // step) * step)
    return current


def main(args):
    operation = args[0] if args else 'get'
    if operation not in ('get', 'step', 'set'):
        raise ValueError('Unknown operation')
    value = int(args[1]) if operation != 'get' else None
    if operation == 'set' and not 0 <= value <= 100:
        raise ValueError('Brightness must be 0–100')
    if operation == 'step' and not -100 <= value <= 100:
        raise ValueError('Too many scroll steps')
    config = validate_config(json.loads(args[2] if len(args) > 2 else '{}'))
    connect(config)
    span = config['maximum'] - config['minimum']
    current = round((read_raw(config) - config['minimum']) * 100 / span)
    if operation != 'get':
        requested = value if operation == 'set' else target(current, value, config['step'])
        raw = config['minimum'] + round(requested * span / 100)
        write_raw(config, raw)
        if read_raw(config) != raw:
            raise RuntimeError('TV did not retain the requested brightness')
        current = round((raw - config['minimum']) * 100 / span)
    return {'brightness': current}


if __name__ == '__main__':
    try:
        print(json.dumps(main(sys.argv[1:])))
    except Exception as error:
        print(json.dumps({'error': str(error)}))
