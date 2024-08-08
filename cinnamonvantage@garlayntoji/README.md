# Cinnamon Vantage for Cinnamon
This applet allows you to easily control hardware features of your Lenovo Legion or Ideapad laptop series, such as battery fast charging, battery conservation mode, hybrid graphics and more. This is meant to offer an alternative to the official and proprietary Lenovo Vantage, which happens to be Windows-only.

## Special Thanks
This applet is inspired by the Plasmoid [PlasmaVantage](https://gitlab.com/Scias/plasmavantage), available for KDE Plasma 6. This README file and some of the wording inside of the applet are taken from this project.

## Requirements
- [LenovoLegionLinux](https://github.com/johnfanv2/LenovoLegionLinux) kernel module for:
  - Windows key toggle
  - Touchpad toggle
  - Battery fast charge mode
  - Display overdrive
  - Hybrid GPU mode
- Ideapad kernel module (included in mainline Linux) for:
  - Fn lock toggle
  - Battery conservation mode
  - Always ON USB charging

## Password-less operation
The applet currently does not support password-less operations.

## Issues
- The controls state will not refresh if the plasmoid is expanded and the user uses Fn buttons or another tool to switch one of the controls.

## License
GNU Public License, Version 2.

## Credits
Official Lenovo Legion logo, recolored to fit Cinnamon's desktop.