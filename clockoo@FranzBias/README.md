# Clockoo

An hourly **cuckoo**, **named alarms that can speak a text**, and **countdown
timers** — right in your panel.

## Features

- **Hourly cuckoo** — choose the hours (`7-21`, `8,12,18`, `0-23`…) and the
  minute. Optionally it calls **as many times as the hour**, like a real cuckoo
  clock: three calls at 3 o'clock, twelve at noon.
- **Alarms with a name** — every day, Monday to Friday, weekend, a single day,
  or just once (a one-time alarm switches itself off after ringing). Each alarm
  has its own sound, its own repeat count and an optional **spoken text**
  in English, Italian, German, Spanish or French.
- **Countdown timers** — 1, 5, 10, 15, 30 minutes or your own duration, straight
  from the menu. The remaining time is shown in the panel (horizontal panels)
  and in the menu, where each timer can be paused, resumed or cancelled
  (a pomodoro too: the chain waits while its timer is paused).
- **Crescendo and heads-up** — an alarm can start softly and grow to full
  volume, and can warn you some minutes before (0 = off) with a quiet
  notification.
- **Snooze per alarm** — each alarm can have its own snooze (0 = the general
  setting).
- **Pomodoro** — work and breaks in a chain (25/5/15 minutes, a long break
  every 4 works; all adjustable), started from the menu. Cancelling the running
  timer stops the chain. The menu counts the completed work sessions of
  today and of this week.
- **Stopwatch** — in the menu, with laps; its time can be shown in the panel
  (switch it off in *Settings → General*). It keeps counting across a
  Cinnamon restart.
- **Quiet night** — no cuckoo between two hours of your choice.
- **Rings after suspend** — an alarm or timer that falls while the computer
  sleeps rings as soon as it wakes up; an alarm missed while it was off rings
  at the next login.
- **Saved timers** — keep your own timers (name, minutes, seconds, text) in
  *Settings → Timer*: they appear in the menu, in the order you choose with the
  list arrows or with *Sort by duration* / *Sort by name*.
- **A mantel clock in the panel** — wood on light panels, brass on dark ones,
  chosen automatically from the panel colours (or fixed in *Settings → General*).
- **Snooze** — every alarm and timer notification has *Stop* and *Snooze*.
- **Keeps ringing when Cinnamon does not** — alarms and timers are systemd
  *user* timers, so they ring even if Cinnamon restarts or crashes, and even
  while the panel is reloading.
- **13 bundled sounds** (cuckoo clocks, church bells, alarm clocks, kitchen
  timer, doorbell…), all **CC0**, or any sound file of your own.
- English, Italian and German translations.

## How it works

The applet itself never rings. When you change a setting it writes a small
JSON file (`~/.config/Clockoo-applet/config.json`) and asks the bundled
`clockoo_core.py` to create systemd user timers named `clockoo-applet-*`.
At the right moment systemd starts `clockoo_ring.py`, which plays the sound,
reads the text and shows the notification. Removing the applet from the panel
removes its timers.

You can see them with:

```bash
systemctl --user list-timers 'clockoo-applet-*'
```

## Requirements

All from your distribution's repositories (on Linux Mint they are usually
already installed). If something is missing, the applet tells you in its menu
and offers to install it with your package manager:

- `python3`, `python3-gi`, `gir1.2-notify-0.7` — ringing and notifications
- `pipewire-bin` (`pw-play`) or `pulseaudio-utils` (`paplay`) — playing sounds
- `speech-dispatcher` (`spd-say`) — reading texts aloud
- systemd with user sessions (standard on Linux Mint)

**Voices.** Texts are read with speech-dispatcher. If the
piper speech engine is *already installed*
on your computer, you can choose its folder in *Settings → General* for more
natural voices; the applet never downloads it.

## Credits

- Sounds: 13 recordings from [Freesound](https://freesound.org), all released
  under **CC0 1.0** — authors and links in `files/clockoo@FranzBias/sounds/CREDITS.md`.
- Icon and code: FranzBias.

## License

The applet is released under the **GNU General Public License v3.0 or later**.
The bundled Python modules (`clockoo_core.py`, `clockoo_ring.py`,
`clockoo_i18n.py`) come from the same author's MIT-licensed Clockoo code and
keep their MIT notice; MIT is compatible with the GPL.
