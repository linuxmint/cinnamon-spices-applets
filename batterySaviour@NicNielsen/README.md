# Battery Saviour (`batterySaviour@NicNielsen`)

A lightweight Linux Cinnamon panel applet that lets you set minimum and maximum battery charge thresholds by laptop brand to extend your lithium-ion battery lifespan.

🌐 **Website:** [www.xlets.ca](https://www.xlets.ca)  
👤 **Maintainer:** Nic Nielsen  

![Battery Saviour Screenshot](screenshot.png)

---

## Features

- **Automatic Manufacturer Detection:** Reads DMI hardware fields and loaded kernel platform drivers to automatically identify your laptop brand.
- **Multi-Brand Support:** Supports **ThinkPad**, **Lenovo** (IdeaPad/Legion/Yoga), **ASUS**, **Dell**, **HP**, **Acer**, and **MSI**.
- **Interactive Charge Sliders:** Set custom **Max Charge** and **Min Charge** percentages directly from a compact panel popup menu.
- **Safety Mismatch Warning:** Prompts for confirmation before applying hardware controls if your manually selected brand differs from your detected system.
- **Customizable Appearance:** Adjust popup scale/size, background opacity, text color, background color, and button colors in the applet settings.
- **Built-in Battery Health Guide:** Right-click the applet and select **Why Battery Saviour?** for quick best practices on daily use (20%–80%) and long-term storage (~50%).

---

## Supported Brands & Backend Controls

| Brand | Detection / Driver | Sysfs / CLI Control Used |
| :--- | :--- | :--- |
| **ThinkPad** | `thinkpad_acpi` | `/sys/class/power_supply/BAT0/charge_control_{start,end}_threshold` |
| **Lenovo** | `ideapad_acpi` / `legion_laptop` | `conservation_mode` (`1` when max < 80%, `0` otherwise) |
| **ASUS** | `asus-nb-wmi` / `asus_laptop` | `/sys/class/power_supply/BAT*/charge_control_end_threshold` |
| **Dell** | `dell-laptop` / `dell_smm_hwmon` | `cctk --PrimaryBattChargeCfg=Custom:<min>-<max>` or `charge_control_{start,end}_threshold` |
| **HP** | `hp-wmi` | `/sys/class/power_supply/BAT*/charge_control_end_threshold` |
| **Acer** | `acer-wmi` / `acer-wmi-battery` | `health_mode` (`1` when max ≤ 80%, `0` otherwise) |
| **MSI** | `msi-laptop` / `msi-ec` | `/sys/class/power_supply/BAT*/charge_control_{start,end}_threshold` |

> **Note:** Applying charge thresholds requires root privileges via `pkexec` and depends on your laptop's BIOS/EC and Linux kernel driver support.

---

## Requirements

- **Desktop Environment:** Cinnamon (Linux Mint, Fedora Cinnamon, Arch Linux, Debian, etc.)
- **System Utilities:**
  - `pkexec` (PolicyKit) for writing battery threshold values to `/sys/`
  - `zenity` (optional, for the *Why Battery Saviour?* dialog; falls back to `notify-send`)
  - `cctk` (optional, for Dell Command | Configure support on Dell laptops)

---

## Installation

### From Cinnamon Applets Settings
1. Open **System Settings → Applets → Download**.
2. Search for **Battery Saviour** and click **Install**.
3. Switch to the **Manage** tab, select **Battery Saviour**, and click **+** to add it to your panel.

### Manual Installation
1. Copy or clone the `batterySaviour@NicNielsen` directory into your local Cinnamon applets folder:
   ```bash
   cp -r batterySaviour@NicNielsen ~/.local/share/cinnamon/applets/
   ```
2. Reload Cinnamon (`Alt + F2`, type `r`, and press `Enter`) or reload the applet via D-Bus:
   ```bash
   dbus-send --session --dest=org.Cinnamon --type=method_call /org/Cinnamon org.Cinnamon.ReloadXlet string:'batterySaviour@NicNielsen' string:'APPLET'
   ```
3. Open **System Settings → Applets**, find **Battery Saviour**, and add it to your panel.

---

## Usage

1. **Left-click** the battery icon on your Cinnamon panel to open the threshold popup.
2. Drag the **Max Charge** and **Min Charge** sliders to your preferred limits (e.g., `80%` max and `20%` min).
3. Click **Apply Thresholds** and authenticate when prompted.
4. **Right-click** the applet icon to:
   - Open **Why Battery Saviour?** for battery care tips.
   - Open **Configure...** to override the laptop brand or customize popup colors, opacity, and size.

---

## License

This project is free and open-source software licensed under the **GNU General Public License (GPL)**.  
Visit [www.xlets.ca](https://www.xlets.ca) for more free Linux Cinnamon applets and desklets.
