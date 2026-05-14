# Combined Monitor Applet for Cinnamon
> System monitoring of CPU, RAM, SWAP, and TEMP in a single, compact panel element.
> UUID: combined-monitor@danipin

## 🖥️ Features
This applet offers a comprehensive overview of system usage directly in your Cinnamon panel.

* **Compact Display:** Shows CPU, RAM, SWAP, and CPU temperature usage in one element.
* **CPU Temperature (TEMP):** Displays the CPU temperature with configurable thresholds. Advanced logic filters out non-CPU sensors (like NVMe SSDs, WiFi, or GPUs) to ensure the most accurate reading.
* **Advanced Profile Management:** Save and load up to three complete snapshots of your settings. Supports focus-switching even to empty slots for easier configuration.
* **Visual Thresholds:** Freely configurable color rules (LOW, MED, HIGH, CRITICAL) for visual warning for all metrics.
* **Customizable Layout:** The order of metrics (e.g., CPU | TEMP | RAM | SWAP) can be changed via settings or by scrolling the mouse wheel over the applet.
* **Modern & Stable:** Fully compliant with modern GJS (JavaScript) standards using `TextDecoder`, ensuring a clean system log without decoding warnings.
* **Flexible Design:** Supports text labels, theme icons, or the use of custom SVG/PNG symbols.
* **Configurable Separator:** Configure the separator and its color (default is `|`).
* **SWAP Option:** Can be set so that SWAP is only displayed when actually in use (> 0%).

## ⚠️ Important System Requirement for Temperature Display

Since the temperature function reads sensor data directly from the Linux kernel, it relies on the correct detection of compatible thermal or hwmon sensors. In rare cases, the applet may not find the correct sensor path for your CPU/system, causing the temperature display to not work. This is a system-side issue that is typically only resolved by manually specifying the sensor path in the advanced settings.

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

### 📂 Profile Management (Snapshot Model)
The applet uses a **Snapshot Model** for its 3 profile slots:
1. **Switch Focus:** You can select a slot (even an empty one) via "Activate (Load)". If it's empty, the applet stays ready for your configuration.
2. **Configure:** Change your colors, thresholds, symbols, or the order of metrics in the applet settings.
3. **Save:** Use "Save Current Settings" on your active slot to store the current design.
4. **Quick Toggle:** Switch between different visual designs instantly by loading another saved slot.

* **Left-click on the Applet:** Opens a context menu for quick selection of **Separator** presets, **Symbol** icons (including preview), and **Profile Management** (Loading/Saving configurations).
* **Mouse wheel over the Applet:** Quickly changes the **Layout Variant** (CPU, TEMP, RAM, SWAP) if multiple metrics are displayed.
