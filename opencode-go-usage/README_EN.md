<p align="center">
  <img src="icon.png" width="64" alt="OpenCode GO Usage">
</p>

<h1 align="center">OpenCode GO Usage</h1>

<p align="center">
  <b>Cinnamon Applet</b> — monitor your OpenCode GO subscription limits
</p>

<p align="center">
  <img src="https://img.shields.io/badge/linuxmint-Cinnamon-87cf3e?logo=linuxmint">
  <img src="https://img.shields.io/badge/version-1.0-blue">
  <img src="https://img.shields.io/badge/license-GPL--3.0-green">
  <img src="https://img.shields.io/badge/GJS-ES6-yellow">
</p>

> **[Русская версия](README.md)**

---

Panel applet for Cinnamon that displays OpenCode **GO** subscription usage limits. Does NOT work with OpenCode ZEN.

Shows an icon on the panel, stats in a popup menu on click, and supports notifications on limit reset.

## Installation

```bash
mkdir -p ~/.local/share/cinnamon/applets/opencode-go-usage@clrblind
cp applet.js metadata.json settings-schema.json icon.png \
  ~/.local/share/cinnamon/applets/opencode-go-usage@clrblind
```

Restart Cinnamon: `Alt+F2` → `r` → Enter.

Add to panel: right-click the panel → `Add to panel` → `OpenCode GO Usage`.

## Getting Credentials

1. Open `https://opencode.ai/auth` in your browser
2. Sign in to your account
3. After redirect, copy `wrk_...` from the address bar
4. Extract the `auth` cookie (F12 → Application/Cookies → `opencode.ai`)
5. Paste both values into the applet settings

## Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `workspace_id` | entry | — | Workspace ID (`wrk_...`) |
| `auth_cookie` | entry | — | `auth` cookie from browser |
| `update_interval` | spinbutton | 30 | Update interval (sec) |
| `show_notifications` | checkbox | false | Notify on limit reset |

**Font:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `monospace` | checkbox | true | Monospace font |
| `font_family` | combobox | sans-serif | Font family (when monospace off) |
| `font_size` | spinbutton | 11 | Font size (pt) |
| `font_color` | colorchooser | — | Font color |

## How It Works

```
curl --cookie "auth=..." https://opencode.ai/workspace/.../go
         │
         ▼
   sed pipeline — parse HTML → Rolling Usage | 34% | Resets in: 2h
         │                      Weekly Usage  | 100% | Resets in: 1d
         ▼                      Monthly Usage | 63%  | Resets in: 3d
   PopupMenu — 3 lines in popup
   _checkResets — notify on >0 → 0
```

### Parsing

1. `tr -d '\n'` — flatten HTML to single line
2. Split by `data-slot="usage-item"`
3. regex — extract label / percentage / reset time
4. `awk` — column alignment

### Notification Anti-Flood

Notification fires **only** on transition >0 → 0. While limit stays at 0 — silence. As soon as it goes above 0 — the block resets.

## Files

| File | Purpose |
|------|---------|
| `applet.js` | Core logic |
| `settings-schema.json` | Settings schema |
| `metadata.json` | Applet metadata |
| `icon.png` | Panel icon |
| `stats.png` | Stats popup screenshot |
| `settings.png` | Settings screenshot |

## Tech Stack

- **Language:** GJS (GNOME JavaScript, ES6)
- **UI:** St (Cinnamon toolkit), Clutter, Pango
- **Assembly:** `imports.ui.applet`, `GLib`, `Gio`
- **Parsing:** curl + sed + awk

## License

GPL-3.0 © clrblind 2026

---

<p align="center">
  <a href="README.md">Русская версия</a> •
  <a href="https://github.com/clrblind/opencode-go-usage">GitHub</a>
</p>
