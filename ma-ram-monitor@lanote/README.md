# Moderately Advanced RAM Monitor

A high-performance, customizable RAM monitor for the Cinnamon Desktop Environment. Designed with visual stability and system efficiency in mind.

## Key Features

* **Asynchronous Engine:** Built using GJS `Promises` and `async/await` patterns. It fetches data from `/proc/meminfo` in the background, ensuring your Cinnamon panel never stutters or freezes.
* **Visual Stability Control**: Includes a "Monospace Mode" with customizable string padding. This prevents the panel from "jumping" or shifting when memory values change (e.g., switching from 9.9% to 10.0%).
* **Customizable Alerts**: Visual blinking warnings when RAM usage exceeds (or available memory falls below) user-defined thresholds.
* **Smart Interaction**: Left-click to launch your favorite system monitor (GNOME System Monitor, htop, btop, etc.).
* **Unit Flexibility**: Support for both Binary (GiB) and Decimal (GB) units.
* **Clean Code:** Fully compliant with modern GJS standards, using `TextDecoder` for byte-to-string conversion to ensure a warning-free log (`.xsession-errors`).
* **Localization:** Full support for translations (gettext).

## Installation

1. Copy the `ma-ram-monitor@lanote` folder to `~/.local/share/cinnamon/applets/`.
2. Enable the applet in **Cinnamon Settings -> Applets**.
3. (Optional) Configure the layout and alerts in the applet settings.

## Technical Details

The applet utilizes the following Linux kernel metrics:

- **MemTotal**: Total usable RAM.
- **MemAvailable**: An estimate of how much memory is available for starting new applications, without swapping.

## License

This project is distributed under the same license as the Cinnamon Desktop environment (GPLv2+).
