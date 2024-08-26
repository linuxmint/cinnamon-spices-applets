# Automatic dark/light themes

This Cinnamon applet brings the ability to automatically switch between dark and light themes at twilight times based on a location.

## Features

- Dump system themes settings in one click to take advantage of the Cinnamon `Themes` settings menu.
- Sync location from the system `Region` and `City` settings using a local database to determine the geographical coordinates.
- Enter manually any geographical coordinates if needed.
- Always sync instantaneously with external changes of color scheme change, region/city, time (in e.g. from a sleep wakeup).
- Fully event based (no polling).
- Automatic mode switch can be disabled.
- Dark/light mode can be switched manually.

## Applet icons legend

<div style="display: flex; align-items: center;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/icons/auto-symbolic.svg" alt="Auto" width="75" height="75" style="margin-right: 10px;">
    Automatic mode switch enabled.
</div>
<br>
<div style="display: flex; align-items: center;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/icons/auto-inverted-symbolic.svg" alt="Auto inverted" width="75" height="75" style="margin-right: 10px;">
    Automatic mode switch enabled but the current mode has been set while not in sync with the actual daytime, so any external changes won't update it until the next scheduled mode change or if entering auto mode switch again.
</div>
<br>
<div style="display: flex; align-items: center;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/icons/light-symbolic.svg" alt="Light" width="75" height="75" style="margin-right: 10px;">
    Automatic mode switch disabled and the current mode is light.
</div>
<br>
<div style="display: flex; align-items: center;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/icons/dark-symbolic.svg" alt="Dark" width="75" height="75" style="margin-right: 10px;">
    Automatic mode switch disabled and the current mode is dark.
</div>

## Dependencies

`make` and `gcc`, which can be installed on Debian-based system with `sudo apt install build-essentials`.

## Donate

[Buy me a coffee](https://buymeacoffee.com/gihaume)
