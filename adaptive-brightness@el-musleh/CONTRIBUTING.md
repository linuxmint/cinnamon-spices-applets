# Contributing to Adaptive Brightness

Thank you for your interest in improving the Adaptive Brightness applet!

## Development Workflow

### 1. Setup Your Environment

Clone the repository and link for local testing:
```bash
cd /home/steve/dev/cinnamon-spices-applets
ln -s $(pwd)/adaptive-brightness@el-musleh/files/adaptive-brightness@el-musleh \
  ~/.local/share/cinnamon/applets/adaptive-brightness@el-musleh
```

If the settings dialog looks stale after repeated install/remove cycles, reset
the applet's stored xlet config before testing schema changes:
```bash
rm -f ~/.config/cinnamon/spices/adaptive-brightness@el-musleh/*.json
```

### 2. Testing Your Changes

Run validation before submitting:
```bash
./validate-spice adaptive-brightness@el-musleh
./test-spice adaptive-brightness@el-musleh
npm run lint
./TEST_DEVELOPMENT.sh
./TEST_PRODUCTION.sh
```

Restart Cinnamon to see changes:
```bash
# Alt+F2, type 'r', press Enter
# Or: cinnamon --replace &
```

Monitor logs:
```bash
journalctl -f | grep "\[AB\]"
# Or open the log file from applet settings (Logs section)
```

### 3. Guidelines

- **Modularity:** Keep logic within `applet.js` clean and modular
- **Robustness:** Always wrap external commands and file I/O in try-catch blocks
- **Logging:** Use `this._logger.debug/info/error()` (`ABLogger`); errors also reach journalctl via `global.logError("[AB] ...")`
- **Compatibility:** Test on multiple hardware types if possible
- **No blocking calls:** Use `Gio.Subprocess` with `wait_async` for brightness changes. A fast sync `communicate_utf8()` read of `brightnessctl -m` in the poll loop is acceptable. Blocking file reads (e.g. `GLib.file_get_contents` for local sysfs files) are acceptable when guaranteed fast and local.
- **Settings UI:** Calibration, Travel Mode, and Logs are grouped in one settings panel; keep advanced controls clearly separated by headers
- **Defaults:** When adding comboboxes, ensure the runtime clamps invalid or empty values back to a valid option. Keep `settings-schema.json`, `gschema.xml`, and applet.js constants in sync.

## Submitting Contributions

1. Create a feature branch
2. Ensure all new features are documented in README.md
3. Update CHANGES.md with version notes
4. Run full validation: `./validate-spice adaptive-brightness@el-musleh`
5. Submit Pull Request with clear description

**Note:** This is a cinnamon-spices-applets repository. PRs should follow their guidelines at `.github/CONTRIBUTING.md`.
