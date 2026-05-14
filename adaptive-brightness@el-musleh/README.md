# Adaptive Brightness - Cinnamon Applet

Automatically adjusts your laptop's screen brightness based on the ambient light sensor (ALS).

## Installation

1. Copy the `adaptive-brightness@el-musleh` folder to your Cinnamon applets directory:
   `cp -r adaptive-brightness@el-musleh ~/.local/share/cinnamon/applets/`

2. **Crucial**: Ensure `metadata.json` is at the root:
   `~/.local/share/cinnamon/applets/adaptive-brightness@el-musleh/metadata.json`

3. Restart Cinnamon (`Alt + F2` → `r` → `Enter`).

4. Open **Cinnamon Settings → Applets** and enable "Adaptive Brightness".

## Setup
Run the included setup script:
`cd ~/.local/share/cinnamon/applets/adaptive-brightness@el-musleh/ && bash SETUP.sh`
