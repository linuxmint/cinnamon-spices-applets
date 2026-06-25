# WMM - Wallpaper Multi-Monitor Manager

A wallpaper manager for multi-monitor setups on **Cinnamon** and **GNOME Shell**.
Forget distorted, cropped or repeated backgrounds.
With WMM, you are in full control.

<p align="center">
  <a href=screenshots/"screenshot.png">
    <img src="screenshots/screenshot.png" alt="WMM Screenshot" width="100%"/>
  </a>
</p>

## ✨ Main features

*   **Real multi-monitor management**: Assign different wallpapers to each monitor or "span" a panoramic image across all of them.
*   **Image assignment**: Tries to match the most suitable image to each monitor based on its orientation (Vertical-Horizontal).
*   **Flexible aspect modes**: Control how the image fits: `Scaled` (no distortion), `Zoom` (fill by cropping) or `Stretched` (fill by distorting).
*   **Visual effects**: Apply `Sepia` or `Black and White` filters to images per monitor.
*   **Background effects**: Apply `Blur` or `Color` effects to the background if the image does not fill the entire monitor area.
*   **Automatic rotation**: Set a timer to change wallpapers automatically, either synchronously or asynchronously.
*   **Favorites (Presets)**: Save your favorite wallpaper combinations as "Presets" and load them instantly.
*   **Internationalization**: Interface ready for multiple languages (English, Spanish, Catalan), with its own translation domain, completely independent of the desktop environment.
*   **Multi-environment compatibility**: Works on both Cinnamon and GNOME Shell. The installer detects your desktop and automatically copies the correct files.

## 🖥️ Supported environments

| Desktop            | Support       | Notes                                                 |
|--------------------|---------------|-------------------------------------------------------|
| **Cinnamon**       | Full          | Native applet with all features                       |
| **GNOME Shell**    | Full          | Extension with a context menu identical to Cinnamon's |
| **KDE Plasma**     | In development| Platform module prepared                              |
| **Windows / macOS**| Planned       | Platform modules already sketched out                 |

## ⚙️ Ideal system configuration

For WMM to work correctly and wallpaper transitions to be clean, the desktop needs the following settings in System Settings → Backgrounds:

| Setting                       | Required value        | Reason                                                            |
|-------------------------------|-----------------------|-------------------------------------------------------------------|
| Picture aspect ratio          | Spanned               | Prevents the system from distorting or cropping WMM's composition |
| Gradient type                 | Solid                 | Prevents color blending during transitions                        |
| Slideshow                     | Disabled              | Prevents the system from interfering with WMM's changes           |

*   WMM tries to force these settings automatically every time it applies a wallpaper.
*   If it cannot (for example, due to system restrictions), it will show you a notification with the steps to follow.
*   You can configure them manually at any time in System Settings → Backgrounds.

## 🚀 Installation

*   Download or clone this repository to your computer.
*   Open a terminal in the project's root folder.
*   Run the installation script:
    ```bash
    chmod +x install.sh
    ./install.sh
    ```

*   The script will detect your desktop (Cinnamon or GNOME), check dependencies and ask if you want to install them automatically.

*   On Cinnamon: Go to the Applets configuration, look for "WMM Manager" and enable it.

