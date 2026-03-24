# cinnamon-spice-openhab

Cinnamon panel applet to display and control OpenHAB smart home items.

## Guidelines

The Cinnamon Spices contributor guidelines MUST be followed:
- https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md
- https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/copilot-instructions.md

Key rules from those guides:
- Never write to the installation directory (`metadata.path`) — use `GLib.get_user_config_dir()` / `GLib.get_user_state_dir()` / `GLib.get_user_cache_dir()`
- Clean up all timers and signal handlers in `on_applet_removed_from_panel()`
- Use `GLib.SOURCE_REMOVE` / `GLib.SOURCE_CONTINUE` for timer return values
- Use `Clutter.EVENT_STOP` / `Clutter.EVENT_PROPAGATE` for event handlers
- No synchronous network calls — use async Soup APIs
- No compiled code, binaries, or minified JS
- JS must be compatible with SpiderMonkey 102+ (Linux Mint Cinnamon)

## Architecture

- **UUID**: `openhab-item@phoehnel`
- **applet.js**: Main `TextIconApplet` class — settings binding, polling, panel display (incl. color swatch), popup menu, double-click toggle, scroll-wheel dimmer
- **httpClient.js**: Soup 2/3 compatible HTTP GET/POST with Bearer auth
- **serverConfig.js**: Shared server config in `$XDG_CONFIG_HOME/UUID/server.json` with `Gio.FileMonitor` for cross-instance sync
- **itemRenderers.js**: Per-type icons, state formatting (printf patterns, Java date patterns, HSB→hex), popup menu controls (keeps menu open, debounced sliders)
- **settings-schema.json**: 3 pages (Server, Item, Display) with per-instance settings

## Resources

- Cinnamon Spices repo: https://github.com/linuxmint/cinnamon-spices-applets
  - Reference popular applets like `Weather@mockturtl` and `Cinnamenu@json` for best practices
- OpenHAB docs: use context7 MCP with libraryId `/openhab/openhab-docs`
  - context7 also works for Cinnamon and other library docs
- OpenHAB Basic UI (no auth): http://<OPENHAB IP>:8080/basicui/app
  - You'll have to ask user for the IP
