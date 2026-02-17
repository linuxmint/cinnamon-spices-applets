# Changelog

## [1.1.0] - 2026-02-17

### Added
- ⭐ **Favorites system** — save loved wallpapers to `~/Pictures/Essentials Backgrounds`
- 📜 **History submenu** — re-apply any of the last 5 wallpapers
- 🔀 **Random provider mode** — rotates between all available providers
- 🖥️ **Auto resolution detection** — requests images matching your screen size
- 📂 **Open Cache Folder** and **Open Favorites Folder** in menu
- 🎨 **New effects**: Sepia, Saturation, Contrast
- 🌍 **Internationalization** — gettext support with pt_BR translation
- 📝 **README.md** and **CHANGELOG.md**

### Improved
- History-aware cache cleanup (protects recent wallpapers from deletion)
- Unsplash now requests max quality images (`q=100`, `fit=max`)

## [1.0.0] - 2026-02-17

### Added
- Initial release
- 5 wallpaper providers: Bing Daily, Wallhaven, NASA APOD, Picsum, Unsplash
- Configurable change interval (5–1440 min)
- Image effects: Blur, Brightness, Grayscale, Vignette
- Popup menu with wallpaper info and controls
- Pause/Resume via right-click
- Auto-start option
- Optional notifications
- Cache management (keeps 20 most recent files)
