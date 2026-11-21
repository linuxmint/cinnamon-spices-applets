# qBittorrent Monitor

Shows the most recently added torrent's name and progress in the Cinnamon panel, polling qBittorrent's WebUI API. Includes pause/resume and delete buttons, and a dropdown listing other active torrents.

## Requirements

- qBittorrent with the **Web UI** enabled (Tools/Options > Web UI > "Web User Interface").
- `curl` installed (present by default on virtually every distro).

## Setup

In qBittorrent: **Options > Web UI**
- Check "Web User Interface (Remote control)"
- Set an IP/port
- Set a username/password, **or**, if qBittorrent and this applet run on the same machine, check "Bypass authentication for clients on localhost" and leave the applet's username/password blank.

Then right-click the applet in the panel > **Configure...**

- **URL** — the full WebUI base URL, with scheme and no trailing slash, e.g.:
  - `http://127.0.0.1:8081` (local)
  - `https://your.domain/qbittorrent` (reverse-proxied domain, path prefix, no port)
- **Username / Password** — leave blank if using the localhost-bypass option above
- **Refresh interval** — how often to poll (seconds)
- **Panel label width** — max torrent name length shown before truncating
- **Torrents to show in the dropdown** — how many extra torrents appear in the dropdown, in addition to the one in the panel

## Using it

- The panel shows the latest torrent's name and progress, followed by a pause/resume button and a delete button.
- **Left-click** anywhere on the panel row except those two buttons to open a dropdown listing the next torrents (each with its own pause/resume and delete buttons).
- **Right-click** for the context menu: Configure, Refresh now, Open WebUI.
- Deleting a torrent always asks for confirmation first, since it can remove the downloaded files.

## Notes / limitations

- The password is stored in plain text by Cinnamon's xlet settings system — there's no masking or encryption available in the applet settings framework. Prefer the localhost-bypass option, or a qBittorrent account with limited scope, if that's a concern.
- "Latest torrent" = the most recently **added** torrent, not necessarily the one currently downloading fastest.
- If qBittorrent's WebUI isn't reachable, or login fails, the panel shows "Error" — hover over it for the reason.
