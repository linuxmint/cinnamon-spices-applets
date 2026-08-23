# Changelog

All notable changes to Lumendusk. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-08-23

Everything the Cinnamon Spices submission turned up. Submitting is its own
kind of review: an automated scanner reads the applet against the project's
conventions, and it found things a passing test suite never would.

### Fixed

- **No synchronous file or spawn calls are left in the applet.** Three
  `GLib.file_test` calls — two picking the engine out of four candidate paths,
  one checking whether `config.toml` exists yet — were synchronous stats on the
  shell's main loop, and two of those paths sit under the user's home
  directory. On a home directory served by an unresponsive NFS or SSHFS mount
  that stalls the whole desktop, not just this applet. They are now
  `Gio` `query_info_async`, which makes the engine lookup callback-based; its
  callers were all about to spawn a subprocess, so none of them could have used
  a synchronous answer anyway.

  `config.toml` itself was read the same way and is now `load_contents_async`
  into a cached string, refreshed before each menu redraw.

- **The applet no longer builds a command line for a shell to take apart
  again.** Two `Util.spawnCommandLine` calls became `Util.spawn` with the argv
  array they were already assembling. Every argument was shell-quoted, so this
  fixed no live bug — but quoting is a thing you can forget once, and the
  arguments being literals today is a poor reason to keep a shell in the path.

- **Timer callbacks return `GLib.SOURCE_REMOVE`** rather than a bare `false`.

- **The applet bundle no longer ships compiled bytecode.** `build-applet.sh`
  cleared `__pycache__` after copying the engine in, then ran the engine as a
  smoke test — which wrote it straight back, after the cleanup and before the
  zip. Every release so far shipped `.pyc` files; they were a third of the
  bundle. The smoke test now runs with `-B`, the build fails outright if
  anything compiled survives, and a test pins both.

### Changed

- The screenshot on the Spices page shows sun mode, which is the default and
  the reason to use this rather than a timer. It showed fixed times.

## [0.3.0] — 2026-08-23

The release that went looking for trouble. Nothing here was reported by using
Lumendusk day to day — every fix below came from auditing it against what it
claims to do, and four of them were things that had been quietly wrong for
weeks: a mode that had never once run, settings that were read but never used,
and two subsystems that reported success they hadn't earned.

Prepared for Cinnamon Spices; 0.3.1 is what was actually submitted.

### Removed

- **Three settings that did nothing.** `brightness.fade_minutes` was stored in
  the config file, explained by a comment there, and range-checked by the CLI —
  but nothing ever read it, so setting it to 10 promised a ten-minute fade and
  delivered a hard jump. It comes back with the fade itself. `theme.light` and
  `theme.dark` were leftovers from before Mint's style catalog drove the
  switch: parsed on load, never used, never even written back.

  Config files that still carry any of the three keep loading exactly as
  before — unrecognised keys are ignored, not rejected — and the keys disappear
  the next time the file is rewritten. `lumendusk config set` now says
  "unknown setting" for them, which is the honest answer.

### Fixed

- **Sun mode switched a few minutes off sunrise and sunset.** It compared the
  sun's elevation against 0°, but sunrise is the moment the upper *limb* clears
  the horizon, so the centre is still below it — astral's own sunrise and
  sunset sit at −0.37°, steady to a hundredth of a degree from the equator to
  the Arctic. The sun crosses that last third of a degree slowly, so an
  apparently exact threshold ran up to four minutes late in the morning and the
  same early in the evening, widening with latitude. Small enough that nobody
  would have noticed on a desktop, which is why it needed a test rather than a
  day of watching: the existing sun tests asked about noon and midnight, where
  any threshold near the horizon is right. The new ones ask about the boundary
  itself, at four latitudes across both solstices and an equinox.

- **Night light no longer reports success when nothing happened.** On a machine
  with neither Cinnamon's night-light keys nor `gammastep` nor `xsct`, the log
  read `no night-light backend available` and then, one line later,
  `night light → on @ 4000K`. The second line was unconditional. Anyone reading
  that log would go looking anywhere except at the real reason their screen
  never warmed. It now says it couldn't, and when a fallback does the work it
  says which one — `night light → on @ 4000K (via gammastep)` — because that
  also answers "why doesn't the setting in System Settings match?".

