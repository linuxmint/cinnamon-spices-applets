# Automatic dark/light themes

This Cinnamon applet brings the ability to automatically switch between dark and light themes and desktop background at twilight times based on a location.

## Features

- Dump system themes and desktop background settings as light/dark presets in one click in order to keep using the Cinnamon settings menu.
- Sync location from the system `Region` and `City` settings using a local database to automatically determine the geographical coordinates.
- Enter manually any geographical coordinates if needed.
- Always sync instantaneously with external changes of color scheme, region/city and time (useful in e.g. after a sleep wake up).
- Fully event and scheduling based, zero polling.
- Automatic mode switch can be disabled.
- Dark/light mode can always be switched manually.
- Schedule any amount of commands to launch at twilight times.

## Applet icons legend

<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/auto-symbolic.svg" alt="Auto" width="75" height="75" style="margin-right: 20px;">
    Automatic mode switch enabled.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/auto-inverted-symbolic.svg" alt="Auto inverted" width="75" height="75" style="margin-right: 20px;">
    Automatic mode switch enabled but the current mode has been set while not in sync with the actual daytime, so any external changes won't update it until the next scheduled mode change or if entering auto mode switch again.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/light-symbolic.svg" alt="Light" width="75" height="75" style="margin-right: 20px;">
    Automatic mode switch disabled and the current mode is light.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/dark-symbolic.svg" alt="Dark" width="75" height="75" style="margin-right: 20px;">
    Automatic mode switch disabled and the current mode is dark.
</div>

## Dependencies

`make` and `g++`, which can be installed on Debian-based system with `sudo apt install make g++`.

## Feedback

Add a `⭐ Score` on the [Cinnamon spices](https://cinnamon-spices.linuxmint.com/applets/view/397) page if you like this applet.

Report issues on the [GitHub repository](https://github.com/linuxmint/cinnamon-spices-applets/issues) in mentioning `@guillaume-mueller`.

## Donate

[Buy me a coffee](https://buymeacoffee.com/gihaume)
