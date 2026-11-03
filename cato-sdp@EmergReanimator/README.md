# Cato SDP

## Summary

**Cato-SDP@EmergReanimator** is a simple Cinnamon applet that shows the
connection status of the [Cato SDP](https://www.catonetworks.com/) (Software
Defined Perimeter) Linux client in the panel, and lets you connect or
disconnect it from a popup menu.

It drives the official `cato-sdp` command-line client shipped with Cato's
Linux Client package:

  * `cato-sdp start` &mdash; Connect
  * `cato-sdp stop` &mdash; Disconnect
  * `cato-sdp status` &mdash; Poll the current connection status

The panel icon changes color according to the current state (Disconnected:
grey, Connecting: green center with a white outline, Connected: all green).
Hovering over the icon shows a tooltip with the current state and, when
connected or connecting, the connection/account name. An optional desktop
notification is shown whenever the status changes. The popup menu also has
a **Statistics** submenu with the client version, connection name, session
duration, received/sent bytes, and network settings (interface, tunnel IP,
internal IP, DNS).

## Requirements

  * The Cato Linux Client must already be installed, and the `cato-sdp`
    executable must be available (either in your `PATH`, or its full path
    configured in the applet settings).
  * You must have already completed the initial SSO authentication for your
    account (run `cato-sdp start` once from a terminal if needed, especially
    for headless/no-browser logins with `--account`/`--user`).

## Settings

  * **Status check interval** &mdash; how often (ms) the applet polls
    `cato-sdp status`.
  * **Path to the cato-sdp executable** &mdash; only needed if `cato-sdp` is
    not in your `PATH`.
  * **Show desktop notifications** &mdash; notify when the connection status
    changes.
  * **Debug mode** &mdash; logs every `cato-sdp` invocation (command, exit
    code, stdout/stderr) to Cinnamon's log, and reveals a **Copy Debug Info**
    entry in the popup menu to copy recent command history (and your
    effective `PATH`) to the clipboard for troubleshooting.

## Troubleshooting a failed connection

If "Connect" doesn't work:

  1. Enable **Debug mode** in the applet settings, then try connecting again.
  2. Open the Cinnamon log to see the exact command and its output:
     `journalctl --user -f /usr/bin/cinnamon`, or press `Alt+F2`, type `lg`,
     and check the *Errors & Warnings* tab (Looking Glass).
  3. Alternatively, click **Copy Debug Info** in the applet's popup menu and
     paste the result somewhere to inspect it.
  4. A common cause of failures is that `cato-sdp` isn't on the `PATH` that
     Cinnamon inherits (different from your terminal's `PATH`). If so, set
     the full path to the binary (e.g. `/opt/catonetworks/cato_client/cato-sdp`)
     in **Path to the cato-sdp executable**.

## Credits

Structure and async-subprocess conventions based on the
[VPN-Sentinel](https://cinnamon-spices.linuxmint.com/applets/view/VPN-Sentinel)
applet by claudiux.
