# Radio3.0 - Manual

Radio3.0 is an *Internet Radio Receiver & Recorder* applet for Cinnamon.


With Radio3.0 you can:

  * Listen thousands of internet radios.

  * Record songs or programs while listening to them.

  * Manage your list of favorite radios: add, move, remove, modify each radio of your list.

  * Create categories and sort yourself your favorite radios.

  * Save and restore entire lists of radios.

## Table of contents

  1. [Dependencies](#Dependencies)

  2. [Manual installation of the dependencies](#DepManualInstall)

    1. [Linux Mint, Ubuntu, Debian](#DepMint)

    2. [Arch](#DepArch)

    3. [Fedora](#DepFedora)

  3. [How to install the Radio3.0 applet?](#InstallApplet)

    1. [Using the Cinnamon System Settings](#InstallAppletCS)

    2. [Using the SpicesUpdate applet](#InstallAppletSU)

  4. [Where to place the Radio3.0 applet ?](#WhereToPlace)

  5. [Using the Radio3.0 applet](#UsingApplet)

    1. [Listen a radio](#ListenRadio)

    2. [Listen the last radio listened to](#ListenLastRadio)

    3. [Listen at Cinnamon startup the last radio you listened to](#ListenAtStartup)

    4. [Stop the radio](#StopRadio)

    5. [Set the volume of the radio stream](#SetVolume)

    6. [Manage the list of my radios](#ManageRadios1)

    7. [Recording a song or a radio program](#RecordingSong)

    8. [Open the folder containing my recordings](#OpenRecFolder)

    9. [Modify my recordings](#ModifyRecords)

  6. [Settings](#Settings)

    1. [Stations settings](#StationsSettings)

    2. [Behavior settings](#BehaviorSettings)

    3. [Recording settings](#RecordingSettings)

    4. [Network settings](#NetworkSettings)

<a name="Dependencies"></a>
## Dependencies

Radio3.0 uses:

  * _mpv_ (an efficient Media Player) to play the radio streams.

  * _sox_ (Sound eXchange) to record in a file the radio stream, or rather the sound coming out of your sound card.

  * _pacmd_ (PulseAudio Command) which is a _pulseaudio_ tool.

If the packages containing these tools are not already installed, you are prompted to install them when you use Radio3.0 for the first time.

<a name="DepManualInstall"></a>
## Manual installation of the dependencies

<a name="DepMint"></a>
### Linux Mint, Ubuntu, Debian

`sudo apt-get update`

`sudo apt-get install mpv libmpv1 libmpv-dev sox libsox-fmt-all pulseaudio pulseaudio-utils`

<a name="DepArch"></a>
### Arch

`sudo pacman -Syu mpv sox pulseaudio`

<a name="DepFedora"></a>
### Fedora

`sudo dnf install mpv sox pulseaudio`

<a name="InstallApplet"></a>
## How to install the Radio3.0 applet?

<a name="InstallAppletCS"></a>
### Using the Cinnamon System Settings

Right-click on a panel -> Applets -> Download tab: Download Radio3.0. Then switch on the Manage tab and add Radio3.0 to the panel.

<a name="InstallAppletSU"></a>
### Using the SpicesUpdate applet

In the SpicesUpdate menu, select Applets. Download the latest version of Radio3.0. Then switch on the Manage tab and add Radio3.0 to a panel.

<a name="WhereToPlace"></a>
## Where to place the Radio3.0 applet ?

The best place is near the _Sound_ applet. So you can easily control the general volume with the _Sound_ applet and the radio volume with the Radio3.0 applet.

(To move applets, use the "Panel edit mode" in the contextual menu of a panel. Exit this "Panel edit mode" when your applets are at the right place.)

<a name="UsingApplet"></a>
## Using the Radio3.0 applet

This applet has a menu (left-click) and a contextual menu (right-click).

Some actions can be made using middle-click or scrolling on the icon.

<a name="ListenRadio"></a>
### Listen to a radio

  * Open the menu of Radio3.0 (clicking on its icon).

  * Open the sub-menu "All my radios". This sub-menu becomes scrollable when your radio list is large.

  * Select a radio and wait some seconds.

Please note that the last five radio stations selected appear in the "Recent" part of the menu to give them quick access.

While listening a radio, the color of the symbolic icon changes (green by default; you can select another color).

<a name="ListenLastRadio"></a>
### Listen the last radio listened to

While no radio is playing, middle-click on the icon.

(Another way : Click on the first radio in the Recent section of the menu.)

<a name="ListenAtStartup"></a>
### Listen at Cinnamon startup the last radio you listened to

Check the "Radio ON at startup" option in the contextual menu.

<a name="StopRadio"></a>
### Stop the radio

There are two ways to stop the radio:

  * Click on Stop in the menu.

  * Middle-click on the icon.

While radio is OFF, the color of the symbolic is the default one (gray by default; you can select another color).

<a name="SetVolume"></a>
### Set the volume of the radio stream

Scrolling up or down on the icon adjusts the volume of the current radio stream.

Using the volume slider in the contextual menu has the same effect.

Please note that these actions have no effects on the general volume; use the icon of the _Sound_ applet to adjust the general volume.

<a name="ManageRadios1"></a>
### Manage the list of my radios

Select Configure... in the menu or in the contextual menu to access to the settings (see [below](#StationsSettings)).

<a name="RecordingSong"></a>
### Recording a song or a radio program

First way: Select _Start Recording_ in the contextual menu.

Second way: Click on the _Record this!_ button of the notification while it appears on the screen. Hovering the mouse over this button allows you to wait for the start of the song without the notification disappearing. If the notification disappears before you can click this button, you will need to use the Start recording option from the contextual menu.

The first way is always available, but the second way depends on your settings and the ability of your stream to give the title of the song or program.

While recording, the color of the symbolic icon changes (red by default; you can select another color).

Please note:

  * If the radio stream give the title of the song or program, then the recording will automatically stop at the end of this song or program. Watch out for the advertising breaks announced in the stream!

  * Otherwise you will have to stop recording yourself.

<a name="OpenRecFolder"></a>
### Open the folder containing my recordings

In the contextual menu: Open Recordings Folder.

<a name="ModifyRecords"></a>
### Modify my recordings

You can use an external program like Audacity to modify your recordings.

<a name="Settings"></a>
## Settings

Settings are accessible from the menu or from the contextual menu using the _Configure..._ option.

<a name="StationsSettings"></a>
### Stations settings

![Stations Settings Screenshot][sshot_stations_settings]



<a name="BehaviorSettings"></a>
### Behavior settings

![Behavior Settings Screenshot][sshot_behavior_settings]

<a name="RecordingSettings"></a>
### Recording settings

![Recording Settings Screenshot][sshot_recording_settings]

<a name="NetworkSettings"></a>
### Network settings

![Network Settings Screenshot][sshot_network_settings]


[sshot_stations_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_StationsSettings.png
[sshot_behavior_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_BehaviorSettings.png
[sshot_recording_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RecordingSettings.png
[sshot_network_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_NetworkSettings.png