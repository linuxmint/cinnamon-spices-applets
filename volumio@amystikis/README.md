# Volumio Remote

Control a Volumio instance on your network from the Cinnamon panel.

## Features

- Panel icon with the current track title (optional, length adjustable)
- Popup with album art, title, artist and album
- Previous / play-pause / stop / next
- Volume: slider, volume down/up, mute, percentage; scroll over the panel icon to change the volume
- Song search (songs, artists, albums) with one-click play
- Web radio station list (My Web Radios or all radio categories) with one-click play
- Middle-click the panel icon to play/pause
- If Volumio has no real artwork (typical for web radio), the cover is looked up
  from the artist and song title, with strict matching so a wrong cover is rejected.
  If the artist is empty or "no name", "Artist - Song" titles are split and used instead.
  The source is a setting: MusicBrainz / Cover Art Archive first with iTunes as backup
  (default), MusicBrainz / Cover Art Archive only (open data), iTunes only, or off.

## Setup

1. Add the applet to a panel.
2. Open its settings and enter the IP address or host name of your Volumio
   (for example `192.168.1.50` or `volumio.local`).

## Requirements

- A Volumio instance reachable from this computer (uses Volumio's REST API on port 80)
- `curl` (installed by default on Linux Mint)

Artwork lookups use the open MusicBrainz database and Cover Art Archive
(`musicbrainz.org`, `coverartarchive.org`) and, optionally, the public iTunes Search API
(`itunes.apple.com`). They are only made when Volumio does not provide a cover.
