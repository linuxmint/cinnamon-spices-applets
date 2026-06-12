# WMM - Wallpaper Multi-Monitor Manager

A Cinnamon applet for managing wallpapers in multi-monitor setups.
Forget about deformed, cropped or repeated wallpapers.
With WMM, you are in full control.

<p align="center">
  <a href="screenshots/screenshot.png">
    <img src="screenshots/screenshot.png" alt="WMM Screenshot" width="100%"/>
  </a>
</p>

## ✨ Main features

*   **Real multi-monitor management**: Assign different wallpapers to each monitor or span a panoramic image across all of them.
*   **Image assignment**: Tries to adapt most suitable image to each monitor according to its orientation (Vertical-Horizontal).
*   **Flexible aspect modes**: Control how image fits: `Scaled` (no distortion), `Zoom` (fill by cropping) or `Stretched` (fill by stretching).
*   **Visual effects**: Apply `Sepia` or `Black & White` filters to images per monitor.
*   **Background effects**: Apply `Blur` or `Color` filters to background if image does not cover entire monitor area.
*   **Automatic rotation**: Set up a timer to change wallpapers automatically, either synchronously or asynchronously.
*   **Favorites (Presets)**: Save your favorite wallpaper combinations as Presets and load them instantly.
*   **Internationalization**: Interface ready for multiple languages (English, Spanish, Catalan) with support for inheriting system translations.

## ⚙️ Ideal system configuration

For WMM to work correctly and wallpaper transitions to be smooth, your desktop needs following settings in System Settings → Backgrounds:

| Setting               | Required value    | Reason                                                     |
|-----------------------|-------------------|------------------------------------------------------------|
| Picture aspect ratio  | Spanned           | Prevents system from distorting or cropping WMM composition |
| Gradient type         | Solid             | Avoids mixing with other colors during transition          |
| Slideshow             | Disabled (false)  | Prevents system from interfering with WMM changes      |

*   WMM tries to enforce these settings automatically every time it applies a wallpaper.
*   If it cannot (for example, due to system restrictions), it will show a notification with steps to follow.
*   You can manually configure them at any time in System Settings → Backgrounds.

## 🚀 Installation

*   Download or clone this repository on your computer.

*   Open a terminal in project root folder (wmm-applet@maki).

*   Run installation script:

    ```bash
    chmod +x install.sh
    ./install.sh
    ```

*   Script will check your dependencies and ask if you want to install them automatically.

*   Enable applet: Go to Cinnamon Applets settings, look for "WMM - Wallpaper Multi-Monitor Manager" and enable it.

## 🔧 Manual installation

If you prefer not to use script:

1.  **Create the applet folder**:

    ```bash
    mkdir -p ~/.local/share/cinnamon/applets/wmm-applet@maki
    ```
*   2. Copy project files into that folder (content of zip, not parent folder).
*   3.  **Compile the translations**

    ```bash
    for po in po/*.po; do lang=$(basename "$po" .po); msgfmt "$po" -o ~/.local/share/locale/$lang/LC_MESSAGES/wmm-applet@maki.mo; done
    ```
*   4.  **Install dependencies** listed in the table below:
*   5.  **Enable applet** from Cinnamon Applets settings.

### 📋 Dependencies

Before installing, make sure you have these dependencies. You can install them manually or let `install.sh` script do it for you.

| Package | Description |
|---|---|
| **Installable dependencies** | **(installed by `install.sh`)** |
| `python3` | Python 3 interpreter |
| `python3-pillow` | Image manipulation library |
| `python3-numpy` | Scientific computing library for fast image processing |
| `libnotify-bin` | For sending desktop notifications |
| **System dependencies** | **(included with Cinnamon)** |
| `python3-gi` | GTK bindings for Python |
| `python3-gi-cairo` | Cairo bindings for Python |
| `gir1.2-gtk-3.0` | GTK+ 3.0 type information |
| `gir1.2-glib-2.0` | GLib 2.0 type information |
| `gettext` | Internationalization tools |
| `zenity` | For displaying graphical dialogs |
| `procps` | For the `pkill` process management tool |

### Quick dependency install (if not using `install.sh`)

*   **Linux Mint / Ubuntu / Debian**:

    ```bash
    sudo apt install -y python3 python3-pillow python3-numpy libnotify-bin
    ```

*   **Fedora**:

    ```bash
    sudo dnf install -y python3 python3-pillow python3-numpy libnotify
    ```
*   **Arch Linux / Manjaro**:

    ```bash
    sudo pacman -Sy --noconfirm python python-pillow python-numpy libnotify
    ```

### 🗑️ Uninstallation

1.  Right-click the applet on the panel and select **Remove**.
2.  Open **Applets**, find WMM Manager and click **Uninstall**.
3.  Delete cache folder:
    ```bash
    rm -rf ~/.cache/wmm
    ```
4.  Remove any previously installed WMM Nemo actions

    ```bash
    rm ~/.local/share/nemo/actions/wmm-add_to_bookmarks.nemo_action ~/.local/share/nemo/actions/wmm-send-to.nemo_action
    ```

## 🛠️ Debug / Log Viewer

WMM includes a built‑in log system that records engine, panel and script activity in real time. You can inspect the logs at any moment without restarting the application.

*   **Open the Log Viewer**: In the Control Panel, click the **Log** button (text‑x‑generic icon). A separate window will open showing timestamped events from the engine, panel and Nemo actions.
*   **Real‑time updates**: The viewer refreshes automatically as new events are written. Use the filters (origin, level, reason) or the search bar to find exactly what you need.
*   **Manual inspection**: The log file is stored at `~/.cache/wmm/debug.log`. You can open it with any text editor, use the viewer inside the panel, or run the following command to display it directly in a terminal:

    ```bash
    python3 ~/.local/share/cinnamon/applets/wmm-applet@maki/python/debug_logger.py
    ```
The old “Debug mode” that required a terminal has been removed. All diagnostic information is now available through this integrated, user‑friendly log system.

## 🌍 Translation

WMM supports multiple languages. Translations are installed automatically when running install.sh.
*   Source files are located in locale/ folder of project.
*   Interface will automatically display in your language if translations are available.
If you want to help us translate WMM into your language, you are more than welcome!

## 📜 License

WMM is distributed under [GPL-3.0](LICENSE).
You are free to use, modify and distribute this software, as long as you keep same license and attribution to original authors.
