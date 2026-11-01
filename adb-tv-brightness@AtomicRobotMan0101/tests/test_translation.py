"""Exercise the applet's lookup with real CJS/gettext catalogs."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

APPLET = Path(__file__).resolve().parents[1] / 'files' / 'adb-tv-brightness@AtomicRobotMan0101' / 'applet.js'
UUID = 'adb-tv-brightness@AtomicRobotMan0101'
CJS = shutil.which('cjs')
MSGFMT = shutil.which('msgfmt')
JS = '''
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.setlocale(Gettext.LocaleCategory.ALL, '');
const source = ARGV[0];
const preamble = source.slice(source.indexOf('// Editable'), source.indexOf('class TVBrightness'));
const translate = new Function('GLib', 'Gettext', preamble + '\\nreturn _;')(GLib, Gettext);
print(JSON.stringify(['Shared', 'Legacy only', 'XDG only', 'Missing', 'Shared'].map(translate)));
'''


@unittest.skipUnless(CJS and MSGFMT, 'Requires cjs and gettext development tools')
class TranslationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        locales = subprocess.check_output(['locale', '-a'], text=True).splitlines()
        cls.test_locale = next((item for item in locales if item.lower() not in ('c', 'c.utf8', 'c.utf-8', 'posix')), None)
        if not cls.test_locale:
            raise unittest.SkipTest('Requires an installed non-C locale for gettext')

    def catalog(self, directory, messages):
        directory.mkdir(parents=True, exist_ok=True)
        po = directory / 'test.po'
        po.write_text('msgid ""\nmsgstr "Content-Type: text/plain; charset=UTF-8\\n"\n\n' +
                      '\n'.join(f'msgid {json.dumps(k)}\nmsgstr {json.dumps(v)}\n' for k, v in messages.items()))
        subprocess.run([MSGFMT, str(po), '-o', str(directory / (UUID + '.mo'))], check=True)

    def lookup(self, custom=True, xdg=True, legacy=True):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp) / 'home'
            home.mkdir()
            data = Path(temp) / 'xdg'
            legacy_dir = home / '.local/share/locale/de/LC_MESSAGES'
            if legacy:
                self.catalog(legacy_dir, {'Shared': 'Legacy shared', 'Legacy only': 'Legacy translated'})
            if xdg and custom:
                self.catalog(data / 'locale/de/LC_MESSAGES', {'Shared': 'XDG shared', 'XDG only': 'XDG translated'})
            env = {**os.environ, 'HOME': str(home), 'LC_ALL': self.test_locale, 'LANGUAGE': 'de'}
            env.pop('XDG_DATA_HOME', None)
            if custom:
                env['XDG_DATA_HOME'] = str(data)
            script = Path(temp) / 'test.js'
            script.write_text(JS)
            result = subprocess.run([CJS, str(script), APPLET.read_text()], env=env, text=True, capture_output=True, check=True)
            return json.loads(result.stdout)

    def test_xdg_priority_and_per_message_legacy_fallback(self):
        self.assertEqual(self.lookup(), ['XDG shared', 'Legacy translated', 'XDG translated', 'Missing', 'XDG shared'])

    def test_legacy_when_xdg_catalog_missing(self):
        self.assertEqual(self.lookup(xdg=False), ['Legacy shared', 'Legacy translated', 'XDG only', 'Missing', 'Legacy shared'])

    def test_default_directory(self):
        self.assertEqual(self.lookup(custom=False), ['Legacy shared', 'Legacy translated', 'XDG only', 'Missing', 'Legacy shared'])

    def test_no_catalogs(self):
        self.assertEqual(self.lookup(xdg=False, legacy=False), ['Shared', 'Legacy only', 'XDG only', 'Missing', 'Shared'])


if __name__ == '__main__':
    unittest.main()
