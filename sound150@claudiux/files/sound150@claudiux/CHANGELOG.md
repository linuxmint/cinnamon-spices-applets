### v13.2.2~20250814
  * Improved speed.
  * Code cleanup.

### v13.2.1~20250808
  * Code cleanup.

### v13.2.0~20250808
  * Removes and replaces the use of the `del_song_arts.sh` script.
  * Fixes [#7497](https://github.com/linuxmint/cinnamon-spices-applets/issues/7497)

### v13.1.2~20250624
  * Minor bugfix.

### v13.1.1~20250605
  * Improved option "View Full Album Art".

### v13.1.0~20250605
  * New option "View Full Album Art".

### v13.0.1~20250523
  * Minor bug fix.

### v13.0.0~20250523
  * Added the Menus tab in settings.
  * Keeps certain context menu submenus open.

### v12.0.4~20250519
  * Do not play sound notification when the volume has reached its maximum limit.

### v12.0.3~20250504
  * Improved album art display.

### v12.0.2~20250427
  * Minor bugfix.

### v12.0.1~20250424
  * Removes DEBUG mode.

### v12.0.0~20250424
  * Produces square rendered images from album covers to display a more pleasing icon.
  * Requires installation of imagemagick to obtain this result.

### v11.5.2~20250416
  * Bugfix related to [#7074](https://github.com/linuxmint/cinnamon-spices-applets/issues/7074)

### v11.5.1~20250415
  * Make certain tasks asynchronous to avoid blockages.

### v11.5.0~20250415
  * Best album cover change.
  * Code: subdivision into libraries.

### v11.4.0~20250408
  * Improved album art display.

### v11.3.0~20250405
  * New option: Delay between icon and album art display.

### v11.2.0~20250404
  * Horizontal panel: keep title when paused.
  * New option: "If the title is too long, end it with" (chosen characters).

### v11.1.0~20250403
  * Can transfer Artist and Title to AlbumArt3.0 desklet.

### v11.0.0~20250313
  * Works with the version 2.0.0 of the 'Album Art 3.0' desklet.

### v10.2.1~20250302
  * Improved tooltip management.

### v10.2.0~20250227
  * Do not display the tooltip when using the multimedia keys to change volume.
  * Avoid unnecessary spaces in the tooltip.
  * Code cleanup.

### v10.1.1~20250218
  * Improved tooltip layout.

### v10.1.0~20250209
  * Changes required by the Linux Mint - Cinnamon team.
  * From now on, having a horizontal OSD requires the OSD150@claudiux extension.
  * Notifications are available to help you install and enable the OSD150@claudiux extension.

### v10.0.0~20250207
  * OSD is now managed by an extension. (Cinnamon 6.4)
  * This extension is named OSD150@claudiux and it is automatically installed by this applet.
  * Added the ability to remove incompatible extensions. (See menu if they are installed. Nothing in menu? All is OK.)

### v9.2.2~20250206
  * Eliminates Cinnamon reload errors when a sound stream is playing.

### v9.2.1~20250205
  * Fixes #6854: Typo in settings.

### v9.2.0~20250203
  * Add custom commands (see Shortcuts tab in settings).
  * Fixes #6847.

### v9.1.0~20250203
  * Functional improvement.
  * When the volume step differs from 5, multimedia key shortcuts are automatically redefined.
  * Code: Avoid using 'bind' calls.

### v9.0.0~20250201
  * Major changes for OSD and menu.
  * OSD: Volume value can be displayed beside the volume bar.
  * New option for the menu: Show Media-Optical icon. Don't show it to save space and visual comfort.
  * Fixes #6830.

### v8.0.3~20250130
  * Improved OSD management.
  * Fixes #6820.

### v8.0.2~20250126
  * Improved stability with Cinnamon 6.4: More tests on the existence of objects before acting on them.

### v8.0.1~20250125
  * Increases stability with Cinnamon 6.4: Removes Lang.bind() calls.

### v8.0.0~20250119
  * Major changes for OSD, icon scrolling and stability.
  * Using mainloopTools library to manage loops.

### v7.5.0~20250111
  * Improved management of loops.

### v7.4.5~20250108
  * Improved seeker display in the menu.
  * Duration calculation becomes faster. Note that many radio stations provide the total duration every 1 second, others every 5 seconds.

### v7.4.4~20250105
  * Improved functioning.

### v7.4.3~20250104
  * Fixes #6728: Corrects a regression in Cinnamon 6.2.

### v7.4.2~20250104
  * Fixes #6728: Corrects a regression in Cinnamon 6.2.
  * Closes menu before restarting.

### v7.4.1~20250103
  * Fixes #6726: SMPlayer no longer freezes
  * Displays the thumbnail of the video viewed with SMPlayer

### v7.4.0~20241230
  * Better compatibility with Cinnamon 6.4.
  * Make optional suppressing unpleasant noise at computer shutdown. (See option in Sound tab of settings.)
  * Improves management of objects and signals when restarting this applet.

### v7.3.7~20241228
  * Improved functionality (icons and album art)

### v7.3.6~20241227
  * No error at start-up. Fixes a nasty bug!

### v7.3.5~20241226
  * Bugfixes.

### v7.3.4~20241221
  * New option to fix volume at start-up. Value -1 means "No change". (Related to #6690.)

### v7.3.3~20241212
  * Improves compatibility with Cinnamon 6.4 removing "%" after volume level.

### v7.3.2~20241206
  * Fixes OSD problems.
  * Fixes #6669.

### v7.3.1~20241130
  * Fixes #6655: The OSD is no longer displayed at startup if it is not required.


### v7.3.0~20241128
  * Add specific code for Cinnamon 6.2.


### v7.2.4~20241116
  * Fixes #6513: Always show mute icon when sound is muted.

### v7.2.3~20241021
  * Improvements to album art display.

### v7.2.2~20241019
  * Minor bug fix.

### v7.2.1~20241018
  * Some improvements to fix #6504.

### v7.2.0~20241017
  * Fixes #6504. (Improvements are planed.)

### v7.1.1~20241016
  * Avoids loud cracking sound at shutdown.
  * Option removed. This is basic now.

### v7.1.0~20241013
  * Option to try to avoid loud cracking sound at shutdown.
  * Fixes https://github.com/linuxmint/cinnamon/issues/12446.

### v7.0.0~20241011
  * Compatible with Cinnamon 6.4.

### v6.18.1~20240907
  * Fixes #6301.

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
