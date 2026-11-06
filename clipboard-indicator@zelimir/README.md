# Clipboard Indicator

Clipboard history for the Cinnamon panel: text and images, search, pinning, tags,
editing, private mode, keyboard shortcuts and pasting straight from the menu.

A port of the GNOME Shell extension
[Clipboard Indicator](https://github.com/Tudmotu/gnome-shell-extension-clipboard-indicator)
by Yotam Bar-On. Works on Wayland and X11 and needs no extra packages.

## Features

- Text and image history (PNG, JPEG, GIF, WebP, BMP, SVG; HTML when there is no plain text)
- Search, optionally case-sensitive or with regular expressions; tags are searched too
- Pin items, tag them, edit text entries, preview images full screen
- Paste from the menu: the item is typed into the focused window
  (Shift+Insert, or Ctrl+Shift+V in terminals)
- Private mode, excluded applications (by WM_CLASS), and secrets that password
  managers mark with `x-kde-passwordManagerHint` are never recorded
- Automatic clearing on an interval (with a countdown in the menu) or after every reboot
- Notifications on copy (with "Undo"), when cycling and when clearing
- Panel shows an icon, the current clipboard content, both, or nothing (shortcut only)

## Keyboard shortcuts

Global (configurable):

| Shortcut | Action |
| --- | --- |
| Ctrl+F9 | Open / close the menu |
| Ctrl+F10 | Clear history |
| Ctrl+F11 / Ctrl+F12 | Previous / next item |
| Ctrl+F8 | Toggle private mode |

In the menu: arrows to move, Enter to select, Delete to delete, `v` paste,
`p` pin, `t` tag, `e` edit text, `h` preview image.

To stop recording copies from an application (e.g. a password manager),
right-click the applet while that application has focus and choose
"Don't record from: ...".

## Data

The history is kept in `~/.local/state/clipboard-indicator@zelimir/`
(only readable by you). Turn on "Only save pinned items to disk" to keep the
rest of the history in memory only.

## Differences from the GNOME extension

- Clearing after reboot keeps pinned items.
- Hovering over items doesn't take focus away from the search field.
- Images are compared by their pixels, so a re-encoded copy of the same picture
  is not added twice.
