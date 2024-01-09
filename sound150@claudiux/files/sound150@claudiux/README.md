# Sound 150%

## Summary

This sound150@claudiux applet is an improvement of the sound@cinnamon.org applet.

An option allows you to control the volume up to 150% of its nominal value.

The icon and the slider are colored according to the volume when it is greater than 100%.

A mark on sliders signals the '100%' position of volume.

From 0% to 100%: standard icons:

![sound_150_079](https://github.com/claudiux/docs/raw/master/sound150/images/sound_079.png) ![sound_150_100](https://github.com/claudiux/docs/raw/master/sound150/images/sound_100.png)

From 101 to 115%: yellow icon by default, but you can choose another color.

![sound_150_115](https://github.com/claudiux/docs/raw/master/sound150/images/sound_115.png)

From 116 to 130%: orange icon by default, but you can choose another color.

![sound_150_130](https://github.com/claudiux/docs/raw/master/sound150/images/sound_130.png)

From 131 to 150%: red icon by default, but you can choose another color.

![sound_150_150](https://github.com/claudiux/docs/raw/master/sound150/images/sound_150.png)

Note that the icons are those of the system.

An option in settings allows you to don't display colors.

## Settings

 * Settings can be accessed by right-clicking on this applet icon (Configure... option of the context menu).

 * Since version 5.0.0, settings have been presented in a new way, with 4 tabs: *Behavior*, *Sound*, *Icon*, *Shortcuts*.

### Behavior settings
![sound_150-behavior](https://raw.githubusercontent.com/claudiux/docs/master/sound150/images/sound150_behavior.png)

#### Menu

 * Control Players
 * Show Loop and Shuffle controls

#### Panel

 * Show song information on the panel
 * Actions on middle click and shift+middle click
 * Use horizontal scrolling to move between tracks
 * Show album art as icon
 * Keep album art aspect ratio
 * Hide system tray icons for compatible players

#### Tooltip

 * Show volume in tooltip
 * Show player in tooltip
 * Show song artist and title in tooltip

### Sound settings
![sound_150-sound](https://raw.githubusercontent.com/claudiux/docs/master/sound150/images/sound150_sound.png)

 * Button to open Cinnamon settings to control **maximum volume**.
 * +/- lets you adjust the **volume step**, from 1% to 10%.
 * Magnetize the 'Volume 100%' mark.
 * Always allow microphone to be reactivated

### Icon settings
![sound_150-icon](https://raw.githubusercontent.com/claudiux/docs/master/sound150/images/sound150_icon.png)

#### Icon

 * Display volume near icon
 * Adjust the **color of the icon** to the volume
 * Icon color: **101%-115%**
 * Icon color: **116%-130%**
 * Icon color: **131%-150%**
 * Button to reset these colors to default values (yellow, orange, red)
 * Show album art as icon
 * Keep album art aspect ratio

The last two options are the same as in the Behavior tab.

### Shortcuts settings
![sound_150-shortcuts](https://raw.githubusercontent.com/claudiux/docs/master/sound150/images/sound150_shortcuts.png)

#### Shortcuts

 * Show menu
 * Volume Mute
 * Volume Up
 * Volume Down

If volume shortcuts are assigned here, you may need to delete these shortcuts in Cinnamon's keyboard settings.

### Settings for older versions
Prior to version 5.0.0, all parameters were located on a single page:

![sound_150-settings](https://github.com/claudiux/docs/raw/master/sound150/images/sound-settings.png)

## Usage

 * The ***Maximum volume control*** option sets the percentage of
nominal volume you want to limit the maximum volume. Possible values are between 30% and 150%. Since Cinnamon 4.4, Cinnamon Settings are used to set this value; use the button "Maximum volume control" provided to access it.

Use with caution. Above 120%, saturation can make the sound very unpleasant, even agressive.

In a meeting room or classroom, it is often useful to be able to increase the volume beyond 100%.

On the computer of a child, reduce the maximum volume possible to take care of his hearing... and yours!


 * Use +/- to set the volume increase/decrease step size (in % of nominal volume).

 * If you don't want to change colors, there's an option to ignore them.

 * Since version 4.7.0, you can redefine multimedia shortcuts to mute, raise or lower the volume.

## Cinnamon versions

Successfully tested on Cinnamon versions 2.8 to 6.0 (Linux Mint 17.3 to 21.3).

Does not work on Cinnamon prior to version 2.8 (Linux Mint prior to 17.3).

## Themes

Tested on themes :

 * Cinnamon
 * Carta
 * CBlack
 * Graphite-Zero
 * Linux Mint
 * Mint-X (all themes)
 * Mint-Y and Mint-Y-Dark (all themes)
 * Modern-Mint-2017
 * New-Minty
 * Numix-Cinnamon and Numix-Cinnamon-Transparent
 * Spider-Void
 * Void
 * Zukitwo-Cinnamon

## Translations

The **Sound 150%** applet is designed to allow translation. A .pot template file is available, which you can use with software such as *poedit* to translate into your own language. You can then submit your translation on github, by forking [this repo](https://github.com/linuxmint/cinnamon-spices-applets) and making a pull request containing your changes.

Available translations are installed automatically when an update is performed.

[Status of translations](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/sound150%40claudiux.md#)

Many thanks to all of the translators!

We welcome any new translations or updates.

## Contributors

Many thanks to [Rodrigo-Barros](https://github.com/Rodrigo-Barros) for his patch allowing to show the Spotify-player album art!
