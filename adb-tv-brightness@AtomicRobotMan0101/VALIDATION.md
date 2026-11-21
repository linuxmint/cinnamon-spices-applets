---
id: 27d96a27-ff10-4206-9e19-d1ca9c3f6389
title: VALIDATION
tags: []
pinned: false
created: 2026-11-01T13:38:27.757045923+00:00
modified: 2026-11-01T13:40:11.745659631+00:00
---
# VALIDATION

# Submission validation

Date: 2026-11-02 (Australia/Sydney). Cinnamon 6.6.9. Upstream baseline: `2841fc22faf3b635f37c9011bc1e0fa7c607c7fc`. Branch: `add-adb-tv-brightness`.

## Completed

- Read the repository README, contribution rules and copilot review instructions.
- `info.json` author: `AtomicRobotMan0101`; UUID matches the folder and metadata.
- Required square icon, real applet-menu screenshot, metadata and nested files layout.
- Cinnamon Settings API for all applet settings; discovery saves only a proposed controller.
- All runtime helpers/documentation bundled; no external code downloads.
- Asynchronous applet subprocess I/O, per-command and overall timeouts.
- Validated remote setting names, paths, device selector, bounds and integer values.
- No shell interpolation of unchecked configuration; no personal TV address shipped.
- No bytecode, reports, caches or settings written to the installation directory by default.
- Gettext setup and translation template generated with `cinnamon-spices-makepot`.
- `validate-spice adb-tv-brightness@AtomicRobotMan0101`: PASS.
- `validate-spice --all`: PASS (the repository-wide CI validation).
- `test-spice adb-tv-brightness@AtomicRobotMan0101`: PASS; separate development copy installed/reloaded.
- Python unit tests: 8 PASS (steps, scaling, input rejection, candidate filtering, restoration on success/interruption/write failure, restoration failure).
- `node --check` on applet.js: PASS.
- Development applet loaded on Cinnamon and read live TV brightness successfully.
- Bundled discovery ran against the TV in read-only mode and identified picture_backlight.
- Development applet removal verified: timer, debounce and watchdog all zero; no helper process running. Temporary panel instance removed; working applet untouched.

Translation generation needed polib; it was installed only into a temporary validation directory. It is not an applet runtime dependency or shipped code.

## Official references read

- [Submission workflow](https://github.com/linuxmint/cinnamon-spices-applets#additions)
- [Review instructions](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/copilot-instructions.md)
- [Contribution rules](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md)

## Translation path fix

XDG translation lookup with legacy fallback: four real CJS/gettext tests passed.
All 12 tests, applet validation and JavaScript syntax checks passed.
