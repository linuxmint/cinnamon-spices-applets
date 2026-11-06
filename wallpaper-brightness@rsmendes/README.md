# ☀️ Wallpaper Brightness (Cinnamon Applet)

Desktop panel applet for the **Cinnamon Desktop Environment (Linux Mint 22.3)** that allows you to easily adjust and dim your desktop wallpaper directly from the panel.

Perfect for when you have beautiful wallpapers that are otherwise too bright and cause eye fatigue or reduce icon readability.

---

## 🚀 Features

- **Brightness Slider:** Fine-tune brightness from 10% to 100% in real time.
- **Mouse Scroll on Icon:** Quickly adjust brightness in 5% increments simply by scrolling your mouse wheel over the panel icon.
- **Quick Presets:**
  - ☀️ 100% — Original
  - 🌤️ 75% — Comfortable
  - ⛅ 50% — Medium / Soft
  - 🌙 30% — Dark / Night
- **Original File Preservation:** Never touches your original images. Generates a dimmed version in cache (`~/.cache/wallpaper-brightness/`) and applies it via Cinnamon GSettings.
- **Zero-Clutter Cache Management:** The cache directory keeps at most **1 single file** on disk (always overwriting and removing previous slots). When set to 100% (Original), the cache directory is completely emptied.
- **Automatic Sync:** If you change your wallpaper in Cinnamon Settings or through a slideshow, the applet detects it and automatically preserves your chosen brightness level on the new wallpaper.
- **Quick Settings Shortcut:** One-click access to Cinnamon's _Background Settings_ dialog.

---

## 🛠️ Installation

### Via Cinnamon Settings
1. Open **System Settings** → **Applets**.
2. Click the **Download** tab.
3. Search for **Wallpaper Brightness** and click **Install**.
4. Return to the **Manage** tab, select **Wallpaper Brightness**, and click **+** to add it to your panel.

### Manual Installation (Development)
Link or copy the applet folder into your local applets directory:

```bash
ln -s "$(pwd)/files/wallpaper-brightness@rsmendes" ~/.local/share/cinnamon/applets/wallpaper-brightness@rsmendes
```

Then enable it from **System Settings** → **Applets**.

---

## ⌨️ CLI Usage (Optional)

You can also adjust wallpaper brightness directly via the command line using `dimmer.py` located in the applet folder:

```bash
# Set brightness to 60%
./dimmer.py --set 60

# Check current brightness
./dimmer.py --get

# Restore to 100% (original image)
./dimmer.py --reset
```
