# Train horn signals

A Cinnamon panel applet that lists the named train horn and whistle signals
from General Code of Operating Rules (GCOR) Rule 5.8.2, Sounding Whistle, and
plays a timing reference when you click one.

A short blast is written `o` and a longer blast is written `-`. The tones
bundled with the applet are plain synthesized references so you can hear the
rhythm. They are not a recorded locomotive horn and they are not a substitute
for the operating rules.

## Named signals (GCOR 5.8.2)

| No. | Pattern | Meaning |
|----:|---------|---------|
| 1 | `o o o o o …` | Emergency warning (succession of shorts) |
| 2 | `-` | Brakes applied |
| 3 | `- -` | Proceed (release brakes) |
| 4 | `o o` | Acknowledgment |
| 5 | `o o o` | Backing |
| 6 | `o o o o` | Request signal |
| 7 | `- - o -` | Grade crossing |
| 8 | `- o` | Approaching men or equipment |

Two short sounds are the acknowledgment, not "proceed". Proceed is two *long*
sounds. The grade-crossing warning is the familiar two-long, one-short,
one-long figure used at many public highway-rail grade crossings. GCOR
5.8.2(7) and FRA 49 CFR Part 222 expect that warning to start 15–20 seconds
before the crossing, and not more than a quarter mile in advance.

Playback uses planning lengths only: 1 second for a short blast, 3 seconds
for a long blast, and 1 second of silence between blasts. The rules fix when
a warning must start, not the exact length of each blast. Signal 1 is a
succession of short sounds rather than a fixed count; the applet plays five
shorts as a sample of that warning.

Playback needs `paplay` (PulseAudio / PipeWire), `aplay`, or SoX `play` on
the PATH.

This is a study aid for people who want to label, time, or explain a train
horn signal — training notes, simulations, and similar desktop use. Portable
train horn guns use the same patterns. Background on cordless and battery
powered units is at [Horn Guns](https://hornguns.com/).

## Install (for testers)

Copy `files/trainhorn-signals@bosshorncom-cmd/` to
`~/.local/share/cinnamon/applets/trainhorn-signals@bosshorncom-cmd/`, then
add the applet from Cinnamon Settings → Applets, or restart Cinnamon
(`Alt+F2`, `r`, Enter).

## License

GPL-3.0-or-later.
