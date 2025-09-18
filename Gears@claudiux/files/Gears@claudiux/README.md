# Gears

The `Gears@claudiux` applet allows you to run `glxgears` with some options.

Click once on this applet to start `glxgears`; click again to stop it.

## Description

The *glxgears* program is a port of the *gears* demo to GLX. It displays a set of rotating gears and prints out the frame rate at regular intervals. It has become quite popular as **basic benchmarking tool**.

## Settings

You can choose:

  * Whether or not to use a symbolic icon.
  * The color of the icon while *glxgears* is running.
  * If the window containing the rotating gears is still in the foreground (Always on top).
  * Whether *glxgears* should run in full-screen mode or not.
  * The time in seconds between two checks of the status of *glxgears* (running or stopped).
  * The type of logging: None, On hard disk, or On RAM disk.

## Context menu

The context menu (right-clicking on this applet) allows you to:

  * Refresh the status of *glxgears* (coloring this applet).
  * Change the "Always on top" status, as in settings.
  * View the logs, when the "Type of logging" is not set to None.

## About Logging

There are 3 types of logging:

  * None: all messages from *glxgears* are sent to `/dev/null` and are therefore lost.
  * On hard disk: all messages from *glxgears* are sent to `~/.config/cinnamon/spices/Gears@claudiux/glxgears.log`.
  * On RAM disk: all messages from *glxgears* are sent to `$XDG_RUNTIME_DIR/glxgears.log`. To know $XDG_RUNTIME_DIR, type `echo $XDG_RUNTIME_DIR` in a terminal.

The `glxgears.log` files are deleted each time the applet is started, and are reset each time `glxgears` is started via the applet.

## If you find this applet useful

Please [log in via Github](https://cinnamon-spices.linuxmint.com/auth/github) and increase the rating of this applet by clicking on the star at the top of this page.

Thank you!

[@claudiux](https://github.com/claudiux)
