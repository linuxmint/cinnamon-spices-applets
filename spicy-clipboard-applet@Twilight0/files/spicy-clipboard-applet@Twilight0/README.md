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
*   `yad` (required for history list management and item editing).
*   `xclip` (required for image processing and clipboard query compatibility under X11).
*   `xdotool` or `dotool` (optional, for the "Auto-Paste on click" function).

## Planned Feature Updates
*   **Search & Filter Bar**: A search entry at the top of the list to filter items dynamically as you type.
*   **Pinned Items**: Ability to star/pin favorite items to keep them at the top and exempt them from history limits.
*   **Item Editing**: Direct inline editing of text entries in the history list (activated via middle-click).

## Planned Bug Fixes
*   **Middle/Right-Click Activation Bug**: Intercept the `button-release-event` for middle (button 2) and right (button 3) clicks to prevent default menu item activation from triggering on mouse-up (which currently causes deleted/edited items to re-activate and move back to the top of the list).


