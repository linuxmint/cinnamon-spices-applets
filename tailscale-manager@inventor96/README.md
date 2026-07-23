# Tailscale Manager

## Summary

A Cinnamon applet that monitors and manages your Tailscale connection. Displays a tray icon indicating Tailscale's status, including the active exit node if one is in use.

## Features

- **Status monitoring**: Periodically polls `tailscale status --json` to detect connection state and active exit node.
- **Visual quick status**:
  - Grey lock icon: Tailscale is stopped/disconnected.
  - Green lock icon: Tailscale is connected.
  - Blue lock icon: Tailscale is connected and routing through an exit node.
- **Right-click context menu**:
  - *Tailscale Up* / *Tailscale Down*: toggle the Tailscale daemon.
  - *Accept Routes* toggle: enable or disable accepting routes advertised by other Tailscale nodes.
  - *Exit Node* sub-menu: select any available exit node or choose *None* to clear.
  - *Refresh Exit Nodes*: re-fetch the exit node list.
  - *Configure*: open the applet settings panel.
- **Left-click**: immediately refreshes the connection status.

## Requirements

- [Tailscale](https://tailscale.com) installed and configured (`tailscale` must be in `PATH`).
- Set the Tailscale operator to your user (e.g. `sudo tailscale set --operator $USER`).

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `update-interval` | spinbutton | 5 seconds | How often to poll Tailscale status (1–60 s). |

## Notes

- **Accept Routes detection**: The *Accept Routes* toggle uses `tailscale debug prefs` to detect the current state of the `--accept-routes` setting. This is an unstable debug command according to `tailscale debug --help`. If the command fails or returns unexpected output, the toggle will show a "Cannot detect accept-routes" message. The applet continues to function normally in this state, and toggling will still run `tailscale set --accept-routes` regardless of detection success. There's an open issue on the Tailscale GitHub repository regarding exposing the accept-routes setting in a stable way: [tailscale issue #15654](https://github.com/tailscale/tailscale/issues/15654).

## Disclaimer

This applet is not affiliated with or endorsed by Tailscale. It is a third-party tool for managing Tailscale connections on Linux systems with the Cinnamon desktop environment.