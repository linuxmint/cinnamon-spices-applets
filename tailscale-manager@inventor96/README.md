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
  - *Exit Node* sub-menu: select any available exit node or choose *None* to clear.
  - *Refresh Exit Nodes*: re-fetch the exit node list.
  - *Configure*: open the applet settings panel.
- **Left-click**: immediately refreshes the connection status.

## Requirements

- [Tailscale](https://tailscale.com) installed and configured (`tailscale` must be in `PATH`).
- Set the Tailscale operator to your user (e.g., `sudo tailscale set --operator $USER`).

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `update-interval` | spinbutton | 5 seconds | How often to poll Tailscale status (1–60 s). |

## Disclaimer

This applet is not affiliated with or endorsed by Tailscale. It is a third-party tool for managing Tailscale connections on Linux systems with the Cinnamon desktop environment.