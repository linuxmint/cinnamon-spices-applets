# Sound (HDMI recover)

The Cinnamon **Sound** applet (`sound@cinnamon.org`, Cinnamon 6.6.9), plus one feature: when you pick an HDMI or DisplayPort output in the **Output device** menu and it never appears because WirePlumber failed to create it, the applet re-creates it and selects it.

Everything else (volume, players, inputs, settings) is the built-in applet unchanged.

## Problem

After a monitor sleeps and wakes (screensaver, monitor power-down), the GPU's HDMI audio device can be busy for a moment. PipeWire cannot open it and logs `playback open failed: Device or resource busy`. WirePlumber versions before 0.5.15 do not retry: they log `Failed to create alsa_output.….hdmi-stereo: Object activation aborted` and give up.

The card still lists the HDMI port, and its profile is still active, so the output shows up in the applet and in Sound settings. There is no audio device behind it, though, so selecting it does nothing. This affects Debian 13 and LMDE 7, which ship WirePlumber 0.5.8.

Newer WirePlumber releases have their own recovery: 0.5.15 added it, 0.5.18 limited it to 3 attempts, and 0.5.19 made it opt-in with `device.recover-on-error` ([wireplumber#1046](https://gitlab.freedesktop.org/pipewire/wireplumber/-/issues/1046)).

## Solution

1. When you select an HDMI or DisplayPort output, the applet checks 1.5 s later whether its audio device exists.
2. If it doesn't, the applet switches the card's profile **off** and back to the HDMI profile, which makes WirePlumber create the device again.
3. It tries at most **3 times**. The waits between attempts are random and get longer each time: 1–3 s, then 2–6 s, then 5–12 s.
4. The last attempt starts no later than 25 s after the problem is detected. No attempt ever starts later than 30 s.
5. It stops as soon as the output is back, and then selects it as the default output.
6. If all 3 attempts fail, a notification says so.

You can turn this off in the applet's settings under *Output recovery*.

### Working alongside a background service

The recovery above only runs when you pick an output in the menu. A wake-up that happens while nobody touches the menu can be covered by a separate user service that watches WirePlumber's log and runs the same profile reset.

The applet and that service use the same lock for each card: a directory at `$XDG_RUNTIME_DIR/hdmi-audio-recover/card-<index>.lock`. Whichever one holds the lock does the profile reset; the other waits for the output to come back. The applet works on its own without the service.

## Changes from `sound@cinnamon.org` 6.6.9

| File | Change |
|---|---|
| `hdmiRecovery.js` | New file containing the recovery logic. |
| `applet.js` | Loads the module, creates it next to the mixer control, calls `watchSelection()` after each output-device selection, and cleans it up when the applet is removed. Every change is marked `sound-hdmi-recover`. |
| `settings-schema.json` | Adds the *Output recovery* section and the `hdmiRecover` switch. |

Existing strings stay translated, because they still go through Cinnamon's own translations. The new strings are English only.

## Install

1. Install the applet from Spices, or copy `files/sound-hdmi-recover@GayratTursunov` to `~/.local/share/cinnamon/applets/`.
2. Right-click the panel and choose **Applets**.
3. Remove the built-in **Sound** applet and add **Sound (HDMI recover)**.
4. Its log lines start with `[sound-hdmi-recover]` and go to `~/.xsession-errors`.
