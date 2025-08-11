# Brightness and gamma applet
An applet that sets brightness and gamma levels of a screen for Linux Mint Cinnamon

## Features
* Set brightness of the screen
* Set gamma of the screen
* From Cinnamon 6.4: tooltip displaying current values, as well as sunrise and sunset times.
* Customizable:
 * Customize an icon shown in a panel
 * Show: all values, brightness or gamma
 * Set: minimum and maximum value thresholds
 * From Cinnamon 6.4: disable Night Light Mode
 * From Cinnamon 6.4: set hotkeys to Increase/Decrease brightness
 * From Cinnamon 6.4: take into account sunrise and sunset times.
 * From Cinnamon 6.4: take into account the connection/disconnection of monitors.

## Installation
1. Download the applet from *Cinnamon Settings -> Applets* or extract .zip archive to `~/.local/share/cinnamon/applets`
2. Enable the applet in *Cinnamon Settings -> Applets*

## Usage
### To specify a screen and outputs:

1. Right click on the applet
2. From "Screen" submenu click on a screen
3. From "Outputs" submenu click on an output

### To configure presets:

1. Right click on the applet
2. Select "Configure Presets"
3. In the window that has just opened, set your preferences. Only the first *Start at Sunrise* and *Start at Sunset* checked boxes are taken into account.

### To configure Sunrise and Sunset times:

1. Right click on the applet
2. Select "Configure Presets"
3. In the window that has just opened, click on the *Set Sunrise and Sunset times* button.
4. A new window appears, with a *Schedule* field which can take *Automatic* and *Specify start and end time*. Select what you wish. If you choose the second option, you can set the start (i.e *sunset*) and the end (i.e *sunrise*) times.
5. Close the last window then click on the *Apply all changes* button.


### To select preset:

1. Right click on the applet
2. Open the Presets submenu.
3. Select the preset you wish to apply.

### To reload this applet:

1. Right click on the applet
2. Select the *Reload* option. Wait 1 second.



## Source code
Browse the original source of the applet in the [original repository](https://gitlab.com/cardsurf/brightness-and-gamma-applet).

Browse the latest source of the applet in the [Cinnamon Spices repository](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/brightness-and-gamma-applet%40cardsurf).
