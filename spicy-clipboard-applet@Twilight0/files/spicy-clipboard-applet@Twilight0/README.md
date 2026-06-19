# Spicy Clipboard Manager

A lightweight, feature-rich clipboard history manager applet for the Cinnamon desktop environment.

## Features
*   **Persistent History**: Saves clipboard history securely to a custom data file (`history.dat`) to prevent Cinnamon setting manager conflicts.
*   **Auto-Paste & Paste Tools**: Supports automatic pasting of selected history items using popular backend utilities like `xdotool` or `dotool`.
*   **Image Support**: Captures and displays thumbnails of copied image contents (stored cleanly under your user cache/config path).
*   **Custom Notifications**: Desktop alerts notifying you when text or images are successfully monitored and added.
*   **Configurable Height**: Customize the maximum height of the clipboard history dropdown list via the applet settings (prevents list from extending beyond the visible workspace).

## Configuration
The following settings can be configured via the Cinnamon applet settings dialog:
*   **Clipboard History Size**: Adjust the number of stored clipboard items (5 to 100).
*   **Menu Max Height**: Set the maximum height (150px to 800px) of the dropdown list before it scrolls.
*   **Auto-Paste on Selection**: Toggle automatically pasting items upon clicking them in the menu.
*   **Input Simulation Tool**: Select the simulation tool (`xdotool`, `dotool`, or none) for auto-pasting.
*   **Notification on Copy**: Show a notification banner when a new item is captured.

## Requirements
*   `xclip` (required for image processing and clipboard query compatibility under X11).
*   `xdotool` or `dotool` (optional, for the "Auto-Paste on click" function).
