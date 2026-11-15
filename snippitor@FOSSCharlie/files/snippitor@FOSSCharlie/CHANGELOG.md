# Changelog

All notable changes to Snippitor are documented here.

## [1.8.0]

### Added
- GPL v3 license (`LICENSE`), with a short header in every source file and
  a License/Disclaimer section in the README.

### Security
- Config data (which can include personal info like phone numbers) is now
  restricted to owner-only permissions (`600` on the file, `700` on its
  folder), re-applied on every load/save so it self-heals on upgrade.
- The daemon's keystroke callback is now wrapped in a broad exception
  guard - previously, a single malformed config entry (e.g. from a bad
  import) could silently kill the entire daemon with no visible error.
- Import now validates that trigger/expansion values are plain text before
  accepting them, rather than trusting an external file blindly.
- Exported files default to owner-only permissions too.

## [1.7.0]

### Changed
- Renamed the whole project from "Text Expander" to **Snippitor**,
  including both script files (`expander_daemon.py` → `snippitor_daemon.py`,
  `expander_gui.py` → `snippitor_gui.py`), internal class names, and every
  reference in the UI, comments, and docs.
- New default starter trigger: `tel#` → `01234567890` (was `c#` → `Charlie`).
- Applet description example updated to `fc# -> FOSSCharlie`.
- Panel icon is now icon-only (switched from `TextIconApplet` to
  `IconApplet`) - no more "ON"/"OFF" text label next to the icon.

### Fixed
- Duplicate triggers are now rejected in the editor instead of silently
  colliding into one entry on save; clicking "Add" repeatedly no longer
  produces multiple identical placeholder rows either.
- The editor GUI now closes automatically when the applet is removed via
  Cinnamon's normal removal flow, instead of being left orphaned.
- Disabled `GtkTreeView`'s built-in "type to search" popup in the editor -
  it was capturing stray keystrokes into a floating search box, and since
  the daemon runs system-wide it would even try to expand triggers typed
  into that popup.

## [1.6.0]

### Added
- Auto-save on every edit in the GUI editor - no Save button.
- In-progress cell edits are force-committed if the window is closed mid-edit.
- Single-instance editor window via `Gtk.Application` - opening it again
  just brings the existing window forward.
- Export and Import buttons (merge-on-import, with a file chooser dialog).
- The applet now auto-starts the daemon on load instead of requiring a
  manual click.

### Changed
- **Data storage moved inside the applet's own folder** (`data/` next to
  the scripts) instead of `~/.config/snippitor`. Whichever way the applet
  is removed, deleting its folder now deletes its data with it. Includes
  one-time migration of existing data from the old location.
- Removing the applet from the panel now also deletes any leftover data at
  the old `~/.config` location, and stops the daemon.

### Fixed
- A real rendering bug: the editor window opened completely blank after
  the move to `Gtk.Application`, because `show_all()` was never called on
  it - `present()` alone doesn't recurse into showing child widgets.

## [1.5.0]

### Fixed
- Custom triggers using symbols outside a small hardcoded set (e.g. `%` in
  a `tel%`-style trigger) silently failed to match. Which characters count
  as "still typing a trigger word" is now computed dynamically from the
  user's actual configured triggers instead of a fixed list.

## [1.4.0]

### Fixed
- Off-by-one in the trigger-replacement logic: only the boundary character
  was being deleted, not the trigger itself (or vice versa depending on
  the case), producing garbled output like `cFOSSCharlie` instead of a
  clean expansion.
- Shift and other modifier keys were incorrectly treated as "interrupt the
  current word" keys, breaking any trigger containing a shifted symbol
  (e.g. `#` on a US layout) or capital letter.
- Retyping the boundary character (space/tab/enter) via a raw key
  press/release was found to silently fail to register on at least one
  real system; switched to retyping it as a literal character via the same
  method already used for the expansion text.
- A genuine race condition where fast/continuous typing could scramble
  output, caused by sending corrective keystrokes on the same thread that
  needed to stay responsive to detect them. Replaced a blocking
  "wait and retry" approach (which turned out to be structurally incapable
  of working, since it blocked the very thread it needed) with a
  non-blocking timer-based approach.
- Backspace timing tuned to avoid X11 generating spurious duplicate
  backspace events when sent with no gap between them.

## [1.3.0]

### Changed
- `pynput` and its dependencies (`python-xlib`, `six`) are now bundled
  directly inside the applet folder. No separate `pip install` step is
  required anymore.

## [1.2.0]

### Fixed
- `#` (and other shifted/symbol characters) in a trigger only matched
  partially, because pressing Shift to type them was incorrectly clearing
  the in-progress trigger buffer.

## [1.1.0]

### Fixed
- Applet showed a generic Cinnamon warning ("could cause cinnamon to crash
  or freeze") due to a synchronous blocking call (`spawn_command_line_sync`)
  in the applet's init path; replaced with an async, non-blocking status
  check.
- Applet failed to load at all (`Unknown role definition` error) due to an
  invalid `"role"` field in `metadata.json`; removed it.

## [1.0.0]

### Added
- Initial release: Cinnamon panel applet + background daemon + GTK editor
  for a simple system-wide text expander, with one example trigger
  (`c#` → `Charlie`).
