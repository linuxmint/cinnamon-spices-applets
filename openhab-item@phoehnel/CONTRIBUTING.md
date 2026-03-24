# Contributing to OpenHAB Item Applet

Contributions are welcome! 🎉 Whether it's bug fixes, new features, or documentation improvements — feel free to open an issue or submit a pull request.

Please make sure your contributions respect the [Cinnamon Spices contributing guidelines](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md) and the [code review instructions](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/copilot-instructions.md).

## Prerequisites

- Cinnamon Desktop Environment (5.4+)
- OpenHAB server accessible on your network

## Install from Repository for Development

1. **Clone this repository:**
   ```bash
   git clone <repo-url>
   cd cinnamon-spice-openhab
   ```

2. **Create a symlink to your local Cinnamon applets directory:**
   ```bash
   mkdir -p ~/.local/share/cinnamon/applets
   ln -sf "$(pwd)/files/openhab-item@phoehnel" \
     ~/.local/share/cinnamon/applets/openhab-item@phoehnel
   ```

3. **Restart Cinnamon:**
   - Press `Alt+F2`, type `r`, press `Enter` (X11 only)
   - Or log out and back in (works on both X11 and Wayland)

4. **Add the applet to your panel:**
   - Right-click on the panel -> **Applets**
   - Search for "OpenHAB Item"
   - Click the **+** button to add it

5. **Configure the applet:**
   - Right-click the new applet -> **Configure...**
   - On the **Server** tab: enter your OpenHAB server URL (e.g., `http://openhabianpi:8080`)
   - On the **Item** tab: enter an OpenHAB item name (e.g., `LivingRoom_Light`)

6. **Add more instances** for additional items:
   - Right-click panel -> **Applets** -> add another "OpenHAB Item"
   - The server URL is shared automatically -- just configure the item name

## View Logs

- **Looking Glass**: Press `Alt+F2`, type `lg`, go to the **Log** tab
- **Journal**: `journalctl -f /usr/bin/cinnamon`

## After Code Changes

Restart Cinnamon (`Alt+F2` -> `r` -> `Enter`) to reload the applet.

## Uninstall

```bash
rm ~/.local/share/cinnamon/applets/openhab-item@phoehnel
```
Then restart Cinnamon.

## Project Structure

- `files/openhab-item@phoehnel/applet.js` -- Main TextIconApplet class
- `files/openhab-item@phoehnel/httpClient.js` -- Soup 2/3 compatible HTTP client
- `files/openhab-item@phoehnel/serverConfig.js` -- Shared server config with file monitoring
- `files/openhab-item@phoehnel/itemRenderers.js` -- Per-type icons, formatting, and popup menu controls
- `files/openhab-item@phoehnel/settings-schema.json` -- Settings UI definition

## Cinnamon Spices Guidelines

This applet follows the [Cinnamon Spices contributing guidelines](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md).
