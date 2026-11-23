# CPU/GPU/RAM Viewer

A minimalist, text-based system resource monitor for the Cinnamon Desktop Environment. 

This applet displays real-time usage percentages for CPU, GPU, and RAM directly on your panel. It is designed to be lightweight, unobtrusive, and dynamic.

## Features

* **Minimalist Design:** Text-only display (e.g., `CPU %15 • GPU %30 • RAM %40`).
* **Dynamic Resizing:** The applet grows or shrinks based on the text length (no fixed width).
* **Auto-Detect GPU:**
    * **NVIDIA:** Uses `nvidia-smi` automatically if installed.
    * **AMD:** Reads directly from system files (`/sys/class/drm/...`).
    * **Intel/No GPU:** Automatically hides the GPU section if no dedicated GPU is detected.
* **One-Click Monitor:** Left-clicking the applet opens `gnome-system-monitor` directly to the **Resources** tab.
* **Native Behavior:** Fully supports right-click context menus and panel edit mode (drag & drop).

## Requirements

* **Cinnamon Desktop Environment**
* `gnome-system-monitor` (For the click action)
* `nvidia-smi` (Optional: Only required for NVIDIA GPU monitoring)

## Installation

1.  Download or clone this repository.
2.  Copy the folder to your local Cinnamon applets directory:
    ```bash
    cp -r cpugpuram-viewer@lyk4s5 ~/.local/share/cinnamon/applets/
    ```
3.  Right-click on your Cinnamon panel -> **Applets**.
4.  Find **CPU/GPU/RAM Viewer** in the *Manage* tab and add it to your panel.

## Usage

* **Left Click:** Opens System Monitor (Resources tab).
* **Right Click:** Opens the standard applet context menu (About, Remove, etc.).

## License

1.	Distributed under the MIT License.

