# Net Speed

A lightweight, text-only network speed applet for Linux Mint Cinnamon.

Net Speed displays real-time download and upload speeds directly on the panel,
without icons, menus, or hover interactions.


<img width="1366" height="768" alt="screenshot" src="https://github.com/user-attachments/assets/26db130a-cd0f-494b-97a3-c36c12bdd90b" />


## Features
- Text-only display on the Cinnamon panel
- Real-time download (↓) and upload (↑) speed
- Auto-detects the active network interface
- Ignores loopback and inactive interfaces
- Optional compact and vertical display modes
- Configurable refresh interval
- Low CPU and memory usage
- No root permissions required

## Installation
Right-click the Cinnamon panel → Applets → Download → search for **Net Speed**.

## Local Installation (for development)
Copy the applet folder to:

~/.local/share/cinnamon/applets/

Then reload Cinnamon (`Alt + F2`, type `r`, press Enter).

## License
MIT