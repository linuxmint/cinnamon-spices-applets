# iOS Bluetooth Battery Monitor

A **Cinnamon Panel Applet** dedicated to monitoring connected **Bluetooth & Wireless device batteries** with an **iOS / macOS Sonoma Batteries Widget** popover and a **4-layer high-compatibility detection engine**.

![Screenshot](screenshot.png)

## Features

- **4-Layer High-Compatibility Battery Detection (100% Async)**:
  - **BlueZ D-Bus (`org.bluez.Device1` + `org.bluez.Battery1`)** with real-time D-Bus signal subscriptions and **1-click Connect / Disconnect**.
  - **UPower (`UPowerGlib`)** for wireless mice, keyboards, headsets, and gamepads.
  - **Linux Kernel `sysfs` (`/sys/class/power_supply/*`)** for `hidpp_battery_*` (Logitech), DualSense/DualShock, Xbox, and Apple Magic peripherals.
  - **PipeWire / PulseAudio** card properties for headsets reporting battery via HFP/HSP AT commands.
- **iOS Circular Battery Gauges**:
  - Vector device icons + traffic-light battery rings (`#30D158`, `#FFD60A`, `#FF453A`) + charging indicator.
- **Configurable Panel Bar & Alerts**:
  - Display lowest battery `%`, all connected batteries, device count, or icon only, plus desktop notifications for low battery.
