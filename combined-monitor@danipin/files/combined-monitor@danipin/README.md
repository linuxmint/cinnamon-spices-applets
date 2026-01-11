# Combined Monitor Applet for Cinnamon
> System monitoring of CPU, RAM, SWAP, and TEMP in a single, compact panel element.
> UUID: combined-monitor@danipin

## 🖥️ Features
This applet offers a comprehensive overview of system usage directly in your Cinnamon panel.

* **Compact Display:** Shows CPU, RAM, SWAP, and CPU temperature usage in one element.
* **CPU Temperature (TEMP):** Displays the CPU temperature with configurable thresholds in Celsius or Fahrenheit. The function searches for the most reliable kernel sensors (`/sys/class/hwmon` or `/sys/class/thermal`).
* **Profile Management:** Quickly save and load up to three complete configurations via the context menu.
* **Visual Thresholds:** Freely configurable color rules (LOW, MED, HIGH, CRITICAL) for visual warning for all metrics.
* **Customizable Layout:** The order of metrics (e.g., CPU | TEMP | RAM | SWAP) can be changed via settings or by scrolling the mouse wheel over the applet.
* **Flexible Design:** Supports text labels, theme icons, or the use of custom SVG/PNG symbols.
* **Configurable Separator:** Configure the separator and its color (default is `|`).
* **SWAP Option:** Can be set so that SWAP is only displayed when actually in use (> 0%).


## ⬇️ Installation

### 1. Manual Installation

1. Download the applet archive (e.g., from GitHub) and unzip it. The resulting folder is named, e.g., `cinnamon-combined-monitor-main`.

2. **❗ IMPORTANT – Rename Folder ❗**
    The folder **must** be renamed for Cinnamon to the applet's UUID name: **`combined-monitor@danipin`**

3. Copy the **renamed folder** to your local Cinnamon applet directory:

    ```bash
    cp -r combined-monitor@danipin ~/.local/share/cinnamon/applets/
    ```

4. **Restart Cinnamon** (either by logging out/in or using the key combination `Alt` + `F2`, followed by `r` and `Enter`).

5. Add the applet to the panel via **System Settings -> Applets**.

### 2. Installation via Cinnamon Spices (Future)

Once the applet is approved by Cinnamon, you can install it directly via the Applet Management in your System Settings.

## 🛠️ Usage & Configuration

* **Left-click on the Applet:** Opens a context menu for quick selection of **Separator** presets, **Symbol** icons (including preview), and **Profile Management** (Loading/Saving configurations).
* **Mouse wheel over the Applet:** Quickly changes the **Layout Variant** (CPU, TEMP, RAM, SWAP) if multiple metrics are displayed.


## ⚠️ Important System Requirement for Temperature Display

Since the temperature function reads sensor data directly from the Linux kernel, it relies on the correct detection of compatible thermal or hwmon sensors. In rare cases, the applet may not find the correct sensor path for your CPU/system, causing the temperature display to not work. This is a system-side issue that is typically only resolved by manually specifying the sensor path in the advanced settings.


### 🔧 Troubleshooting: Temperature not displayed?

If the temperature does not appear, the corresponding kernel modules often need to be loaded first.

**Step 1: Install lm-sensors**
```bash
sudo apt install lm-sensors
```
**Step 2: Configure Sensors Run the detection process and confirm the prompts:**

```bash
sudo sensors-detect
```
**Step 3: Verify Functionality Type sensors in the terminal. If a CPU temperature is listed there, the applet can now read it as well.**

```bash
sensors
```
