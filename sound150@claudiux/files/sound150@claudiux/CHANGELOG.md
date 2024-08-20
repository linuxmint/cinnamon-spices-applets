### v6.18.0~20240731
  * Improves certain icons.
  * Improved support for Pulse Effects and Easy Effects.

### v6.17.3~20240702
  * Fixes #6143.

### v6.17.2~20240702
  * Fixes #6143

### v6.17.1~20240609
  * Prevents Cvc.MixerControl from being executed more than once.

### v6.17.0~20240608
  * Regression fixed: track info can be displayed on the panel again.

### v6.16.0~20240605
  * Shortcuts tab of this applet settings: Added a button to define multimedia shortcuts identical to those in Cinnamon.

### v6.15.0~20240523
  * From now on, use Ctrl+wheel or Shift+wheel to control microphone volume.
  * New option: "Display icon indicating that the microphone is activated, if applicable".
  * New icons, with green microphone.
  * Fixes FR #6026.
  * Allows user to set the time to disappear for the seeker tooltip.

### v6.14.0~20240520
  * Displays above the seeker the time it will take to be in the track if clicked.

### v6.13.0~20240514
  * Fixes #6008: Added the option to avoid displaying controllers twice.

### v6.12.0~20240512
  * Adds a keyboard shortcut to switch between players.
  * Fixes #5989.
  * Minor bugfixes and improvements.

### v6.11.0~20240506
  * Created Sounds section in Sound tab of settings.
  * Improved keyboard shortcuts management.
  * Fixes #5967.

### v6.10.0~20240424
  * Created OSD section in Sound tab of settings.
  * Adds option: Whether the media keys osd is disabled or its relative display size.

### v6.9.1~20240420
  * Fixes #5767.

### v6.9.0~20240417
  * Better management of art-covers.

### v6.8.0~20240416
  * Fixes #5721: Adds Previous and Next track shortcuts.

### v6.7.3~20240410
  * Fixes #5678: Adds an option to keep open the player list in menu.

### v6.7.2~20240402
  * New option: whether show OSD on startup.

### v6.7.1~20240401
  * Improves 'audio-volume-muted' icons.

### v6.7.0~20240329
  * New icons.

### v6.6.0~20240328
  * Greater interaction with Radio3.0@claudiux: The Previous, Next, Stop and Close buttons act on this applet.

### v6.5.7~20240328
  * Finalizing bug fixes.


### v6.5.6~20240327
  * Some bugfixes.

### v6.5.5~20240322
  * Fixes #5622 (icon when a browser is the source).

### v6.5.4~20240322
  * Improves playerctld management.

### v6.5.3~20240321
  * Runs playerctld, if exists.
  * Minor bugfixes.
  * Ready for LM 22.
  * Fixes #5616.

### v6.5.2~20240320
  * Fixes  #5604

### v6.5.1~20240320
  * Improved seeker for Spotify.

### v6.5.0~20240319
  * Improved seeker. Elapsed time and duration are now displayed on either side of the seeker in the menu.

### v6.4.3~20240317
  * Removes CR errors (A wrong style had been applied; style=null should be used instead of style="").

### v6.4.2~20240315
  * Allows the user to remove the sound@cinnamon.org applet from the panel, as it is incompatible with sound150@claudiux.
  * Fixed bugs concerning icon adaptation to volume or microphone level.

### v6.4.1~20240313
  * Bugfixes about ZettaLite data.

### v6.4.0~20240312
  * Adds keyboard shortcut Pause/Play.

### v6.3.5~20240311
  * Take into account XML data from ZettaLite to get artist and title.

### v6.3.4~20240310
  * Redefining volume keyboard shortcuts becomes optional.


### v6.3.3~20240310
  * Fixes definitively #5576.

### v6.3.2~20240309
  * Fixes  #5579.

### v6.3.1~20240308
  * Fixes #5576.

### v6.3.0~20240308
  * Allows to display icon indicating that the microphone is muted, if applicable.
  * Sound volume: Now can magnetize all multiples of 25%.

### v6.2.2~20240304
  * Removes error messages about length which wasn't an valid value.

### v6.2.1~20240226
  * Helps the user to install playerctl.
  * icon.png replaced.


### v6.2.0~20240225
  * Displays the cover of the song broadcast by the Radio3.0@claudiux applet, when available.

### v6.1.0~20240224
  * Fixes song art display for vlc when changing song.
  * Adds the easyeffects option to the context menu when installed, to launch it.

### v6.0.0~20240221
  * The art album icon is now correctly removed when changing streams.
  * Shows album art (or song art) even if mpris:artUrl is not in the metadata!

### v5.1.1~20240118
  * Use Ctrl-Middle-Click or Shift-Middle-Click to toggle mute as defined in settings.
  * Takes into account an undefined input.
  * Updates French translation.

