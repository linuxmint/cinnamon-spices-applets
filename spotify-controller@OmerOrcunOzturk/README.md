# Spotify Controller

A small panel applet to launch, show and control Spotify.

## Features

- **Left click**: starts Spotify, or brings the existing Spotify window to the front (switching workspace and restoring it if minimized). A second Spotify instance is never started.
- **Right click menu**:
  - Play / Pause
  - Previous
  - Next
  - Open / Show Spotify
  - Quit Spotify
- **Tooltip**: shows the current song title and artist, or "Spotify — Closed" when Spotify is not running.
- **Monochrome panel icon** that follows the panel theme colour.
- Media items are greyed out while Spotify is not running.

## Requirements

- Spotify, installed as any of:
  - native package (`spotify-client`, `spotify.desktop`)
  - Flatpak (`com.spotify.Client`)
  - Snap (`spotify`)
- No other dependencies: media controls use Spotify's MPRIS D-Bus interface directly, `playerctl` is **not** required.

## Notes

- The installation type is detected automatically and written to the Cinnamon log (`~/.xsession-errors`, or Looking Glass → Log).
- If Spotify is not installed, the tooltip shows "Spotify — Not installed" and clicking does nothing.

## Translations

Translations are welcome. Use `po/spotify-controller@OmerOrcunOzturk.pot` as the template and add a `po/<language>.po` file.
