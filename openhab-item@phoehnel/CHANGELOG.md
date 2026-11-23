# Changelog

## 1.1.0

- ⏱️ Auto-close popup menu after configurable timeout (default 10s)
- 🖱️ Scroll-wheel dimmer control directly on the panel (auto-populated for Dimmer items)
- 🔒 Read-only mode to disable all controls
- 🎨 Configurable color swatch dimensions and option to hide brightness % from panel
- 🛠️ Cinnamon Spices best practices (GLib.SOURCE_REMOVE, proper timer cleanup)
- 🐛 Fixed color swatch stretching to full panel height
- 🐛 Fixed scroll-wheel not sending commands on sliders
- 📄 Added CONTRIBUTING.md with development setup guide

## 1.0.0

- 🏠 Display any standard OpenHAB item on the panel (Switch, Dimmer, Number, String, Contact, Rollershutter, Color, DateTime, Player, Group)
- 🔁 Multi-instance support — add the applet multiple times for different items
- 🔗 Shared server configuration across instances via `~/.config/` with Gio.FileMonitor
- 👆 Double-click toggle for Switch/Dimmer items (configurable)
- ➕ Additional items in popup menu (e.g. lamp + brightness slider together)
- 📌 Popup menu stays open during interaction
- 🎨 Custom icons per instance
- 💬 Configurable tooltip fields
- 📐 stateDescription pattern formatting (e.g. `%.1f °C`)
- 🌈 Color items with live color swatch on panel and brightness slider in popup
- 📅 DateTime items with Java-style stateDescription patterns
- 🎛️ Dimmer ON/OFF toggle (configurable, default off)
