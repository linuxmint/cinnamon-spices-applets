# Changelog

All notable changes to the **Live Wallpaper Applet** (`CinnamonLiveWallpaper@bhavin-viramgama`) will be documented in this file.

## [1.0.0] - 2026-08-15

### Added
- **Live Video Wallpaper Engine**: Play video wallpapers seamlessly on Cinnamon Desktop using `xwinwrap` & `mpv`.
- **Multiple Playback Modes**: Single video file, folder of videos, custom ordered M3U playlist, and custom path/URL mode.
- **Playlist Shuffle Mode**: Randomize video playback for folders and custom playlists with live on-the-fly toggling.
- **Smart Power Saver (Auto-Pause)**: Automatically pauses video playback when windows are maximized or fullscreen on the active monitor.
- **Multi-Monitor Support**: Target specific displays (Display 1, 2, 3, 4) or stretch across all connected monitors.
- **Tray Popup Menu Controls**:
  - Start/Stop playback toggle.
  - Next and Previous track skipping for playlists and folders.
  - Compact volume slider with an integrated clickable Mute/Unmute icon.
  - Live Shuffle switch toggle.
- **Audio Control Options**: Options for starting muted by default (`start-muted`), global mute (`mute-all`), and live IPC volume adjustments.
- **Process Safety & Desktop Layering**: Integrated `xdotool` to ensure window layering (`windowlower`) below desktop icons, socket cleanup, and boot sync with `nemo-desktop` and PulseAudio/PipeWire.
- **Automated Installer**: Dependency setup script (`install-deps.sh`) for installing `mpv`, `socat`, `xwinwrap`, and `xdotool`.
