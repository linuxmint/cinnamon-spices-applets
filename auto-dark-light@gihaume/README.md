# Automatic dark/light themes

This Cinnamon applet brings the ability to automatically switch between dark and light appearances at twilights times based on a location or some user set schedules.

The appearance consists of:
- themes,
- desktop background,
- shell commands to be launched when switching.

## Features

- Save system themes and desktop background settings as light/dark presets in one click.
- Sync location from the system `Region` and `City` settings using a local database to automatically determine the geographical coordinates.
  - Or enter manually any geographical coordinates if needed.
- Compute twilights times from geographical coordinates and add them some offset or just set them arbitrarily.
- Always sync instantaneously with system changes of color scheme (appearance), region/city and time (useful in e.g. after a sleep wake up).
- Automatic appearance switch can be disabled.
- Dark/light appearance can always be switched manually.
- Everything is fully event-listening and scheduling based (no active polling).

## Applet icons legend

<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/auto-symbolic.svg" alt="Auto" width="75" height="75" style="margin-right: 20px;">
    Automatic appearance switch enabled.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/auto-inverted-symbolic.svg" alt="Auto inverted" width="75" height="75" style="margin-right: 20px;">
    Automatic appearance switch enabled but the current appearance has been set while not in sync with the actual daytime, so any external changes won't update it until the next scheduled appearance change or if entering in automatic appearance switch mode again.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/light-symbolic.svg" alt="Light" width="75" height="75" style="margin-right: 20px;">
    Automatic appearance switch disabled and the current appearance is light.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/dark-symbolic.svg" alt="Dark" width="75" height="75" style="margin-right: 20px;">
    Automatic appearance switch disabled and the current appearance is dark.
</div>
<div style="display: flex; align-items: center; margin-top: 20px; margin-bottom: 20px;">
    <img src="https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/auto-dark-light@gihaume/files/auto-dark-light@gihaume/5.8/icons/on-error-symbolic.svg" alt="Error" width="75" height="75" style="margin-right: 20px;">
    The applet is in an error state and is not functional. A notification should have been shown giving more details about the error. If it has disappeared, it is possible to find it in the Looking Glass logs: press Alt+F2 and enter 'lg'.
</div>

## Dependencies

`make` and `g++`, which can be installed on Debian-based system with `sudo apt install make g++`.

## Feedback

- Add a `⭐ Score` on the [Cinnamon spices page](https://cinnamon-spices.linuxmint.com/applets/view/397)'s top if you like this applet.
- Report issues or request features on the [GitHub repository](https://github.com/linuxmint/cinnamon-spices-applets/issues?q=is:issue+is:open+auto-dark-light@gihaume).
- [Buy me a coffee](https://buymeacoffee.com/gihaume) if you'd like.
