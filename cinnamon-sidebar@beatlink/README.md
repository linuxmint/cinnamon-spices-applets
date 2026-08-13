# Cinnamon Sidebar

Dock a single window to the left or right edge of a monitor at a configurable
width. Other windows are kept out of the reserved area, so a docked window
behaves like a real sidebar: the rest of the screen stays usable and nothing
covers the dock.

## Features

- **Panel button** lists every window on the current workspace. Click one to dock
  it to the configured side; click it again (marked ✓) to undock.
- **Configurable dock side** — Left or Right. Changing the side or width while a
  window is docked moves/resizes it live.
- **Configurable width** — a fraction of the monitor width, or a fixed pixel value.
- **Keyboard shortcuts** (configurable):
  - `Super+Shift+Left` — dock the focused window to the configured side
  - `Super+Shift+Down` — undock the docked window (restores its pre-dock size)
- **The docked window is locked** — it can't be moved, resized, or maximized off
  its slot. Any attempt snaps it straight back.
- **Others are kept out of the dock column** — dragging a window into the dock, or
  maximizing/tiling it, keeps it in the space *beside* the dock. You can still
  move a window partially off the opposite screen edge; only the dock edge is
  protected.
- **Maximize toggle** — maximizing another window fills the space beside the dock
  (not the whole screen). Maximizing it again restores its previous size and
  position.
- **Command-line / programmatic control** — a D-Bus service lets scripts and
  programs dock and undock windows (by focus, title, application, or window id).
  See [Command-line / programmatic control (D-Bus)](#command-line--programmatic-control-d-bus).

## Usage

1. Add **Sidebar Dock** to a panel (right-click panel → *Applets*, or
   `cinnamon-settings applets`).
2. Click the panel icon and pick a window to dock, or press the dock shortcut on
   the focused window.
3. Configure side, width, and shortcuts via the applet's settings (the gear icon
   next to it in the Applets list).

## Command-line / programmatic control (D-Bus)

The applet exports a D-Bus service so any program or script can dock and undock
windows without user interaction. Windows are always docked to the side and width
configured in the applet's settings.

- **Bus name:** `org.Cinnamon.SidebarDock`
- **Object path:** `/org/Cinnamon/SidebarDock`
- **Interface:** `org.Cinnamon.SidebarDock`

The service is on the **session** bus and is available whenever the applet is
loaded in a panel.

### Methods

| Method        | Argument      | Returns  | Description                                                                                             |
| ------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `DockFocused` | —             | `b` ok   | Docks the currently focused window. Same as the dock shortcut.                                          |
| `Undock`      | —             | `b` ok   | Undocks the docked window, restoring its pre-dock geometry. Returns`false` if nothing was docked.       |
| `DockByTitle` | `s` substring | `b` ok   | Docks the first dockable window whose title contains`substring` (case-insensitive).                     |
| `DockByApp`   | `s` wmClass   | `b` ok   | Docks the first window whose`WM_CLASS` or class instance contains `wmClass` (case-insensitive).         |
| `DockById`    | `u` xid       | `b` ok   | Docks the window with the exact X11 window id`xid` (decimal).                                           |
| `ListWindows` | —             | `s` json | Returns a JSON string describing every dockable window on the active workspace and which one is docked. |

Each `Dock*`/`Undock` method returns a boolean: `true` when it found a matching
window and acted, `false` otherwise.

`ListWindows` returns JSON of the form:

```json
{
  "dock_side": "left",
  "windows": [
    {
      "title": "Mozilla Firefox",
      "wm_class": "Navigator",
      "wm_class_instance": "firefox",
      "xid": 54525959,
      "monitor": 0,
      "docked": false
    }
  ]
}
```

### Examples

Using `gdbus` (ships with GLib):

```sh
# Dock the currently focused window
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.DockFocused

# Undock
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.Undock

# Dock the first window whose title contains "Firefox"
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.DockByTitle "Firefox"

# Dock by application (WM_CLASS) — handy right after launching an app
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.DockByApp "firefox"

# List dockable windows as JSON
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.ListWindows
```

The same calls with `dbus-send` (note the explicit argument types):

```sh
dbus-send --session --print-reply \
  --dest=org.Cinnamon.SidebarDock \
  /org/Cinnamon/SidebarDock \
  org.Cinnamon.SidebarDock.DockByApp string:"firefox"
```

**Docking by window id.** `DockById` takes a **decimal** `uint32`. `wmctrl -l`
prints ids in hex (e.g. `0x03400007`), so convert first:

```sh
# Dock a window picked by clicking it (xdotool prints a decimal id)
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.DockById "$(xdotool selectwindow)"

# From a hex wmctrl id
xid=$(printf '%d' 0x03400007)
gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.DockById "$xid"
```

**Launch an app and dock it once its window appears:**

```sh
firefox &
# wait for the window, then dock it by class
until gdbus call --session --dest org.Cinnamon.SidebarDock \
  --object-path /org/Cinnamon/SidebarDock \
  --method org.Cinnamon.SidebarDock.DockByApp "firefox" | grep -q true; do
  sleep 0.3
done
```

## How it works

Cinnamon/Muffin has no way to let a normal application window live inside a
reserved *strut*, and a window's type (e.g. `DOCK`) is set by the application and
read-only to extensions. So Sidebar Dock reserves the edge **reactively** rather
than via struts:

- The docked window is placed into a fixed slot recorded once at dock time (its
  actual size is read back afterwards, since many apps have a minimum width).
- Every other window is watched; if one moves, resizes, maximizes, or tiles so
  that it would cover the dock column, it is shrunk/shifted back into the band
  beside the dock. The clamp only protects the dock edge, so windows can still go
  off the opposite screen edge.
- A window's pre-maximize size is tracked continuously, so the maximize toggle can
  restore it exactly (Muffin's `unmaximize()` is asynchronous and can't be read in
  time otherwise).
- The docked window's own moves are reverted immediately, and interactive drags
  are settled on `grab-op-end` (Muffin owns geometry during a grab).

## Limitations

- Windows with a minimum width larger than the configured dock width will dock at
  their minimum width instead.
- The maximize toggle un-maximizes the window to fill the band, so its titlebar
  button reads *maximize* rather than *restore* — but maximizing again restores
  the previous size.
- Targets the window's current monitor and the active workspace.

## Development

The source lives in `files/cinnamon-sidebar@beatlink/`. To iterate locally, symlink
it into the applets directory and reload Cinnamon (`Alt+F2` → `r` → Enter):

```sh
ln -sfn "$PWD/files/cinnamon-sidebar@beatlink" \
    ~/.local/share/cinnamon/applets/cinnamon-sidebar@beatlink
```

Set `DEBUG = true` at the top of `applet.js` to trace geometry decisions to
`~/.xsession-errors`.
