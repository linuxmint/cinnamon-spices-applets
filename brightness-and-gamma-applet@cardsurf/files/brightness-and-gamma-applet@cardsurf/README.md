# Brightness and gamma applet
An applet that sets brightness and gamma levels of a screen for Linux Mint Cinnamon

## Features
* Set Brightness of the screen
* Set Red-Green-Blue Gamma of the screen
* Set Screen Temperature (K)
* From Cinnamon 6.4: tooltip displaying current values, as well as sunrise and sunset times.
* Customizable:
 * Customize an icon shown in a panel
 * Show: all values, brightness or gamma (or screen temperature)
 * Set: minimum and maximum value thresholds
 * From Cinnamon 6.6: set screen temperature (in K)
 * From Cinnamon 6.4: disable Night Light Mode
 * From Cinnamon 6.4: set hotkeys to Increase/Decrease brightness
 * From Cinnamon 6.4: take into account sunrise and sunset times.
 * From Cinnamon 6.4: take into account the connection/disconnection of monitors.
 * You can set *presets* with specific brightness and gamma (or screen temperature) values; you can also choose keyboard shortcuts to activate each preset.
 * You can select the preset to use at sunrise and sunset.

## Dependencies
`xrandr` and `xsct` must be installed in order to use all the features of this applet.

## Installation
1. Install `xsct` using the command `apt install xsct` in a terminal of Linux Mint.
2. Download the applet from *Cinnamon Settings -> Applets* (*Download* tab) - or extract the .zip archive to `~/.local/share/cinnamon/applets`
3. Enable the applet in *Cinnamon Settings -> Applets* (*Manage* tab, select this applet the use the [+] button to add it on a panel).

## Usage
### To specify screen and outputs:

1. Right click on the applet
2. From "Screen" submenu click on a screen
3. From "Outputs" submenu click on an output

### To select the Setting Method:
1. Right click on the applet
2. Select Configure...
3. Choose between "Gamma Red-Green-Blue" or "Screen Temperature (K)"
4. If you cannot choose the Setting Method, it means that you have not installed `xsct`. Maybe you need to restart this applet, or restart Cinnamon.
5. Click on the button: *Apply the selected method".
6. The contents of the *Presets* tab change according to the Setting Method selected.

### To configure presets:

1. Right click on the applet
2. Select "Configure Presets"
3. In the window that has just opened, set your preferences. Only the first *Start at Sunrise* and *Start at Sunset* checked boxes are taken into account. You can choose which shortcut to use for each preset.

### To configure Sunrise and Sunset times:

1. Right click on the applet
2. Select "Configure Presets"
3. In the window that has just opened, click on the *Set Sunrise and Sunset times* button.
4. A new window appears, with a *Schedule* field which can take *Automatic* and *Specify start and end time*. Select what you wish. If you choose the second option, you can set the start (i.e *sunset*) and the end (i.e *sunrise*) times.
5. Close the last window then click on the *Apply all changes* button.


### To select preset:

1. Click on the applet and Select the preset you wish to apply.
2. Or right-click on the applet and open the Presets submenu, then select the preset you wish to apply.

### To reload this applet:

1. Right click on the applet
2. Select the *Reload* option. Wait 1 second.



## Source code
Browse the original source of the applet in the [original repository](https://gitlab.com/cardsurf/brightness-and-gamma-applet) (very old code).

Browse the latest source of the applet in the [Cinnamon Spices repository](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/brightness-and-gamma-applet%40cardsurf).
