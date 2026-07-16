# Codex Monitor

Codex Monitor puts Codex quota, reset windows, session activity, and Remote Control status in the Cinnamon panel, so you can check Codex without opening a terminal.

The compact panel view shows 5-hour and weekly usage at a glance. Open the dashboard for exact reset countdowns, clear warning text, 24-hour to 30-day history, banked resets, recent and active sessions with current-turn elapsed time, Remote Control pairing and a live connected-device list, confirmed recovery of a verified stale Remote service, and safe Codex update checks.

The dashboard adapts to the available display work area, keeping the full view on wide screens and stacking cards and actions cleanly on narrow layouts.

## Requirements

- Cinnamon 6.0–6.6; live tested on Cinnamon 6.6
- Python 3.10 or newer
- The Codex CLI available as `codex`

All usage history stays local. The applet talks to the official local Codex app server and its user-owned Unix control socket. Active-session detection is limited to bounded metadata from matching same-user Codex processes and never reads session contents or command lines. The applet does not read authentication files or expose a TCP network port.