- **Only one daemon runs at a time.** `install.sh` starts one, the autostart
  entry starts another at the next login, and debugging adds a third — they
  never corrupted anything, because applying a phase is reconciliation, but
  they doubled every `gsettings` write and every DDC/CI conversation and
  interleaved in the log. A second daemon now notices and bows out. The lock is
  advisory: no `fcntl`, or an unwritable cache directory, and it runs anyway.
  `--once` never takes it — that one is meant to be run while the daemon is up.
- **SIGTERM ends the daemon the way Ctrl-C does**, so a logout or a `pkill`
  unwinds through the path that logs "stopping" instead of stopping the log
  mid-sentence.
- **The night-light fallback no longer leaves zombies.** `gammastep` and `xsct`
  were started and never waited for; both are one-shot commands that exit in
  milliseconds, and the daemon runs for weeks. Only ever reachable on setups
  without Cinnamon's own night-light keys.
- **`uninstall.sh` removes `~/.cache/lumendusk`**, which it had never touched —
  and it removes it without `--purge`, since a cache is regenerable by
  definition. `--purge` stays about the things you would mind losing: your
  settings and your log.
- **`install.sh` and the applet honour `XDG_DATA_HOME` and `XDG_CONFIG_HOME`**
  instead of hardcoding `~/.local/share` and `~/.config`. The engine already
  did. Cinnamon finds applets through the same variable, so on a machine that
  relocates it the applet was being installed where nothing would look for it.

### Changed

- `shellcheck` and `bandit` run in CI alongside `pytest` and `ruff`, and both
  are in the `dev` extra so they can be run before pushing rather than
  discovered afterwards. `bandit` is set to medium-and-up: every call to
  `gsettings`, `ddcutil` or `xrandr` is a "low" by construction, and a scan
  that cries wolf gets switched off.
- The applet's `_runEngine` takes an argv array and quotes every part, matching
  the async path. Its arguments are all literals today, which is a bad reason
  for the old string concatenation to have been safe — the next one added is as
  likely as not to be a theme name out of the settings dialog.

- **The applet is now packaged the way Cinnamon Spices requires.**
  `packaging/build-spices.sh` builds the submission tree — the applet's page
  files outside, the zip contents in `files/<uuid>/` — and checks it against
  the rules upstream's `validate-spice` enforces, so a forbidden field costs a
  rebuild rather than a reviewer's round trip. CI builds that tree and runs the
  engine out of it, which is the path a Spices install actually extracts to.
- `metadata.json` no longer carries an `icon` field: the Spices validator
  forbids it. Nothing about the applet's appearance changes — the panel icon is
  set in `applet.js` and the applet list uses `icon.png`.

## [0.2.1] — 2026-08-19

### Fixed

- **Night light and brightness settings did nothing until the next
  transition.** Changing the warmth or a brightness preset in Screen settings
  stored the value and left the screen alone — for up to a whole phase, which
  looked like a control that wasn't wired up. Only the appearance setting had
  been given this treatment in 0.2.0; the other two now behave the same way.
  Still narrow, so it can't be mistaken for the daemon overriding you: only the
  setting that actually changed is applied, and only if it affects the phase
  you are in. Editing the day brightness after dark changes nothing tonight,
  and a level you nudged by hand this evening survives the edit.

- **The settings panel's sliders no longer fire once per step.** Cinnamon
  reports every value a slider passes on the way to where you let go, which was
  harmless while those values only reached a file and is not now that they reach
  the screen. Edits are coalesced, and only one write per setting is ever out at
  a time with the newest value winning — so a brightness drag lands where you
  left it, instead of replaying every stop on the way at DDC/CI's pace.

### Changed

- **A monitor that isn't answering over DDC/CI is skipped for five minutes**
  instead of being waited on at every change. Failure there is slow failure —
  ddcutil retries, then times out — so one wedged display was adding seconds to
  every transition, every slider move and every menu open, for as long as it
  stayed wedged. It is asked again when the period is up, immediately if a
  display is plugged in, and straight away if you name it yourself or run
  `brightness list`, which always probes for real.
- `lumendusk config set` takes `--apply`, which shows the stored change now
  instead of waiting for the daemon's next tick. This is what the settings
  panel uses, so the panel and the schedule agree on what a changed setting
  means rather than each deciding for itself.

