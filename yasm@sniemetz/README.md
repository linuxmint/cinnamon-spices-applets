# YASM — Yet Another System Monitor

A compact Cinnamon panel applet that displays live system metrics with sparkline history graphs.

## Metrics

- **Uptime** — system uptime + load average (click to open `top`)
- **CPU** — usage % + package temperature, with threshold colouring
- **Battery** — charge %, charge/discharge rate in watts, with AC/battery icon swap
- **Memory** — used % + total GB
- **Disk** — used % per mount + read/write throughput
- **Network** — TX/RX rates per interface
- **Fan** — RPM for detected fans
- **GPU** — utilisation % (NVIDIA via nvtop)

Each tile shows a sparkline history graph on hover.

## Requirements

- Cinnamon 6.0+
- `nvtop` (optional, for GPU metrics)
- Intel RAPL access (optional, for accurate CPU power on AC): run *Enable RAPL* from applet settings

## Installation

Install via **System Settings → Applets**, or manually:

```bash
cp -r files/yasm@sniemetz ~/.local/share/cinnamon/applets/
```

Then add *YASM* to your panel via right-click → *Add applets to panel*.
