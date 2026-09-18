# Spotify Control

Control Spotify playback from the panel: previous, play/pause, next, and a favorites button — with cover art, title and artist shown on hover.

## Features

- **Previous / Play-pause / Next** via Spotify's MPRIS interface (D-Bus), no external dependency such as `playerctl`.
- **Hover tooltip**: shows the album cover art, title and artist of the current track.
- **Favorites button (★)**: adds or removes the current track from your Spotify "Liked Songs", using Spotify's official Web API (OAuth). Can be turned off from the applet's settings if you don't need it.
- If Spotify isn't running, clicking any button launches it.

## Requirements

- The official Spotify client installed (`/usr/bin/spotify`).
- `curl`, `wget`, `openssl`, `xdg-open` (present by default on most installations).

## Setting up the favorites button (optional)

The favorites button needs a one-time OAuth authorization with Spotify (free, a couple of minutes):

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an application.
2. In the application's settings, add the following redirect URI:
   ```
   http://127.0.0.1:43127/callback
   ```
3. Copy the application's **Client ID**.
4. Right-click the applet → **Configure**, paste the Client ID.
5. Click **Connect to Spotify**: your browser opens to authorize the application, then closes automatically.

Without this setup, the applet works normally for playback (previous/pause/next/cover art); only the favorites button stays inactive.

## Source

https://github.com/ghislaingaillot/cinnamon-spotify-applet
