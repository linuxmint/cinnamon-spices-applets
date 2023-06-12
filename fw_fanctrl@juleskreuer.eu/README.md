# <img src="https://github.com/not-a-feature/fw_fanctrl_applet/blob/main/files/fw_fanctrl@juleskreuer.eu/icon.png?raw=true" height=20></img> Framework FanCTRL - Fan Strategy Control Applet for Cinnamon

[This applet](https://github.com/not-a-feature/fw_fanctrl_applet) allows you to control the fan speed strategies of Framework laptops directly from your desktop. It uses [fw-fanctrl](https://github.com/TamtamHero/fw-fanctrl) / framework-ec to select different fan speed strategies.

<img src="https://github.com/not-a-feature/fw_fanctrl_applet/raw/main/screenshot.png" width=400></img>

## Installation
Make sure [fw-fanctrl](https://github.com/TamtamHero/fw-fanctrl) is installed.
### Via Cinnamon Applet Store

    - Right click on the menu bar.
    - Open "Applets".
    - Click on "Download" tab.
    - Search for "FanCTRL".
    - Click on the install icon next to the applet name.

The applet should now be available in your Applets settings panel. Add it to your panel to start using it.

### Via Git

Clone the git repository:

    git clone https://github.com/not-a-feature/fw_fanctrl_applet

Copy the applet to your local Cinnamon applets directory:

    cp -r fw_fanctrl_applet/files/* ~/.local/share/cinnamon/applets/


The applet should now be available in your Applets settings panel. Add it to your panel to start using it.



## Usage

Once installed, click on the applet icon in your panel to open the menu. The menu displays a list of available fan speed strategies. Click on a strategy to select it. The applet will then use fw-fanctrl to apply the strategy.

## Toggle visibility of strategies
You can toggle the visibility of the default strategies in the applet settings.
It is also possible to change the icon.

<img src="https://github.com/not-a-feature/fw_fanctrl_applet/raw/main/settings.png" width=200></img>

## Custom / non-standard strategies
To add your custom strategy from fw-fanctrl to this applet, edit the `settings-schema.json` located in `~/.local/share/cinnamon/applets/fw_fanctrl@juleskreuer.eu`

- Replace the following `<NAME>` tags by the strategy name found in the fw-fanctrl config.

- Add `<NAME>` to the `strategies` list.

    ```json
    "strategies" : ["sleep", "...", "<NAME>"],
    ```

- Add following block after the `strategies` line.
  Replace `<Label for NAME>` by your desired label:

    ```json
    "<NAME>-label": {
        "type": "header",
        "description": "<Label for NAME>"
    },
    "<NAME>": {
        "type": "checkbox",
        "default": true,
        "description": "Visible"
    },
    "<NAME>-icon": {
        "type": "iconfilechooser",
        "default": "dialog-warning",
        "description": "Icon for '<Label for NAME>'"
    },
    ```
- Reload the Applet (Hamburger menu top right)



## Dependencies

This applet requires [fw-fanctrl](https://github.com/TamtamHero/fw-fanctrl) to control the fan speed.

## License
```
Copyright (C) 2023 by Jules Kreuer - @not_a_feature
This piece of software is published unter the GNU General Public License v3.0
TLDR:

| Permissions      | Conditions                   | Limitations |
| ---------------- | ---------------------------- | ----------- |
| ✓ Commercial use | Disclose source              | ✕ Liability |
| ✓ Distribution   | License and copyright notice | ✕ Warranty  |
| ✓ Modification   | Same license                 |             |
| ✓ Patent use     | State changes                |             |
| ✓ Private use    |                              |             |
```
Go to [LICENSE.md](https://github.com/not-a-feature/fw_fanctrl_applet/blob/main/LICENSE) to see the full version.