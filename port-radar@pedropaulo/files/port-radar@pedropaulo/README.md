# Port Radar

Cinnamon applet by **Pedro Paulo**. View local TCP listening sockets and UDP sockets, search by process or port, and follow recent changes.

Version **0.4.1**. Requires **Cinnamon 6.0+** and `ss` from **iproute2**. Runs as your regular user. No root access is needed.

Click the panel icon to view ports, search and filter results, or expand a port to inspect addresses and available process details. Use the detail actions to copy a port, address or PID. Expanded details stay open during updates. Right-click the icon and choose Configure to adjust refresh timing, UDP, IPv6 and the panel counter.

English, Portuguese and Spanish are included. Process details depend on system permissions. The applet only reads local socket information; it does not close processes or change your firewall.

For manual installation, place this directory in `~/.local/share/cinnamon/applets/`, then add Port Radar from System Settings → Applets. Spices handles translations when installed through Cinnamon. The source project's `install.sh` compiles them for local development.

Licensed under GPL-3.0-or-later; see the bundled LICENSE file.