### v5.1.0~20240109
  * Updates README.md
  * Adds two options to the Icon tab settings that are already in the Behavior tab, but which also concern the icon.

### v5.0.0~20240109
  * Modifies the presentation of settings, with tabs.
  * Allows the user to change the icon colors.

### v4.7.0~20240106
  * Adds the ability to redefine multimedia shortcuts.

### v4.6.0~20231216
  * Adds the ability to display the volume level near the icon.

### v4.5.0~20231124
  * Adds a shift-middle click action (mute/unmute microphone by default). Thanks to @sphh!

### v4.4.1~20231103
  * Update the contextual menu when flipping the 'Mute input' switch in the settings.

### v4.4.0~20231101
  * Allow to always show the 'Mute input' switch in contextual menu.

### v4.3.0~20231026
  * Fixes 5005: Icon color changing with theme

### v4.2.0~20231012
  * Try to distinguish between the artist and the song title.

### v4.1.1~20230719
  * Change style of 'sound-player-overlay' with "height: auto;". Thanks to Hilyxx!

### v4.1.0~20230717
  * Show entire title (wrapped) in player section (opening menu). Look at [discussion 79](]https://github.com/orgs/linuxmint/discussions/79).
### v4.0.0~20230701
  * Fixes alignment error, like the sound Cinnamon applet (Cinnamon 5.8).

### v3.1.0~20230520
  * Fixes a deprecation.

### v3.0.0~20230310
  * Rebase and update for cinnamon 5.4 (thanks to @rcalixte).
  * Overwrite existing binding of AudioRaiseVolume and AudioLowerVolume keysym. (Fixes [issue #9919](https://github.com/linuxmint/cinnamon/issues/9919))

### v2.0.0~20200731
  * New code for Cinnamon 4.4 (Mint 19.3) and Cinnamon 4.6 (Mint 20).
  * During volume slider dragging, a tooltip containing the value of the volume percentage is shown.
  * Now use Cinnamon Settings to set amplification (ie change the value of maximum volume).
  * The @Rodrigo-Barros patch to show Spotify-Player album art is now included! Many thanks to him!

### v1.5.1
 * Fixes a typo.
### v1.5.0
 * Fixes an issue in Cinnamon 3.6.x, setting right permissions to script files

### v1.4.2
 * Change the appearance of the applet icon when colors are not in use, to better alert the user when the sound is greater than 100%.

### v1.4.1
 * The magnetic property of the 100% mark becomes optionnal.
 * Translations:
   * Available languages: English, French, Spanish, Italian, Russian and now **Danish** (thanks to @Alan01!).

### v1.4.0
 * The 100% mark in sound settings becomes magnetic.
 * The applet and sound settings sliders become synchronized.

### v1.3.4
 * This sound150@claudiux applet becomes multiversion:
   * Cinnamon **3.4** & **3.6** (Linux Mint **18.2** & **18.3**)
   * Cinnamon **2.8**, **3.0** & **3.2** (Linux Mint **17.3**, **18** & **18.1**)
 * Seems to be ready for Cinnamon **3.8** (Linux Mint **19**). Thanks to @jaszhix !

### v1.3.3
 * This sound150@claudiux applet becomes multiversion:
   * Cinnamon 3.6 (Linux Mint 18 to 18.3)
   * Cinnamon 2.8 (Linux Mint 17.3) (**NEW**)

### v1.3.2
 * Translations:
   * Available languages: English, French, Spanish, Italian, and now **Russian** (thanks to @sem5959!).

### v1.3.1
 * Fixes a bug : Now, the reloading of this applet after installing new .mo files (for translations) takes place a few seconds after it is initialized, to avoid a crash of the applet or even Cinnamon.
 * Code modified to suit the import methods of .js files in Cinnamon 3.8. Thanks to @jaszhix!

### v1.3.0
 * No more stylesheet.css; uses theme's style sheet for better look.
 * Colors become optionnal.
 * Applet is now able to increase the volume up to maximum of capabilities of the sound card. But to let a security margin, this option is not proposed to user.
 * Set scripts/generate_mo.sh executable.
 * Set default max volume to 150%.

### v1.2.0
 * Added a mark on the sliders to signal the '100%' position of the volume.

### v1.1.0
 * Possibility of choosing, in settings, the value of incrementation/decrementation of the volume (in % of nominal volume).
 * The "100%" value is magnetic.

### v1.0.0
 * Allows to set maximum volume up to 150% of the nominal volume of the sound card.
 * Displays coloured icons and slides when volume is greater than 100%.
 * Translations:
   * Automatic installation of the translation files.
   * Available languages: English, French, Spanish, Italian.
   * The sound150@claudiux.pot file is present in the /po directory.
