# Resource Monitor (resource-monitor@kprakesh)

A lightweight, high-performance system monitor for the Linux Mint Cinnamon desktop. It displays CPU, RAM, and Swap usage directly in your panel with minimal system impact.

![Applet Preview](https://raw.githubusercontent.com/kpr-dev590/resource-monitor-cinnamon/main/icon.png)

## 🚀 Features

* **Real-time Monitoring**: Tracks CPU, RAM, and Swap usage.
* **Accuracy**: Uses professional kernel-level calculations (accounts for `iowait`) to match the Linux Mint System Monitor.
* **Lightweight**: Reads data directly from the `/proc` virtual filesystem.
* **Zero Dependencies**: Does not require external packages like `top` or `ps`, ensuring maximum performance and reliability.
* **Customizable UI**: Choose which metrics to display through a dedicated settings panel.
* **Symbolic Mode**: Automatically switches to a clean system-monitor icon when labels are disabled to maintain panel aesthetics.

## 🛠 Installation

### Via Cinnamon Settings (Recommended)
Once approved on Cinnamon Spices:
1. Right-click your panel and select **Applets**.
2. Click the **Download** tab.
3. Search for "Resource Monitor" and click the download icon.
4. Go back to the **Manage** tab and add it to your panel.

### Manual Installation
1. Clone this repository or download the ZIP.
2. Move the `resource-monitor@kprakesh` folder to:
   `~/.local/share/cinnamon/applets/`
3. Restart Cinnamon (`Alt+F2`, then type `r` and press Enter).
4. Enable the applet via the **System Settings > Applets** menu.

## 📊 Technical Details
This applet is designed for efficiency. By parsing `/proc/stat` and `/proc/meminfo` every 2 seconds, it provides accurate data while consuming negligible CPU cycles.

* **CPU Calculation**: `(Total Time - (Idle + IOWait)) / Total Time`
* **Update Interval**: Default 2 seconds.

## 📄 License
This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support & Contributions
Developed by **kprakesh**. Part of the broader Linux Mint ecosystem contribution alongside projects like [Symphonie](https://github.com/kpr-dev590/Symphonie).