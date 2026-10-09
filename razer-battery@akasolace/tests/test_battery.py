import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace

path = Path(__file__).resolve().parents[1] / 'files/razer-battery@akasolace/battery.py'
spec = importlib.util.spec_from_file_location('battery', path)
battery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(battery)


class Device:
    name = 'Mouse'
    serial = 'test'
    battery_level = 100
    is_charging = False

    def has(self, capability):
        return capability == 'battery'


class Tests(unittest.TestCase):
    def read(self, *devices):
        return battery.snapshot(lambda: SimpleNamespace(devices=devices))

    def test_full_and_charging(self):
        d = Device()
        d.is_charging = True
        self.assertEqual(self.read(d)['devices'][0]['battery'], 100)
        self.assertTrue(self.read(d)['devices'][0]['charging'])

    def test_invalid_batteries(self):
        for level in [-1, 101, float('nan'), float('inf'), '100', True]:
            with self.subTest(level=level):
                d = Device()
                d.battery_level = level
                self.assertIsNone(self.read(d)['devices'][0]['battery'])

    def test_multiple_and_zero(self):
        a, b = Device(), Device()
        a.name, a.battery_level = 'A', 0
        b.name, b.battery_level = 'B', 55
        self.assertEqual([d['battery'] for d in self.read(b, a)['devices']], [0, 55])

    def test_disconnection_isolated(self):
        class Disconnected(Device):
            @property
            def battery_level(self):
                raise RuntimeError('gone')
        data = self.read(Disconnected(), Device())['devices']
        self.assertIsNone(data[0]['battery'])
        self.assertEqual(data[1]['battery'], 100)

    def test_unsupported_charging(self):
        class Unknown(Device):
            @property
            def is_charging(self):
                raise NotImplementedError
        self.assertIsNone(self.read(Unknown())['devices'][0]['charging'])

    def test_empty_and_non_battery(self):
        d = Device()
        d.has = lambda _: False
        self.assertEqual(self.read(d)['devices'], [])
        self.assertEqual(self.read()['devices'], [])

    def test_daemon_unavailable(self):
        def fail():
            raise RuntimeError('no bus')
        self.assertIsNotNone(battery.snapshot(fail)['error'])


if __name__ == '__main__':
    unittest.main()
