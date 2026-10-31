# ScreenJourney

Panel applet for screenshots and screen recordings of a selected area or the whole screen (X11).

- **Click** the panel icon (or press `Super+Shift+S`) to open the overlay. Click again while recording to stop.
- **Middle-click** takes a screenshot of the entire screen.
- **Right-click** for quick actions: full-screen screenshot or recording, open the last capture, open the output folders.

## Overlay

Drag to select an area, then drag inside it to move it or drag a handle to resize it. A single click selects the screen under the pointer.

| Key | Action |
| --- | --- |
| Enter / Space / double-click | Capture or start recording |
| Esc / right-click | Cancel (right-click clears the selection first) |
| S / R | Screenshot / record mode |
| F / A | Current screen / all screens |
| D | Cycle the delay (off, 3, 5, 10 s) |
| P / M | Pointer on/off, audio source (record mode) |
| Arrows | Move the selection (Shift: by 10 px, Ctrl: resize) |

Screenshots are saved as PNG to `Pictures/Screenshots` and copied to the clipboard. Recordings go to `Videos/Screencasts` as MP4 (H.264) or WebM (VP9), with optional microphone or desktop audio. Folders, format, frame rate and defaults can be changed in the applet settings.

## Requirements

- `ffmpeg` (with x11grab and pulse support)
- `python3-gi` / `python3-gobject` with GTK 3
- `xclip`
- `notify-send` (`libnotify-bin`)

On Linux Mint / Debian / Ubuntu:

    sudo apt install ffmpeg python3-gi gir1.2-gtk-3.0 xclip libnotify-bin

The applet works on X11 sessions only.
