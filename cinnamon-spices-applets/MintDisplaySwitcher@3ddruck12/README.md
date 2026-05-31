# Display Switcher — Cinnamon Applet

Win+P-ähnlicher Anzeigemodus-Wechsler für Linux Mint (Cinnamon). Schaltet per xrandr zwischen Laptop, externem Bildschirm, Spiegeln und Erweitern um.

## Features

- Panel-Icon mit **dynamischem Modus-Icon** (Laptop / Monitor / Spiegeln / Erweitern)
- Popup-Menü mit vier Anzeigemodi
- **Automatische Display-Erkennung** (z. B. `eDP-1`, `HDMI-1`)
- **Letzten Modus speichern** und beim Anstecken automatisch anwenden
- **Super+P** Tastenkürzel (konfigurierbar)
- **Hotplug:** reagiert auf An-/Abstecken von Beamer/Monitor
- **Wayland-vorbereitet:** Backend-Abstraktion; v1 voll unter X11

## Voraussetzungen

- Linux Mint 22.x mit Cinnamon 6.x (getestet: Mint 22.3 / Cinnamon 6.6.7)
- `xrandr` (Paket `x11-xserver-utils`, in Mint vorinstalliert)
- X11-Session für vollständige Umschalt-Funktion

## Installation

```bash
cp -r MintDisplaySwitcher@3ddruck12 ~/.local/share/cinnamon/applets/
```

Cinnamon neu laden: **Alt+F2** → `r` → Enter

Applet hinzufügen: **Systemeinstellungen → Applets → Display Switcher** zum Panel ziehen

## Nutzung

| Aktion | Ergebnis |
|---|---|
| Klick auf Panel-Icon | Menü mit vier Modi öffnen |
| **Super+P** | Menü öffnen (Win+P-äquivalent) |
| Modus wählen | xrandr-Umschaltung + Benachrichtigung |
| Beamer anschließen | Gespeicherter Modus wird automatisch angewendet |
| Beamer trennen | Optional: zurück auf Nur-Laptop |

### Applet-Einstellungen

**Drei Wege zum Einstellungsmenü:**

1. Im Popup-Menü: **„Einstellungen…“** (unten)
2. Rechtsklick auf das Applet → **„Konfigurieren…“**
3. Systemeinstellungen → Applets → Display Switcher → Zahnrad

**Konfigurierbar:**

| Einstellung | Beschreibung |
|---|---|
| Tastenkürzel Menü öffnen | Standard: Super+P |
| Tastenkürzel pro Modus | Laptop / extern / Spiegeln / Erweitern (optional) |
| Auto-Apply beim Anstecken | Gespeicherter Modus automatisch |
| Beim Trennen: Nur Laptop | Beamer ab → Laptop-Modus |
| Position beim Erweitern | rechts / links / oben / unten |
| Bevorzugter externer Anschluss | z. B. `HDMI-1` wenn Auto-Erkennung falsch liegt |

Leere Tastenkürzel-Felder = Shortcut deaktiviert.

## Projektstruktur

```
MintDisplaySwitcher@3ddruck12/
├── metadata.json
├── applet.js              # UI, Settings, Hotplug
├── displayBackend.js      # Factory X11/Wayland
├── displayInfo.js         # Datenmodell + Modus-Erkennung
├── x11Backend.js          # xrandr (voll)
├── waylandBackend.js      # Stub (Status lesen)
├── settings-schema.json
└── stylesheet.css
```

## Bekannte Einschränkungen

- **v1 voll unter X11** — Standard-Session unter Mint 22.3
- **Wayland experimentell** — Applet lädt und zeigt Status; Umschalten öffnet Anzeige-Einstellungen
- **cinnamon-settings-daemon** kann gelegentlich Einstellungen aus `~/.config/monitors.xml` zurücksetzen
- **Ein externes Display** — bei mehreren Ports wird das erste verbundene gesteuert
- **Super+P** kann mit anderen Shortcuts kollidieren — in den Applet-Einstellungen änderbar

## Wayland-Roadmap

1. **Phase 1 (v1):** Backend-Abstraktion + Wayland-Stub
2. **Phase 2:** `monitors.xml`-Generierung + Settings Daemon
3. **Phase 3:** Native Muffin-API in Cinnamon GJS

## Testen

1. Applet installieren und zum Panel hinzufügen
2. Nur Laptop: Icon = Laptop, externe Modi deaktiviert
3. Beamer anschließen: Auto-Apply des gespeicherten Modus
4. Modus „Spiegeln“ wählen: Icon wechselt, Benachrichtigung erscheint
5. **Super+P** drücken: Menü öffnet sich
6. Beamer trennen: optional zurück auf Nur-Laptop

## Lizenz

Freie Nutzung und Anpassung.
