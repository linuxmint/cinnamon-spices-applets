# Mouse Trail

Mouse Trail highlights pointer movement, clicks, and keystrokes for screen
recordings on Cinnamon/X11. The overlay is click-through. Press the configured
hotkey to hide or show it; the default is the backtick key. Right-click the
panel icon and choose **Configure…** to adjust its appearance and hotkey.

Requires Python 3, GTK 3 with PyGObject, `python3-xlib`, X11 with the X RECORD
extension, and a compositor. On Linux Mint, install missing system packages
with the distribution package manager.

**Privacy:** Keystrokes, including passwords, are displayed on screen while
the overlay is active. Hide it before typing sensitive information on a
recording. The hotkey is observed rather than grabbed, so it also reaches the
focused application.

Only one overlay runs per user and X display. The applet and its Python helper
are packaged together; no extra download is needed.
