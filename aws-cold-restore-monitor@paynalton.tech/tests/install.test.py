#!/usr/bin/env python3
# Copyright (C) 2026 paynalton
# SPDX-License-Identifier: GPL-3.0-or-later
"""Exercise the real installer with isolated paths and injected command failures.

Run from the applet directory: python3 tests/install.test.py
No AWS calls or changes to the user's Cinnamon installation are made.
"""
import fcntl
import gettext
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

UUID = 'aws-cold-restore-monitor@paynalton.tech'
PROJECT = Path(__file__).resolve().parents[1]


class InstallerTests(unittest.TestCase):
    """Verify preparation, publication, rollback, and repeatable recovery."""

    def setUp(self):
        """Create a disposable checkout and a recognizable previous installation."""
        self.temp = tempfile.TemporaryDirectory(prefix='aws-install-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / 'checkout'
        shutil.copytree(PROJECT / 'files', self.project / 'files')
        shutil.copyfile(PROJECT / 'install.sh', self.project / 'install.sh')
        self.destination = self.root / 'data/cinnamon/applets' / UUID
        self.locales = self.root / 'locales'
        self.state = self.root / 'state' / (UUID + '-installer')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, XDG_DATA_HOME=str(self.root / 'data'),
                        XDG_STATE_HOME=str(self.root / 'state'),
                        AWS_RESTORE_LOCALE_DIR=str(self.locales),
                        PATH=str(self.bin) + ':' + os.environ['PATH'])
        runtime = self.project / 'files' / UUID
        self.destination.mkdir(parents=True)
        for source in runtime.iterdir():
            if source.is_file():
                (self.destination / source.name).write_bytes(b'old applet\n')
        for source in (runtime / 'po').glob('*.po'):
            target = self.locales / source.stem / 'LC_MESSAGES' / (UUID + '.mo')
            target.parent.mkdir(parents=True)
            target.write_bytes(b'old translation\n')
        (self.destination / 'unrelated.txt').write_text('preserve me')
        self.before = self.snapshot()

    def snapshot(self):
        """Capture installed file bytes and permissions, excluding staging directories."""
        return {str(p.relative_to(self.root)): (p.read_bytes(), p.stat().st_mode & 0o777)
                for parent in (self.destination, self.locales)
                for p in parent.rglob('*') if p.is_file()
                and not any(part.startswith('.' + UUID) for part in p.parts)}

    def run_installer(self):
        """Execute with isolated paths and bounded runtime from a different directory."""
        return subprocess.run(['bash', str(self.project / 'install.sh')], env=self.env,
                              cwd=self.root, text=True, capture_output=True, timeout=20)

    def wrap(self, tool, body):
        """Inject a command wrapper; normal calls delegate to the real system tool."""
        script = self.bin / tool
        script.write_text('#!/bin/bash\n' + body + '\nexec ' + shutil.which(tool) + ' "$@"\n')
        script.chmod(0o755)

    def assert_clean(self):
        """Check that the transaction and owned staging directories were removed."""
        self.assertFalse((self.state / 'transaction').exists())
        self.assertFalse(list(self.root.rglob('.' + UUID + '-install.*')))

    def assert_failed_unchanged(self, result):
        """Check failure reporting, preserved installation, and temporary cleanup."""
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn('Applet installed in', result.stdout)
        self.assertEqual(self.before, self.snapshot())
        self.assert_clean()

    def test_success(self):
        """Install all files and valid catalogs without replacing unrelated content."""
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.destination / 'applet.js').read_bytes(),
                         (self.project / 'files' / UUID / 'applet.js').read_bytes())
        self.assertEqual((self.destination / 'LICENSE').read_bytes(),
                         (self.project / 'files' / UUID / 'LICENSE').read_bytes())
        for catalog in self.locales.rglob('*.mo'):
            with catalog.open('rb') as stream:
                gettext.GNUTranslations(stream)
            self.assertEqual(catalog.stat().st_mode & 0o777, 0o644)
        self.assertEqual((self.destination / 'unrelated.txt').read_text(), 'preserve me')
        self.assert_clean()

    def test_missing_source(self):
        """A missing input fails during preparation without changing installed files."""
        (self.project / 'files' / UUID / 'applet.js').unlink()
        self.assert_failed_unchanged(self.run_installer())

    def test_invalid_catalog(self):
        """A malformed translation cannot leave a partial update."""
        (self.project / 'files' / UUID / 'po/es.po').write_text('invalid catalog')
        self.assert_failed_unchanged(self.run_installer())

    def test_publish_failure(self):
        """Failure after earlier replacements restores both applet and locale files."""
        self.wrap('mv', 'if [[ "$*" == *"/new"* && "${@: -1}" == *"/es/LC_MESSAGES/"* ]]; then exit 1; fi')
        self.assert_failed_unchanged(self.run_installer())

    def test_first_install_failure(self):
        """Rollback removes new files when there was no previous installation."""
        shutil.rmtree(self.destination)
        shutil.rmtree(self.locales)
        self.before = self.snapshot()
        self.wrap('mv', 'if [[ "$*" == *"/new"* && "${@: -1}" == *"/es/LC_MESSAGES/"* ]]; then exit 1; fi')
        self.assert_failed_unchanged(self.run_installer())

    def test_signal(self):
        """A termination signal during publication triggers automatic rollback."""
        self.wrap('mv', 'if [[ "$*" == *"/new"* && "${@: -1}" == *"/es/LC_MESSAGES/"* ]]; then kill -TERM "$PPID"; exit 1; fi')
        self.assert_failed_unchanged(self.run_installer())

    def test_killed_installer_recovers_next_run(self):
        """Uncatchable termination keeps backups; the next run recovers before preparing."""
        self.wrap('mv', 'if [[ "$*" == *"/new"* && "${@: -1}" == *"/es/LC_MESSAGES/"* ]]; then kill -KILL "$PPID"; exit 1; fi')
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.state / 'transaction/ready').exists())
        self.assertNotEqual(self.before, self.snapshot())
        (self.bin / 'mv').unlink()
        # Make the next preparation fail so the restored previous version stays visible.
        (self.project / 'files' / UUID / 'applet.js').unlink()
        self.assert_failed_unchanged(self.run_installer())

    def test_rollback_failure_retains_backups(self):
        """A failed rollback remains recoverable and reports its journal location."""
        self.wrap('mv', 'if [[ "$*" == *"/restore"* || ( "$*" == *"/new"* && "${@: -1}" == *"/es/LC_MESSAGES/"* ) ]]; then exit 1; fi')
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Backups retained', result.stderr)
        self.assertTrue((self.state / 'transaction/ready').exists())
        (self.bin / 'mv').unlink()
        (self.project / 'files' / UUID / 'applet.js').unlink()
        self.assert_failed_unchanged(self.run_installer())

    def test_concurrent_installation(self):
        """A second installer cannot modify an installation while its lock is held."""
        self.state.mkdir(parents=True)
        with (self.state / 'lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.run_installer()
        self.assertIn('Another installation is running', result.stderr)
        self.assert_failed_unchanged(result)


if __name__ == '__main__':
    unittest.main()
