# Privacy Indicator

Shows a panel icon only while your camera or microphone is actively in
use — the same idea as the privacy dot on iOS/macOS or the built-in
indicators in GNOME Shell and KDE Plasma, which Cinnamon doesn't have a
native equivalent for.

## How it works

- **No permanent panel icon.** The applet stays completely hidden until
  something is actually active, then appears and disappears again —
  it never occupies a fixed slot in your panel.
- **Camera active** → a green icon with a camera glyph.
- **Microphone active** → an orange icon with a mic glyph.
- **Both at once** → a single icon split top/bottom (camera green on
  top, mic orange on bottom) — not two overlapping icons.
- **Click the icon** to see exactly which process is responsible, e.g.
  "Camera: firefox (PID 4821)". Multiple simultaneous processes on one
  device are all listed.

## Detection

- Camera: checks which process (if any) holds `/dev/video*` open.
- Microphone: checks PipeWire's own graph directly for audio capture
  streams that are actually producing audio right now (not just
  connected) — more reliable than going through the PulseAudio
  compatibility layer, which can't always tell "connected" apart from
  "actually recording."

If your system doesn't run PipeWire, microphone detection can't work —
rather than silently doing nothing, the applet shows a distinct gray
"!" icon and explains why when you click it. Camera detection is
unaffected either way.

## Settings

Poll interval (default 2 seconds, 1–30s range) — configurable from the
applet's settings.

## Requirements

- `fuser` (part of `psmisc`, present on virtually every desktop Linux
  install) for camera detection.
- PipeWire (`pw-dump`) for microphone detection.

## License

GPL-2.0-or-later.
