## Capsule System Monitor

A compact system monitor for the panel. One dark capsule shows memory, CPU, video memory,
disk and network at a glance: quiet when everything is fine, orange when something needs
attention.

![Capsule System Monitor on the panel](screenshot.png)

### Why another system monitor

**The panel never jumps.** Every value lives in a fixed-width slot, so `7%` and `100%` take up
exactly the same space. Many panel monitors reflow every second as their numbers change, which
nudges the clock left and right all day. This one only changes width when you change the
settings.

**At rest it disappears.** Labels sit at 30% white, values at 62%, on a barely-there capsule.
You are not meant to notice it while the machine is idle. When a threshold is crossed, the
value, its bar and the capsule background all turn orange: a single accent colour with a
single meaning.

### What it shows

| | |
|---|---|
| **MEM** | system memory, real usage (`used - cached - buffers`) |
| **CPU** | processor load, `iowait` counted as idle |
| **GPU** | NVIDIA video memory (VRAM) |
| **SSD** | disk usage of a mount point you choose |
| **NET** | network throughput as a two-way graph with upload and download speeds |
| **SWP** | swap usage |
| **GFX** | NVIDIA GPU utilisation |
| **TMP** | CPU package temperature |

All eight are optional and reorderable from the settings, with arrow buttons for the order and
a checkbox for visibility. Five are on by default.

Memory, swap, video memory and disk can show either the percentage used or the amount used
(`12,8 G`, `468 G`, `1,5 T`). The bar underneath always shows the percentage, so switching to
gigabytes makes the number more informative without losing the proportion, and alert
thresholds are evaluated on the percentage in both modes.

The network cell is a 20-second history with a centre line: one direction above, the other
below, with the current speed printed at the end of each. Each direction is scaled against its
own recent peak, so an upload stays fully visible even while a much larger download is
running. Only physical interfaces are counted, so container bridges, `veth` pairs and VPN
tunnels do not make traffic count two or three times.

### Requirements

`libgtop` with GObject introspection is the only hard dependency:

```
sudo apt install gir1.2-gtop-2.0     # Linux Mint, Ubuntu, Debian
sudo dnf install libgtop2            # Fedora
```

`nvidia-smi` is optional and only needed for the GPU and GFX elements. Without it those two
show a dash and never raise an alert. AMD and Intel GPUs are not read.

### Settings

Right-click the applet and choose Configure. Alert thresholds default to 85% for memory, 80%
for disk, 90% for CPU and 90% for video memory. The CPU and temperature thresholds only fire
when the value stays above the line for a sustained period (10 seconds by default), because a
processor spikes to 100% many times a day and a monitor that cries wolf gets ignored.

Left-clicking the applet opens a full system monitor of your choice, `gnome-system-monitor` by
default.

### Issues

https://github.com/gaborkis11/capsule-monitor
