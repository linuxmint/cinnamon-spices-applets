# PC Pulse

A glass strip for the Cinnamon panel that puts your Claude Code usage limit next to the numbers you actually glance at: uptime, CPU, RAM, GPU, weather and the battery of your wireless keyboard and mouse. Every part of it can be changed, and you can drag widgets around right on the panel.

![PC Pulse on the panel](screenshot.png)

## Widgets

Turn on as many as you like, in any order, as many times as you like.

| Widget | What it shows | Option column |
|---|---|---|
| Claude weekly limit | Weekly usage limit %, days to reset | |
| Claude 5 hour limit | Session limit % (when your plan has one) | |
| Weather | Condition icon, temperature, today's low/high | `latitude,longitude` |
| Uptime | Time since boot, with a live clock face | |
| CPU usage | % with a history graph | |
| CPU temperature | °C from k10temp, coretemp, zenpower... | sensor name to force |
| Load average | 1 minute load | |
| RAM / Swap | % used, GB in the tooltip | |
| GPU usage | % (AMD via sysfs, NVIDIA via nvidia-smi), smoothed | |
| GPU temperature / VRAM | °C, video memory used | sensor name |
| Disk space | % used of a mount | mount path, e.g. `/home` |
| Disk read+write | Combined throughput | |
| Network download / upload | Throughput | interface, blank = all |
| Battery (laptop) | Charge % | device from `/sys/class/power_supply` |
| Bluetooth / wireless device battery | Keyboards, mice, headsets seen by UPower | part of the device name |
| Clock / date | Any strftime format | e.g. `%a %d %b` |
| Custom command | First line of any shell command; a bare 0 to 100 fills a ring | the command |

Each widget can be drawn as a ring, bar, history graph, weather icon, clock face or plain text, with its own caption and colour.

## Customising

Click the strip for a menu with live details, on/off switches for every widget and shortcuts to the settings. Right click > Configure opens the full settings:

- **Widgets**: add, remove, reorder and edit the list.
- **Background**: glass colours and opacity, border, corner radius, padding, spacing, dividers, ring and graph sizes.
- **Text and colours**: font, sizes, colours, text shadow, warning and critical colours and thresholds.
- **Behaviour**: refresh rate, click actions, GPU smoothing, weather units and caption, how often device batteries are checked.

**Drag to reorder:** hold the left button on a widget, drag it sideways and let go. A white line shows where it will land. Switch this off under Behaviour if you prefer.

## Claude Code usage

Claude Code sends your plan's usage limits to its status line command. PC Pulse ships a small status line script that saves them where the applet can read them. Add this to `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "python3 ~/.local/share/cinnamon/applets/pc-pulse@puneet/claude-statusline.py"
}
```

If you already have a status line, keep it and chain it:

```json
"command": "python3 ~/.local/share/cinnamon/applets/pc-pulse@puneet/claude-statusline.py --chain 'your existing command'"
```

The figure updates while a Claude Code session is open. When the reading is older than 6 hours (adjustable) the widget dims, and after the reset time passes it shows 0%.

## Logitech mice and keyboards

For some Logitech devices on a Unifying or Bolt receiver, the Linux driver only reports a coarse level such as "Full". PC Pulse asks the device for its exact percentage over HID++ using the bundled `logi_battery.py`. This needs read and write access to the receiver's `/dev/hidraw` node. Most desktops grant that to the logged-in user automatically. If yours does not, this udev rule does it:

```
# /etc/udev/rules.d/70-logitech-hidraw.rules
KERNEL=="hidraw*", ATTRS{idVendor}=="046d", TAG+="uaccess"
```

Turn it off under Behaviour > Wireless device batteries if you do not need it.

## Requirements

- Cinnamon (tested on Cinnamon 6.6, Linux Mint 22.3)
- `python3` (Logitech battery reader and the Claude Code status line script)
- `curl` (only for the weather widget)
- `nvidia-smi` (only for NVIDIA GPU figures)

## Privacy

Nothing leaves your computer except the weather request to [Open-Meteo](https://open-meteo.com/) (no key, no account), and only when the weather widget is on. Custom commands run exactly what you type.
