# Mint Screenshot

A modern screenshot and annotation applet for Cinnamon. Capture your screen, annotate with shapes, arrows, and text, then save or copy to clipboard — all from a single streamlined workflow.

## Why Mint Screenshot?

The default Cinnamon screenshot tool (`gnome-screenshot`) captures the screen but offers **no built-in annotation**. You have to open a separate image editor just to draw an arrow or highlight something. Mint Screenshot solves this by combining capture and annotation into one tool:

| Feature | Default Screenshot Tool | Mint Screenshot |
|---------|------------------------|-----------------|
| Fullscreen capture | ✅ | ✅ |
| Area selection | ✅ | ✅ (live preview with dimmed overlay) |
| Timed capture | ✅ (fixed delays) | ✅ (1–999s, custom countdown with floating pill) |
| Window capture | ✅ | ✅ (X11) |
 **Wayland support** | ✅ | ✅ Via XDG Desktop Portal |
| **Draw annotations** | ❌ | ✅ Rectangles, ellipses, arrows, freehand, highlights |
| **Add text** | ❌ | ✅ Resizable text with Pango rendering |
| **Crop after capture** | ❌ | ✅ Drag handles to adjust region |
| **Undo/Redo** | ❌ | ✅ Full history with Ctrl+Z/Y |
| **Color palette** | ❌ | ✅ 6 colors, adjustable line width |
| **Move/resize/rotate** | ❌ | ✅ Per-annotation context toolbar |
| **Delete annotations** | ❌ | ✅ Delete key or toolbar button |
| **HiDPI support** | Partial | ✅ Pixel-perfect on scaled displays |
| **Save format options** | PNG only | ✅ PNG, JPG, GIF with quality presets |
| **Panel integration** | No panel applet | ✅ Native Cinnamon panel applet |

## Features

* **Capture modes**: Fullscreen, area selection, and timed capture with custom countdown
* **Annotation tools**: Rectangle, ellipse, arrow, freehand draw, highlight, and text — all with adjustable color and line width
* **Non-destructive editing**: Move, resize, rotate, and delete any annotation after placing it
* **Export options**: Save to disk (PNG/JPG/GIF), copy to clipboard, or use Save As dialog
* **Quality presets**: Original, Medium, and Space Saver compression levels
* **Floating toolbar**: Adaptive Material Design toolbar that snaps between top and bottom of screen
* **Keyboard driven**: Full keyboard shortcut support (Ctrl+S, Ctrl+C, Ctrl+Z, Ctrl+Y, Delete, Escape)
* **Cross-session**: Works on both X11 and Wayland (via D-Bus XDG Desktop Portal)
* **Localization ready**: Gettext-based i18n with included translations

## Requirements

* **Cinnamon 4.0+** (Cinnamon 6.0+ recommended)
* Python 3
* GTK 3 (`python3-gi`, `python3-gi-cairo`, `python3-cairo`)
* Pillow (`python3-pil`) for icon processing
* X11: `gir1.2-wnck-3.0` for window detection
* Wayland: `python3-dbus` for portal support

On Linux Mint / Ubuntu, install dependencies with:
```
sudo apt install python3-gi python3-gi-cairo python3-cairo python3-pil gir1.2-wnck-3.0
```

> **Note**: The applet will check for missing dependencies on first launch and show you exactly which packages to install.

## Installation

1. Right-click on the Cinnamon panel and click **Applets**
2. Go to the **Download** tab and search for **Mint Screenshot**
3. Click **Install**
4. Switch to the **Manage** tab and add **Mint Screenshot** to your panel

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save screenshot (opens Save As dialog) |
| `Ctrl+C` | Copy to clipboard |
| `Ctrl+Z` | Undo last annotation |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo |
| `Delete` | Remove selected annotation |
| `Escape` | Exit the tool |

## Feedback

You can leave a comment on [cinnamon-spices.linuxmint.com](https://cinnamon-spices.linuxmint.com) or create an issue on the development repository:

https://github.com/khumnath/mint-screenshot

If you find this applet useful, please consider leaving a rating — it helps others discover it.
