"""Offline checks: no ADB commands or real brightness changes."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('discovery', ROOT / 'files' / ROOT.name / 'discover_brightness.py')
D = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(D)
B = D.backend
CANDIDATE = {'device': 'test', 'kind': 'sysfs', 'key': '/sys/class/backlight/test/brightness',
             'minimum': 0, 'maximum': 100}


class BrightnessTests(unittest.TestCase):
    def test_step_boundaries(self):
        for current in range(101):
            self.assertEqual(B.target(current, 1), min(100, (current // 5 + 1) * 5))
            self.assertEqual(B.target(current, -1), max(0, ((current - 1) // 5) * 5))
        self.assertEqual(B.target(60, 100), 100)
        self.assertEqual(B.target(60, -100), 0)

    def test_restore_before_confirmation(self):
        calls = []
        def prompt(text):
            if '[Y/N]' in text:
                self.assertEqual(calls, [48, 60])
                return 'y'
            return ''
        with patch.object(B, 'read_raw', side_effect=[60, 48, 60]), patch.object(B, 'write_raw', side_effect=lambda c, v: calls.append(v)), patch.object(D.time, 'sleep'), patch('builtins.input', side_effect=prompt):
            self.assertEqual(D.test_candidate(CANDIDATE)['key'], CANDIDATE['key'])

    def test_restore_on_interruption(self):
        with patch.object(B, 'read_raw', side_effect=[60, 48, 60]), patch.object(B, 'write_raw') as write, patch.object(D.time, 'sleep', side_effect=KeyboardInterrupt), patch('builtins.input', return_value=''):
            with self.assertRaises(KeyboardInterrupt):
                D.test_candidate(CANDIDATE)
            self.assertEqual([call.args[1] for call in write.call_args_list], [48, 60])

    def test_restore_after_failed_write(self):
        with patch.object(B, 'read_raw', side_effect=[60, 60]), patch.object(B, 'write_raw', side_effect=[RuntimeError('write failed'), None]) as write, patch('builtins.input', return_value=''):
            with self.assertRaises(RuntimeError):
                D.test_candidate(CANDIDATE)
            self.assertEqual([call.args[1] for call in write.call_args_list], [48, 60])

    def test_restore_failure_stops(self):
        with patch.object(B, 'read_raw', side_effect=[60, 48]), patch.object(B, 'write_raw', side_effect=[None, RuntimeError('offline')]), patch.object(D.time, 'sleep'), patch('builtins.input', return_value=''):
            with self.assertRaisesRegex(RuntimeError, 'RESTORATION FAILED'):
                D.test_candidate(CANDIDATE)

    def test_config_injection_and_ranges(self):
        for key, value in [('device', 'tv;reboot'), ('device', '-H'), ('key', 'brightness;reboot'), ('minimum', -1), ('maximum', 0), ('step', 0)]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                B.validate_config({**B.DEFAULTS, 'device': 'test', key: value})
        for path in ['/sys/class/backlight/test/../../brightness', '/sys/class/backlight/test/brightness;reboot']:
            with self.assertRaises(ValueError):
                B.validate_config({**CANDIDATE, 'key': path})

    def test_native_scale_and_step(self):
        import json
        config = {**B.DEFAULTS, 'device': 'test', 'maximum': 255}
        with patch.object(B, 'connect'), patch.object(B, 'read_raw', side_effect=[128, 140]), patch.object(B, 'write_raw') as write:
            self.assertEqual(B.main(['step', '1', json.dumps(config)]), {'brightness': 55})
            write.assert_called_once_with(config, 140)

    def test_scan_filters_mode_settings(self):
        def adb(*args):
            if 'list' in args and 'settings' in args:
                return 'picture_backlight=60\nscreen_brightness_mode=1\nscreen_brightness=128\nother=5'
            return ''
        with patch.object(B, 'adb', side_effect=adb):
            report = D.scan('test')
        self.assertEqual(len(report['candidates']), 9)
        self.assertTrue(all(not c['testable'] for c in report['candidates'] if c['key'].endswith('_mode')))


if __name__ == '__main__':
    unittest.main()
