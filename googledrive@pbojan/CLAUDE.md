# CLAUDE.md

## Project Overview

A [Cinnamon desktop environment](https://cinnamon-spices.linuxmint.com/) applet that provides a GUI panel widget for syncing Google Drive files using [rclone](https://rclone.org/).
Users can pull/push/sync files, manage a whitelist of folders, and open Drive in a browser.

The applet is pure JavaScript running inside Cinnamon — no build/compile step.

## Deployment

Copy `files/googledrive@pbojan/` into `~/.local/share/cinnamon/applets/` and restart Cinnamon (`Alt+F2` → `r`). Claude has no access to Cinnamon or the applets folder — testing is always a manual step.

`rclone` must be installed and a Google Drive remote configured (`rclone config`).

## Architecture

All code lives in `files/googledrive@pbojan/applet.js`, extending `Applet.IconApplet`. Settings are defined in `settings-schema.json` (two pages: Configuration, Help).

### State Machine

| Menu | When shown |
|------|-----------|
| `configuraionMenu` | `cfgLocation` or `cfgRemote` not set |
| `checkingDriveMenu` | Waiting for `rclone listremotes` async result |
| `initMenu` | Remote name not found — rclone not installed or remote misconfigured |
| `mainMenu` | Remote found — all actions available |

### Settings

| Key | Type | Description |
|-----|------|-------------|
| `cfgLocation` | string (file:// URI) | Local base folder |
| `cfgRemote` | string | rclone remote name (e.g. `gdrive`, without colon) |
| `cfgWhitelist` | `{name: string}[]` | Optional folder names to limit sync scope |

Both `cfgLocation` and `cfgRemote` must be set before the remote check runs. Settings changes trigger `onLocationChanged()` / `onRemoteChanged()` which re-evaluate the active menu.

### Key Flow

1. On startup or settings change → `checkRcloneRemote()` runs `rclone listremotes` async
2. `onRcloneRemotesLoaded()` switches to `mainMenu` or `initMenu`
3. Actions call `buildDriveCommands(action, dryRun)` to build rclone commands
4. `buildBashCommand()` wraps them in a `gnome-terminal` session: dry-run first, then `[y/N]` prompt, then real run if confirmed

### rclone Commands

`buildDriveCommands(action, dryRun)` generates commands for `pull`, `push`, `sync`, `sync-to`. With no whitelist it operates on the remote root; with a whitelist it chains per-folder commands with `&&`.

```
pull:    rclone copy {remote}:{folder} '{local}/{folder}'
push:    rclone copy '{local}/{folder}' {remote}:{folder}
sync:    rclone sync {remote}:{folder} '{local}/{folder}'  ← remote wins
sync-to: rclone sync '{local}/{folder}' {remote}:{folder}  ← local wins
```

Flags: dry-run adds `--dry-run`; real run adds `-v`. Both include `--modify-window 1s`.

### Icons

Bundled SVGs in `files/googledrive@pbojan/icons/` — loaded via `Gio.icon_new_for_string`. Use `fill="#8b8b8b"` (visible on both light and dark themes). Other menu icons use theme names via `St.IconType.SYMBOLIC`.

### Known Gotchas

- **Construction-time settings**: `cfgLocation` and `cfgRemote` are `''` when menus are built in `initUI()`. Never bake their values into menu item command strings at construction — always read them at click time via callbacks.
- **`read` in gnome-terminal**: Use `read ... < /dev/tty` to reliably wait for input; plain `read` may return immediately when bash is invoked with `-c`.
- **Remote name**: Users may enter `gdrive:` (with colon) — `onRcloneRemotesLoaded` strips trailing colons before comparing.

### Debug Logging

Set `DEBUG = true` at the top of `applet.js` to enable verbose logging via `l()`. Errors use `global.logError()`.
