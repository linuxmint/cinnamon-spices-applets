# Screen Recorder Applet for Linux Mint Cinnamon

A lightweight, easy-to-use Cinnamon desktop applet that lets you record your screen and system audio directly from the panel. Built using standard Cinnamon JavaScript (CJS) and powered by `ffmpeg`.

## Features
* **Quick Access:** Start and stop screen recordings from a simple panel popup menu.
* **Visual Status:** The panel icon turns red and displays a "REC" label while a recording is actively in progress.
* **Smart Capture:** Automatically detects and adapts to your primary monitor's exact screen resolution, preventing out-of-bounds errors.
* **Customizable Settings:** * Toggle system audio recording on or off.
  * Choose your preferred video output format (MP4, WebM, or MKV).
  * Select a custom destination folder for your saved recordings.
* **Auto-saving:** Recordings are automatically finalized and saved to your chosen directory (defaults to `~/Videos`) with a precise timestamp.

## Prerequisites
This applet relies on `ffmpeg` as the backend recording engine. It is natively available on Linux Mint. 

Before installing, you can easily check if you already have it on your system by opening your terminal and running `ffmpeg -version`. If it is not installed or recognized, you can add it by running:

```bash
sudo apt update
sudo apt install ffmpeg
```
