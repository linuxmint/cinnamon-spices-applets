# Heat & Load Monitor

A compact single-line panel monitor for CPU, GPU, memory and network with
color-coded thresholds: values turn orange when hot and red when critical.

```
CPU 48° 5% │ GPU 56° 4% 2.4G │ RAM 21.7G │ ↓75k ↑70k
```

## Panel

- **CPU** – package temperature and total load
- **GPU** – temperature, load and used VRAM (NVIDIA, via `nvidia-smi`)
- **RAM** – used memory
- **Network** – download / upload speed in bits per second on the default-route
  interface (or a pinned interface)
- Optional: GPU power draw, GPU fan speed, swap usage, hottest NVMe temperature

Fields keep a fixed width, so the panel does not jitter as numbers change.

## Popup (left click)

- CPU model, per-core temperatures, average / max frequency
- GPU name, VRAM, power, fan, clocks
- RAM and swap, NVMe drive temperatures
- Interface, IPv4 address, current speed and totals
- 5-minute history graphs for CPU, GPU, VRAM, RAM and network

Middle click opens GNOME System Monitor (if installed).

## Settings

- Update interval (1–10 s)
- Which metrics are shown on the panel
- Warning / critical thresholds for every metric
- Colors for normal, warning and critical values
- Network interface: automatic (default route) or pinned

## Requirements

- Temperatures come from `coretemp`, `k10temp` or `zenpower` hwmon sensors.
- GPU metrics require the NVIDIA proprietary driver (`nvidia-smi`). Without it
  the GPU section is hidden from the panel.

## Translations

English and Russian.