## [0.2.0] — 2026-08-12

### Added

- **Each phase chooses its own appearance.** Day → light and night → dark were
  hard-coded; they are now settings (Screen → Appearance, or `theme_day` /
  `theme_night` in the config file). Set the daytime appearance to Dark and the
  desktop stays dark at noon while the night light and brightness still follow
  the clock — the common case of preferring dark without giving up the rest.
  Setting both phases the same simply stops the theme from changing.
- `lumendusk appearance auto` applies whichever appearance the schedule calls
  for right now, and nothing else.

### Changed

- The daemon applies a changed appearance setting at once instead of waiting
  for the next transition. Transition-only apply exists to protect changes the
  user makes *by hand*; a setting they just edited is a request, not drift.
- The panel's status line reports the phase rather than reading it off the
  shell theme, which stops being the same thing once the day can be dark.

## [0.1.0] — 2026-08-08

First release worth a version number. Phase 1 (Linux Mint / Cinnamon) is
functionally complete: the panel applet, the settings panel, and a background
engine that switches theme, night light and brightness on a schedule.

Pre-1.0 because Windows and macOS are Phase 3, and because this has not yet
been observed running a full unattended day/night cycle.

### Added

- **Cinnamon panel applet** (`lumendusk@kasun`) with an Automatic / Manual
  switch, Light / Dark and a live night-light toggle in Manual, a brightness
  slider, and Apply day/night now.
- **Settings panel** (right-click → Configure) covering mode, location, fixed
  times, night-light warmth and brightness presets, including one-click
  location detection from the system timezone — offline, from
  `/usr/share/zoneinfo`.
- **Whole-desktop dark/light switching**, driven by Mint's own style catalog
  in `/usr/share/cinnamon/styles.d`, so the shell, panel, window borders,
  GTK/GTK4, Flatpak (XApp portal), icons and accent all move together.
- **Day/night detection** from sunrise/sunset (offline, via `astral`) or fixed
  times. Sun mode compares solar *elevation* rather than today's sunrise and
  sunset times, which is what makes it correct across the Americas, the
  Pacific, and inside the polar circles.
- **Brightness** across sysfs/brightnessctl, ddcutil (DDC/CI) and xrandr,
  normalised to 0–100 %, applied at each transition when enabled.
- **Self-contained applet bundle** (`packaging/build-applet.sh`) carrying the
  engine and its pure-Python dependencies, because a Cinnamon Spices install
  extracts a zip and runs no installer.
- Autostart on login, and a log at `~/.local/state/lumendusk/lumendusk.log`.

### Fixed

- **ddcutil is now serialised across processes.** DDC/CI is a shared bus and
  concurrent calls do not queue — they fail. Twelve deliberately overlapping
  operations produced 16 errors before the lock and none after, including a
  brightness *write* lost to `DDCRC_RETRIES`.
- **Applying a phase no longer rewrites settings that are already correct.**
  dconf notifies on every write, so the old behaviour made Cinnamon reload its
  theme for nothing at every login and every switch back to Automatic.
- **Every command the daemon waits for now has a timeout.** A hung `ddcutil`
  used to stop the daemon mid-tick with its process still alive and its log
  simply silent — indistinguishable from a healthy idle daemon.
- **The panel menu stays open** when you pick a mode or an appearance.
  Clicking Manual is what reveals Light / Dark, so closing at that moment hid
  the controls the click had just unlocked.
- **Manual mode no longer has its night light undone by the daemon.** The
  one-time drop on entering Manual was implemented in both the CLI and the
  daemon loop; the daemon's copy could land up to a minute later and reverse a
  toggle the user had just made.
- Brightness changes are logged, and a write that failed on every monitor is
  no longer reported as a success.

### Changed

- The four overlapping "don't automate" controls (`enabled`, `paused`, a Dark
  mode switch, and Switch to Day/Night) collapsed into a single
  **Automatic / Manual** choice. Old configs migrate on load; `pause` and
  `resume` remain as aliases.
- Monitor discovery is cached in `~/.cache/lumendusk/monitors.json`, keyed on
  which displays the kernel reports as connected, so a hotplug invalidates it
  at once rather than waiting out a timer.
- `ruff` runs in CI, with the rule set pinned so a ruff release cannot fail the
  build on rules nobody chose.
