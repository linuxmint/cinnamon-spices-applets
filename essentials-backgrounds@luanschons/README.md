# Essentials Backgrounds

> By **Luan Schons Griebler** — [luan@twizer.com.br](mailto:luan@twizer.com.br)
> 🔗 [GitHub Repository](https://github.com/Luan1Schons/cinnamon-essentials-backgrounds)

## ✨ Features

- **5 Wallpaper Sources**: Bing Daily, Wallhaven, NASA APOD, Picsum, Unsplash
- **🔀 Random Mode**: Automatically rotates between all providers
- **⭐ Favorites**: Save wallpapers you love to `~/Pictures/Essentials Backgrounds`
- **📜 History**: Re-apply any of your last 5 wallpapers
- **🎨 Image Effects**: Blur, Brightness, Saturation, Contrast, Grayscale, Sepia, Vignette
- **🖥️ Auto Resolution**: Detects your screen resolution for optimal image quality
- **🌍 Internationalization**: English and Brazilian Portuguese (pt_BR)
- **⏸️ Pause/Resume**: Right-click to pause or resume automatic changes
- **🔔 Notifications**: Optional notifications when wallpaper changes

## 📦 Installation

1. Copy the `essentials-backgrounds@luanschons` folder to `~/.local/share/cinnamon/applets/`
2. Right-click your Cinnamon panel → **Applets** → find "Essentials Backgrounds" → **Add to Panel**

## 🔧 Requirements

- **Cinnamon Desktop** (Linux Mint, etc.)
- **ImageMagick** (for effects) — `sudo apt install imagemagick`

## 🖱️ Usage

| Action | Result |
|--------|--------|
| **Left-click** | Opens menu with options |
| **Right-click** | Pause/Resume + Cinnamon options |

### Menu Options

- **Change Background Now** — Fetch a new wallpaper immediately
- **Save to Favorites** — Copy current wallpaper to favorites folder
- **History** — Re-apply a recent wallpaper
- **Open Cache / Favorites Folder** — Browse downloaded images
- **Settings** — Configure provider, interval, effects

## 🌐 Translations

To add a new language, copy the `.pot` file in the `po/` directory:

```bash
cd ~/.local/share/cinnamon/applets
cp essentials-backgrounds@luanschons/po/essentials-backgrounds@luanschons.pot \
   essentials-backgrounds@luanschons/po/xx.po
# Edit xx.po with your translations, then:
cinnamon-xlet-makepot essentials-backgrounds@luanschons --install
```

## 📝 License

MIT License — © 2026 [Luan Schons Griebler](https://github.com/Luan1Schons)