*   On GNOME: Open the «Extensions» application (install it with sudo apt install gnome-shell-extension-prefs if you don't have it), look for "WMM Manager" and enable it. Then restart your session (Wayland) or reload GNOME Shell with Alt+F2 → r (X11).

## 🔧 Manual installation

If you prefer not to use script:

1.  **Create the applet folder**:

       For Cinnamon:

       ```bash
       mkdir -p ~/.local/share/cinnamon/applets/wmm-applet@maki
       ```

       For GNOME:

       ```bash
       mkdir -p ~/.local/share/gnome-shell/extensions/wmm@maki
       ```

2. Copy project files into that folder (content of zip, not parent folder).
3. Copy the correct JavaScript and metadata files according to your desktop:

       For Cinnamon:

       ```bash
       cp wmm_platform/shell/cinnamon/metadata.cinnamon.json ~/.local/share/cinnamon/applets/wmm-applet@maki/metadata.json
       cp wmm_platform/shell/cinnamon/applet.js ~/.local/share/cinnamon/applets/wmm-applet@maki/applet.js
       ```

4.  **Compile the translations**

       ```bash
       for po in po/*.po; do lang=$(basename "$po" .po); msgfmt "$po" -o ~/.local/share/locale/$lang/LC_MESSAGES/wmm-applet@maki.mo; done
       ```

5.  **Install dependencies** listed in the table below:
6.  **Restart your user session** and Enable the applet: Go to the Cinnamon Applets configuration or the GNOME Extensions Manager, look for WMM - Wallpaper Multi-Monitor Manager and enable it.

### 📋 Dependencies

Before installing, make sure you have these dependencies. You can install them manually or let `install.sh` script do it for you.

| Package                       | Description                                            |
|-------------------------------|--------------------------------------------------------|
| **Installable dependencies**  | **(installed by `install.sh`)**                        |
| `python3`                     | Python 3 interpreter                                   |
| `python3-pillow`              | Image manipulation library                             |
| `python3-numpy`               | Scientific computing library for fast image processing |
| `libnotify-bin`               | For sending desktop notifications                      |
| `gettext`                     | Internationalization tools                             |
| `zenity`                      | For displaying graphical dialogs                       |
| **System dependencies**       | **(included with Cinnamon & Gnome)**                   |
| `python3-gi`                  | GTK bindings for Python                                |
| `python3-gi-cairo`            | Cairo bindings for Python                              |
| `gir1.2-gtk-3.0`              | GTK+ 3.0 type information                              |
| `gir1.2-glib-2.0`             | GLib 2.0 type information                              |
| `procps`                      | For the `pkill` process management tool                |
| **GNOME dependencies**        | **(installed with install.sh)**                        |
| `gnome-extensions`            | Support for extensions in GNOME                        |
| `gnome-shell-extension-prefs` | Graphical interface for GNOME Shell Extensions         |


### Quick dependency install (if not using `install.sh`)

*   **Linux Mint / Ubuntu / Debian**:
    ```bash
    sudo apt install -y python3 python3-pillow python3-numpy libnotify-bin gettext zenity
    ```
*   **Fedora**:
    ```bash
    sudo dnf install -y python3 python3-pillow python3-numpy libnotify gettext zenity
    ```
*   **Arch Linux / Manjaro**:
    ```bash
    sudo pacman -Sy --noconfirm python python-pillow python-numpy libnotify gettext zenity
    ```

### 🗑️ Uninstallation

1.  On Cinnamon: right-click on the panel applet and select Remove. Open Applets, look for WMM Manager and click Uninstall.

2.  On GNOME: open the Extensions application, look for WMM Manager and disable it. Then use the Remove option.

3.  Delete the cache folder:
    ```bash
    rm -rf ~/.cache/wmm
    ```
4.  Remove any previously installed WMM Nemo actions (Cinnamon) or Nautilus scripts (GNOME):

    Nemo actions (Cinnamon)
    ```bash
    rm ~/.local/share/nemo/actions/wmm-*
    ```

    Nautilus scripts (GNOME)
    ```bash
    rm ~/.local/share/nautilus/scripts/wmm-*
    ```
## ⌨️ Keyboard shortcuts

If you want to force wallpaper rotation without using the mouse, you can set up a custom keyboard shortcut on your desktop. WMM includes a small script ready for this purpose.

### 🖥️ On Cinnamon

1.  Open **System Settings → Keyboard → Keyboard shortcuts**.
2.  Click **Add custom shortcut**.
3.  Name it **"WMM - Change Wallpaper"**.
4.  In the **Command** field, enter:

    ```bash
    bash -c "bash $HOME/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh"
    ```

5.  Assign your preferred key combination (for example, `Ctrl+Alt+N`).
6.  Click **Accept** and test the shortcut.

### 🖥️ On GNOME

1.  Open **Settings → Keyboard → Custom shortcuts**.
2.  Click **"+"** to add a new one.
3.  Name it **"WMM - Change Wallpaper"**.
4.  In the **Command** field, enter:

    ```bash
    bash -c "bash $HOME/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh"
    ```

5.  Assign your preferred key combination (for example, `Ctrl+Alt+N`).
6.  Close the window and test the shortcut.

**Note:** The `wmm-next.sh` script is installed automatically with WMM and should have the correct execution permissions. If the shortcut does not work, make sure the script is executable:

    ```bash
    chmod +x ~/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh   # for GNOME
    chmod +x ~/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh # for Cinnamon
    ```

## 🛠️ Debug / Log Viewer

WMM includes a built‑in log system that records engine, panel and script activity in real time. You can inspect the logs at any moment without restarting the application.

*   **Open the Log Viewer**: In the Control Panel, click the **Log** button (text‑x‑generic icon). A separate window will open showing timestamped events from the engine, panel and Nemo actions.
*   **Real‑time updates**: The viewer refreshes automatically as new events are written. Use the filters (origin, level, reason) or the search bar to find exactly what you need.
*   **Manual inspection**: The log file is stored at `~/.cache/wmm/debug.log`. You can open it with any text editor, use the viewer inside the panel, or run the following command to display it directly in a terminal:
    ```bash
    python3 ~/.local/share/cinnamon/applets/wmm-applet@maki/python/debug_logger.py
    ```

## 🌍 Translation

WMM supports multiple languages. Translations are installed automatically when running install.sh.
*   Source files are located in locale/ folder of project.
*   Interface will automatically display in your language if translations are available.
*   All translatable strings are centralized in WMM's own domain, completely independent of the system translations. This guarantees compatibility with any desktop or operating system.

If you want to help us translate WMM into your language, you are more than welcome!

## 📜 License

WMM is distributed under [GPL-3.0](LICENSE).
You are free to use, modify and distribute this software, as long as you keep same license and attribution to original authors.
