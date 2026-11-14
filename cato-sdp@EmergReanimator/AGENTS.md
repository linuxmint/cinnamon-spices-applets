# AGENTS.md — cato-sdp@EmergReanimator

Guidance for any AI coding agent (or human contributor) working on this
Cinnamon applet. This file is vendor-neutral: it does not assume a specific
AI tool, model, or session format.

## What this project is

A Cinnamon **applet** that wraps the `cato-sdp` CLI (Cato Networks SDP Linux
client) with `start` / `stop` / `status` commands, modeled after the
`VPN-Sentinel@claudiux` applet in this same repository. It lives in:

```
cato-sdp@EmergReanimator/
├── AGENTS.md              <- this file
├── CHANGELOG.md
├── README.md
├── info.json
├── screenshot.png
└── files/cato-sdp@EmergReanimator/   <- actual installed applet payload
    ├── applet.js          <- core logic
    ├── metadata.json      <- bump "version" on every user-visible change
    ├── settings-schema.json
    ├── stylesheet.css
    ├── icon.svg / icon.png
    ├── icons/cato-sdp-{disconnected,connecting,connected}.svg
    └── po/cato-sdp@EmergReanimator.pot
```

Only `files/cato-sdp@EmergReanimator/` is installed to a user's system (e.g.
`~/.local/share/cinnamon/applets/cato-sdp@EmergReanimator/`). Never put
agent-only notes or scratch files inside that `files/` subtree — they would
ship as part of the applet.

## Current state

Feature-complete as of v1.3.0: panel shows a custom state icon only (no text
label), hovering shows a tooltip with the connection name, and the popup
menu has a Statistics submenu (version, connection name, duration, rx/tx
bytes, network settings). Treat this as a stable baseline — don't rework
icons, tooltip, or Statistics layout speculatively. Wait for a concrete bug
report or feature request before changing behavior.

## Key implementation details (`applet.js`)

- Polls `cato-sdp status` on an interval. `_checkStatus()` runs the command;
  `_parseStatus()` determines connection state (disconnected / connecting /
  connected); `_parseDetails(text)` extracts fields via regex into
  `this.details`: version, popName, popAddress, tunnelIp, internalIp, dns1,
  dns2, tunDevice, duration, account, user, rxBytes, txBytes (with a
  human-readable parenthetical like `(3.5Mb)` when the CLI includes one).
- `_setState()` runs every poll regardless of whether the state changed, and
  always calls `_updateView()` so Statistics values (duration, rx/tx) stay
  fresh even while the state itself is unchanged.
- `_updateView()` updates the panel icon/style and the status popup-menu
  item, then calls `_updateTooltip()` and `_updateStatistics()`. It does
  **not** call `set_applet_label()`; `this.hideLabel()` is called once in the
  constructor so the panel is icon-only.
- `_updateTooltip()` builds: state label, plus `(connection name)` appended
  only when connecting/connected. Connection name = `details.account` if
  present, else `details.popName`. This is a **best-effort assumption** — the
  `cato-sdp status` output has no single explicit "connection name" field. If
  a user reports the tooltip shows the wrong value, revisit this mapping.
- The Statistics submenu (`PopupMenu.PopupSubMenuMenuItem`, `this.statsItem`)
  has non-reactive `PopupMenuItem` children: Version, Connection, Duration,
  Received (RX), Sent (TX), a separator, then Interface, Tunnel IP, Internal
  IP, DNS. Missing values render as an em-dash `—` placeholder.
- Panel icons are hand-authored SVGs (no rasterizer is assumed available):
  grey = disconnected, white outline + green fill = connecting, solid green
  = connected. Don't regenerate these without a specific request.
- `hideLabel()` / `showLabel()` are standard `Applet.TextIconApplet` base
  class methods (also used by other unrelated stock/community applets) —
  no need to reimplement or search for this in VPN-Sentinel's source.

## Validation workflow (run before considering any change done)

```bash
# 1. Syntax check
cd files/cato-sdp@EmergReanimator
node --check applet.js

# 2. Authoritative spice-package validator (run from repo root)
cd ../..
python3 validate-spice cato-sdp@EmergReanimator

# 3. Regenerate translations after adding/changing any _("...") string
cd cato-sdp@EmergReanimator/files/cato-sdp@EmergReanimator
xgettext --from-code=UTF-8 -L JavaScript -k_ -kN_ \
  -o po/cato-sdp@EmergReanimator.pot applet.js

# 4. Bump metadata.json "version", add a CHANGELOG.md entry, and update
#    README.md's feature description when behavior changes.

# 5. Re-sync to a local test install and have the user reload Cinnamon
rsync -a --delete files/cato-sdp@EmergReanimator/ \
  ~/.local/share/cinnamon/applets/cato-sdp@EmergReanimator/
# then: Alt+F2 -> r -> Enter (X11) to restart Cinnamon, or log out/in (Wayland)
```

## Repository-wide conventions to respect

This applet lives in the `linuxmint/cinnamon-spices-applets` monorepo, which
has review rules that apply here too:

- Never modify or add files outside this applet's own directory.
- No compiled/runtime-generated source (`.c`, `.cpp`, etc.), no binaries or
  libraries, no compiled translation (`.mo`) files, no minified JS/CSS.
- Never write runtime data (logs, caches, JSON state) inside the applet's own
  install directory — it's overwritten on update. Use
  `GLib.get_user_state_dir()` / `GLib.get_user_cache_dir()` plus the UUID, or
  the Xlet Settings API, if persistent data is ever needed (not currently
  used by this applet).
- Never modify `settings-schema.json` at runtime; use the Settings API.
- Disconnect any GObject signal handlers and cancel any timers in
  `on_applet_removed_from_panel()` if either is ever added.
- Translatable strings should be full sentences using printf-style tokens
  (e.g. `_("Alarm for %s was deleted.").format(name)`), not concatenated
  fragments.
- Avoid synchronous I/O (file, network, subprocess, dbus) where an async API
  is available.
- Target JavaScript engine compatibility: SpiderMonkey 102 / 115 / 128 / 140
  (Mint / LMDE, current and upcoming) — avoid syntax newer than these
  support.

## Housekeeping

Do not commit AI-session export files, scratch notes, or planning documents
into this applet's directories. If any appear (e.g. from an accidental
`/export`-style command), delete them before committing.
