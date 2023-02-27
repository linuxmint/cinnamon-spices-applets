<!-- Required extensions: sane_lists, headerid(level=4) -->
# Radio3.0 - Manual

## Author: Claudiux (@claudiux on Github)

### Last revision date: December 19, 2022

***

## Overview

Radio3.0 is an *Internet Radio Receiver & Recorder* applet for Cinnamon.


With Radio3.0 you can:

  * Listen to any type of radio stream (MP3, AAC, AAC+, OGG, FLAC, FLV...)

  * Modify the sound volume of the radio, independent of the general sound volume.

  * Perform research in an internet database that references tens of thousands of radio stations.

  * Import files containing the URL of radio station streams, obtained from internet directories such as SHOUTcast.

  * Create your list of favorite radio stations, accessible by the menu of this applet.

  * Manage your list of favorite radios: add, move, remove, modify each radio of your list.

  * Create categories and sort yourself your favorite radios.

  * Save and restore entire lists of radios.

  * Record songs or programs while listening to them.

  * Schedule background recordings.

  * Try to record from YouTube the currently playing song. (Unsafe; another song can be recorded.)

  * Watch videos on YouTube about the song being played.

  * Extract the soundtrack of a YouTube video.

  * Launch and use _Pulse Effects_ (if installed) for amazing sound experience.

![Screenshots of Menu and Contextual menu][screenshot]{ width=660px }

***

<a name="TOC"></a>
## Table of contents

  1. [Dependencies](#Dependencies)

  1. [Manual installation of the dependencies](#DepManualInstall)  
      1. [Linux Mint, Ubuntu, Debian](#DepMint)  
      1. [Arch](#DepArch)  
      1. [Fedora](#DepFedora)  

  1. [How to install the latest version of yt-dlp?](#InstallYtdlp)

  1. [How to install the Radio3.0 applet?](#InstallApplet)  

  1. [Where to place the Radio3.0 applet icon?](#WhereToPlace)

  1. [Using the Radio3.0 applet](#UsingApplet)  
      1. [How to add radio stations to my list?](#HowToAdd)  
      1. [Listen a radio](#ListenRadio)  
      1. [Listen the last radio listened to](#ListenLastRadio)  
      1. [Listen at Cinnamon startup the last radio you listened to](#ListenAtStartup)  
      1. [Stop the radio](#StopRadio)  
      1. [Set the volume of the radio stream](#SetVolume)  
      1. [Manage the list of my radios](#ManageRadios1)  
      1. [Recording a song or a radio program](#RecordingSong)  
      1. [Extract the soundtrack of a YouTube video](#RecordYTSoundtrack)
      1. [Open the folder containing my recordings](#OpenRecFolder)  
      1. [Modify my recordings](#ModifyRecords)  

  1. [Settings](#Settings)  
      1. [Radios](#RadiosTab)  
        * [Stations and Categories on the menu](#RadiosTabStations)  
        * [Moving selected stations/categories](#RadiosTabMoving)  
        * [Save and restore](#RadiosTabSaveRestore)  
        * [Update your list using the Radio Database](#RadiosTabUpdate)  
      2. [Search](#SearchTab)  
        * [Search Form](#SearchTabForm)  
        * [Search Résults](#SearchTabResults)  
      3. [Import](#ImportTab)  
      4. [Menu](#MenuTab)  
      5. [Network](#NetworkTab)  
      6. [Behavior](#BehaviorTab)  
      7. [Recording](#RecordingTab)  
      8. [YT](#YTTab)
      9. [Scheduling](#SchedulingTab)  

  1. [Optional: Install PulseEffects](#PulseEffects)


  + [Annex](#Annex)

***
<a name="Dependencies"></a>
## Dependencies

Radio3.0 uses:

  * _mpv_ (an efficient Media Player) to play the radio streams.

  * _sox_ (Sound eXchange) to record in a file the radio stream, or rather the sound coming out of your sound card.

  * _pacmd_ (PulseAudio Command) which is a _pulseaudio_ tool.

  * _at_ to schedule recordings.

  * _libnotify-bin_ to display notifications.

  * _youtube-dl_ or _yt-dlp_ (faster than _youtube-dl_) to download videos from YT.

  * _ffmpeg_ and _ffmpegthumbnailer_ to extract the soundtrack from the downloaded video.

  * _python3-polib_ to install translations, when exist.

  * _python3-brotli_ needed by _yt-dlp_.

If the packages containing these tools and libraries are not already installed, you are prompted install them when using Radio3.0 for the first time.

You can also install _Pulse Effects_ to use several sound effects (reverb, etc) but this is optional.

[Return to Table Of Contents](#TOC)

<a name="DepManualInstall"></a>
## Manual installation of the dependencies

<a name="DepMint"></a>
### Linux Mint, Ubuntu, Debian

`sudo apt update`

`sudo apt install mpv libmpv1 libmpv-dev sox libsox-fmt-all pulseaudio pulseaudio-utils at libnotify-bin youtube-dl ffmpeg ffmpegthumbnailer python3-polib python3-brotli`

Optionally:

`sudo apt install pulseeffects`

<a name="DepArch"></a>
### Arch

`sudo pacman -Syu mpv sox pulseaudio at libnotify youtube-dl ffmpeg ffmpegthumbnailer python-brotli`

`yay -S python-polib`

To install Yay on in Arch Linux and other Arch-based systems, run the following commands one by one:

`sudo pacman -S --needed git base-devel`

`git clone https://aur.archlinux.org/yay.git`

`cd yay`

`makepkg -si`

<a name="DepFedora"></a>
### Fedora

`sudo dnf install mpv sox pulseaudio at libnotify yt-dlp ffmpeg gstreamer1-libav python3-brotli python3-polib`

[Return to Table Of Contents](#TOC)

***
<a name="InstallYtdlp"></a>
## How to install the latest version of yt-dlp?
Please note that from version 1.0.3, Radio3.0 automatically installs and updates _yr-dlp_ in your `~/bin/` directory.

_yt-dlp_ is used by **Radio3.0** to download videos from YouTube.

The latest version of _yt-dlp_ fixes bugs and in particular takes better account of your browser's cookies so as not to deprive you of the right to download videos for age limit reasons.

Here's how to install its latest version:

  1. Start by installing the version of _yt-dlp_ present in your distro's package repositories, as this also installs all of its dependencies. For example: `sudo apt install yt-dlp`
  1. Create the `$HOME/bin` directory that will contain this new version: `mkdir -p $HOME/bin`
  1. Download the latest version for Linux from [https://github.com/yt-dlp/yt-dlp/releases/latest](https://github.com/yt-dlp/yt-dlp/releases/latest) and save it in the `$HOME/bin` directory that you just created.
  1. Make it executable: `chmod +x $HOME/bin/yt-dlp`
  1. Log out from your session.
  1. Log in. Now any script in your `$HOME/bin` directory takes precedence over any other script with the same name on your system.

***

<a name="InstallApplet"></a>
## How to install the Radio3.0 applet?

![Radio3.0 - Installing applet and dependencies](https://claudeclerc.fr/downloads/Radio3.0/Radio3.0-Install.gif)

<a name="InstallAppletCS"></a>

Right-click on a panel -> Applets -> Download tab: Download Radio3.0. Then switch on the Manage tab and add Radio3.0 to the panel.

<a name="WhereToPlace"></a>
## Where to place the Radio3.0 applet icon?

The best place is near the _Sound_ applet. So you can easily control the general volume with the _Sound_ applet and the radio volume with the Radio3.0 applet.

(To move applets, use the "Panel edit mode" in the contextual menu of a panel. Drag-and-drop icons. Exit this "Panel edit mode" when your applet icons are at their right place.)

[Return to Table Of Contents](#TOC)

***

<a name="UsingApplet"></a>
## Using the Radio3.0 applet

This applet has a menu (left-click) and a contextual menu (right-click).

Some actions can be made using middle-click or scrolling on the icon.

<a name="HowToAdd"></a>
### How to add radio stations to my list?
There are four ways to add at least one radio station in your list.

  1. In the menu, select the "Search for new stations..." option. (You also can use the "Configure..." option in the contextual menu, then select the "Search" tab.) Use the form to query the internet database containing several tens of thousands of references.

  1. You can import files containing radio station data, using the "Import" tab (with the same "Configure..." option of the contextual menu).

  1. You can directly add a radio station to your list, if you know its stream URL. Your list is in the "Radios" tab (the first tab opened when you select "Configure..."). Use the `[+]` button to add a radio station. Only the "Name" and "Stream URL" fields are required; the others are optional. The "Codec" and "Bitrate" fields will be automatically filled in after the radio is stopped.

  1. Restore the Radio3.0_EXAMPLES.json list, using the button located in the first tab of this applet settings. Beware, your station list will be replaced by this one; think to save your own station list before to do that!

Each of these tabs contains some explanations for using it. These can be skipped by unchecking the appropriate box in the "Behavior" tab.

<a name="ListenRadio"></a>
### Listen to a radio

  * Open the menu of Radio3.0 (clicking on its icon).

  * Open the sub-menu "All my radios".

  * Select a radio station and wait some seconds. The waiting time depends on the distance that separates you from the stream server and the quality of this stream.

Please note that the last radio stations selected appear in the *Recently Played Stations* part of the menu to give them quick access.

While listening a radio, the color of the symbolic icon changes (green by default; you can select another color).

<a name="ListenLastRadio"></a>
### Switch on the last radio station listened to

While no radio is playing, middle-click on the icon.

(Another way : Click on the first radio in the *Recently Played Stations* section of the menu.)

<a name="ListenAtStartup"></a>
### Play at Cinnamon startup the last radio you listened to

Check the "Radio ON at startup" option in the contextual menu.

<a name="StopRadio"></a>
### Stop the radio

There are two ways to stop the radio:

  * By choosing *Stop* in the menu.

  * Making a middle-click (i.e clicking with the mouse wheel) on the icon.

While radio is OFF, the color of the symbolic is the default one (gray by default; you can select another color).

<a name="SetVolume"></a>
### Set the volume of the radio stream

Scrolling up or down on the icon adjusts the volume of the current radio stream.

Using the volume slider in the contextual menu has the same effect.

Please note that these actions have no effects on the general volume; use the icon of the _Sound_ applet to adjust the general volume.

<a name="ManageRadios1"></a>
### Manage the list of my radios

Select *Configure...* in the menu or in the contextual menu to access to the settings (see [below](#RadiosTab)).

<a name="RecordingSong"></a>
### Record a song or a radio show

<u>Condition</u>: Check the box in the Consent section of the Recordings tab in this applet's settings.

<u>First way</u>: Select _Start Recording_ in the contextual menu.

<u>Second way</u>: Click on the _Record from now_ button of the notification while it appears on the screen. Hovering the mouse over this button allows you to wait for the start of the song without the notification disappearing. If the notification disappears before you can click this button, you will need to use the *Start Recording* option from the contextual menu.

This second way depends on the ability of your stream to give the title of the song or show.

While recording, the color of the symbolic icon changes (red by default; you can select another color).

<u>Please note</u>:

  * If the radio stream give the title of the song or show, then the recording will automatically stop at the end of this song or program. Watch out for the advertising breaks announced in the stream!

  * Otherwise you will have to stop recording yourself (using the contextual menu).

  * Recording starts at the moment of the click; it is not possible to start it earlier. Too few stations announce the next song several seconds in advance.

  * Recording usually ends a few seconds after the song ends, as it continues while the cache empties.

<a name="RecordYTSoundtrack"></a>
### Extract soundtrack from YouTube video

In the contextual menu: Extract soundtrack from YouTube video...

Then go to the bottom of the window that has just appeared, paste the URL of the YouTube video in the appropriate field and click on "Extract soundtrack".


<a name="OpenRecFolder"></a>
### Open the folder containing my recordings

In the contextual menu: Open Recordings Folder.

<a name="ModifyRecords"></a>
### Modify my recordings

You can use an external program like Audacity to modify your recordings.

[Return to Table Of Contents](#TOC)

***

<a name="Settings"></a>
## Settings

Settings are accessible from the menu or from the contextual menu using the _Configure..._ option.

![Settings Tabs][sshot_settings_tabs]{ width=600px }

There are 9 tabs in the Radio3.0 Settings:

| [Radios](#RadiosTab) | [Search](#SearchTab) | [Import](#ImportTab)| [Menu](#MenuTab)| [Behavior](#BehaviorTab)| [Network](#NetworkTab)| [Recording](#RecordingTab)| [YT](#YTTab)| [Scheduling](#SchedulingTab)|
|----------------------|----------------------|---------------------|-----------------|-------------------------|-----------------------|---------------------------|--------------|-----------------------------|

[Return to Table Of Contents](#TOC)

<a name="RadiosTab"></a>
### Radios

<a name="RadiosTabStations"></a>
#### Stations and Categories on the menu

![Radios Settings Screenshot][sshot_radios_tab1]{ width=670px }

This is an example of radio stations list.

Three Categories are visible: **Hard Rock & Metal**, **Reggae** and **Techno / Dance**. They have their Streaming URL empty.

All the others are radio stations. Those whose **Menu** box is checked appear in the menu of this applet (in the My Radio Stations sub-menu; see below). Those whose **♪/➟** box is checked can be immediately played (one after the other) using the **♪ Play the next station to test** button.

Each Category or Station can be moved using **drag-and-drop**.

Below this list, the left part contains **tools** to modify the contents of the list:

  * ![Plus button][plus_button] to **add** a Category (only fill in its name) or Station (fill in at least its name and its streaming URL). The added item is at the very top of the list.

  * ![Minus button][minus_button] to **remove** the selected item. (You select an item by clicking on it.)

  * ![Pencil button][pencil_button] to **edit** the selected item.

  * ![Unchecked button][unchecked_button] to **unselect** any item.

  * ![Move up button][moveup_button] to **move up** the selected item.

  * ![Move down button][movedown_button] to **move down** the selected item.

The right part contains tools to explore your list:

  * ![Top button][top_button] to go to the **top** of your list.

  * ![Move up button][moveup_button] to go to the **previous page**.

  * ![Move down button][movedown_button] to go to the **next page**.

  * ![Bottom button][bottom_button] to go to the **bottom** of your list.

  * ![Previous Category button][prevcat_button] to go to the **previous Category** (or **next Category** for right-to-left readers).

  * ![Next Category button][nextcat_button] to go to the **next Category** (or **previous Category** for right-to-left readers).

![Sub-menu My Radio Stations][sshot_menu_myradiostations]{ width=350px }

<a name="RadiosTabMoving"></a>
#### Moving selected stations/categories

![Radios Settings Screenshot 2][sshot_radios_tab2]{ width=670px }

To change the category of certain items, select them by checking their **♪/➟** box, choose the category from the drop-down list and click on the "Move selected stations to this category" button.

To see the result and make any adjustments, then click on "Go to this category".

Tip: You can create a temporary category and move it to the right place, then move those selected items to that category before deleting it.

<a name="RadiosTabSaveRestore"></a>
#### Save and restore

![Radios Settings Screenshot 3][sshot_radios_tab3]{ width=670px }

**Save** (backup) your list of stations before editing or updating it. This creates a `.json` file containing all the details of your stations and categories. The name of this `.json` file describes the date and time of the backup; example: `Radios_2022-02-21_22-23-55.json` was created on February 21, 2022 at 10:23:55 p.m.

**Restore** a previously saved station list.Beware: Your list will be entirely replaced by the restored list.

By opening the folder containing these lists, you can manage them. In particular, you can rename them at your convenience.

<a name="RadiosTabUpdate"></a>
#### Update your list using the Radio Database

![Radios Settings Screenshot 4][sshot_radios_tab4]{ width=670px }

The purpose of the button **Update my station list with the Radio Database data** is to complete the empty fields of your radios as much as possible.

If the consulted database contains the streaming URL that you have declared for a station, then a UUID (Universal Unique IDentifier)  will be assigned to this station.

If one of your stations is no longer reachable, try updating your list. This station's broadcast URL may have changed and if it has a UUID, its new URL may be assigned to it.

An update will not change the name you have given to a station.

Notes:

  * If a station comes from the database (Search tab), it already has a UUID.

  * If it comes from another source, it may be unknown to the database; it will then not be assigned a UUID.

[All Tabs](#Settings)

<a name="SearchTab"></a>
### Search

This tab is directly accessible by the _Search for new stations_ option in the menu.

<a name="SearchTabForm"></a>
#### Search form

![Search Form Screenshot][sshot_search_tab1]{ width=670px }

Filling in at least a few fields of this form then clicking on the 'Search ...' button you can search for other stations in a free radio database accessible via the Internet.

Each time the 'Search ...' button is clicked, a new results page is displayed in the second part of this tab, where you can test certain stations and include them in the menu.

A station already in your menu will only appear in search results if its streaming URL has changed.

When no new page appears, it means that all results matching your search criteria have been displayed.

If you modify at least one of your criteria, remember to set the 'Next page number' field to 1.

As usual, the 'Reset' button resets every field on this form to its default value.

<a name="SearchTabResults"></a>
#### Search results

To obtain these results, the search form was reset and then filled with:

  - Tag: metal
  - Codec: AAC
  - Order: bitrate

![Search Results Screenshot][sshot_search_tab2]{ width=700px }

To test 'TheBlast.fm', check its **♪** box then click on the **♪ Play the next station to test** button. Please note: testing a radio station adds it to the "Recently Played Stations" in this applet menu, but does not add it to your station list.

To import at the top of your own list one or more of these stations, check their **Select** box and click on the **Import the selected stations into my own list**. Then, manage your list using the Radios tab.

You can remove rows from these search results, by checking their **Select** box then clicking on the **Remove...** button. This action does not affect the contents of the database.

The **Select all items** and **Unselect all items** buttons act on the **Select** boxes.

**<u>Warning</u>**: *The author of this applet is not responsible for the results displayed after a search and does not control the content of the databases. If radio stations broadcast messages or ideologies that bother you, please complain to their owners or the state/country they are broadcasting from.*

[All Tabs](#Settings)

<a name="ImportTab"></a>
### Import
This tab allows you to import radio stations from files in M3U, PLS or XSPF format, especially those from the [Shoutcast][shoutcast] directory.

#### Get files on Shoutcast to import here

![Import Settings Screenshot 1][sshot_import_tab1]

This button opens the Shoutcast directory in your browser.

![Shoutcast Baroque][shoutcast_baroque]

In the example above, we see how to access the XSPF file of a radio station. Save this file giving it the name of the radio, while keeping its .xspf extension.

![Shoutcast Save][shoutcast_save]

<a name="FileToImport"></a>
#### File to import

![Import Settings Screenshot 2][sshot_import_tab2]

This button allows you to import a file containing radio stations data.

The description of the different importable file formats is given in the [Annex 1](#Annex1).

[All Tabs](#Settings)

<a name="MenuTab"></a>
### Menu

![Menu Settings Screenshot][sshot_menu_tab]

This tab allows you to choose whether or not to display certain items in the this applet menu:

  + The name and version of this applet, like: Radio3.0 v1.0.0.
  + The number of *Recently Played Stations*. A value of 0 disables the display of this list.
  + System items, like *Configure...* and *Sound Settings* (which are already in the contextual menu).

Privacy: If you want to empty your Recently Played Stations list at startup or now, check the box or click on the button.

Useful only for developers: Whether or not to display the *Reload this applet* item in the contextual menu.

[All Tabs](#Settings)

<a name="BehaviorTab"></a>
### Behavior

![Behavior1 Settings Screenshot][sshot_behavior1_settings]{ width=700px }

Turn on the radio when Cinnamon starts up: When checked, the last station listened to will be played at Cinnamon start up.

Volume level starting a new radio: Choose this volume. Set it to '(Undefined)' to leave the volume at its last value.

Do not check about dependencies: Check this box when all dependencies are already installed, or when certain dependencies are useless (because you have alternatives).

![Behavior2 Settings Screenshot][sshot_behavior2_settings]{ width=700px }

Volume step scrolling on icon: Choose this step. 0% deactivate volume change scrolling on icon.

![Behavior3 Settings Screenshot][sshot_behavior3_settings]{ width=700px }

Choose the help you want to display.

![Behavior4 Settings Screenshot][sshot_behavior4_settings]{ width=700px }

Choose which notifications you want to display; also the duration of the second kind of notification.

![Behavior5 Settings Screenshot][sshot_behavior5_settings]{ width=700px }

Whether or not to show Codec and Bit Rate in menu and notifications.

![Behavior6 Settings Screenshot][sshot_behavior6_settings]{ width=700px }

Choose the color of the symbolic icon when the radio is on, when the radio is off and during recording.

[All Tabs](#Settings)

<a name="NetworkTab"></a>
### Network

![Network Settings Screenshot][sshot_network_settings]{ width=700px }

Network Quality:

  * High: The recordings will be made from a copy of the stream, which guarantees optimal quality.
  * Low: To save your bandwidth, recordings will be made from your audio output; but some sounds can pollute your recordings.

Monitor the network: When checked, the station played will continue after changing the network (VPN, Wifi...)

Proxy: Empty by default. Format: http://[user:pass@]URL[:port]. If empty, the environment variables *http_proxy* and *ALL_PROXY* will be used if present. If set, this proxy will not be used for https requests.

Database Info (read only): The URL of the radio database actually used.

[All Tabs](#Settings)

<a name="RecordingTab"></a>
### Recording

![Recording Settings Screenshot][sshot_recording_settings]{ width=700px }

Path to the folder that will contain your future recordings: Choose this folder.

Set this path to default one, which is `~/Music/Radio3.0`. (_Music_ is localized.)

Recording format: FLAC, MP3 (default), OGG, RAW or WAV.

Way to stop recording (please note that this choice will have no effect on any current recording, but on subsequent ones.):

  * automatically, when the current song ends: works correctly only if the stream contains the title of the current song.
  * manually; thus, several recordings can follow one another: you must stop yourself all recording.

[All Tabs](#Settings)

<a name="YTTab"></a>
### YT
This tab is directly accessible via the _Extract soundtrack from a YouTube video..._ option in the contextual menu.


![YT Settings Screenshot][sshot_yt_settings]{ width=700px }

Recording format: FLAC, MP3, OGG, RAW and WAV are available formats. MP3 (192 kbps) is selected by default.

Use cookies from: Select the browser you usually use to visit YouTube.

Extract soundtrack from YouTube video: Visiting YouTube, right-click on a video (or playlist) link and select _Copy link_. Then click on the _Paste above the YouTube link you copied_ button. The _YouTube video link_ appears. If it contains **v=** then you can extract the soundtrack of this single video. If it contains **list=** then you can extract the soundtrack from each video of the playlist. You can also decide to save these soundtracks in a sub-directory whose name you specify. The _Extract soundtrack_ button runs the process:

  * Download the video.
  * Extract soundtrack and picture. Use them to create the file in _Recording format_ selected above.
  * Remove video.
  * (Repeat for each video in the playlist.)
  * Send notification allowing you to open the directory containing these files.

[All Tabs](#Settings)

<a name="SchedulingTab"></a>
### Scheduling

This tab is directly accessible via the _Schedule a background recording..._ option in the contextual menu.

![Scheduling Settings1 Screenshot][sshot_sched1_settings]{ width=700px }

Select the radio, date, time and duration of the recording you want to schedule, then click on the button.

Your Cinnamon session does not need to be open for recording to occur; but your computer must be turned on, of course.

You will be notified of the start and end of each recording.

The list of scheduled recordings appears in the bellowing list. You can cancel any of them checking their _Remove?_ box and clicking the _Remove selected items_ button.

![Scheduling Settings2 Screenshot][sshot_sched2_settings]{ width=700px }

[All Tabs](#Settings)

<a name="PulseEffects"></a>
## Optional: Install PulseEffects
*PulseEffects* is an advanced system-wide equalizer that works with
*PulseAudio*. It can apply system-wide effects to all running application
or selected apps.

`apt install libpulse-mainloop-glib0 libpulse0 libpulsedsp pulseaudio-equalizer pulseaudio-module-bluetooth pulseaudio-utils pulseaudio pavumeter pavucontrol paprefs gstreamer1.0-adapter-pulseeffects gstreamer1.0-autogain-pulseeffects gstreamer1.0-crystalizer-pulseeffects gstreamer1.0-convolver-pulseeffects pulseeffects`

Once installed, PulseEffects is accessible from the contextual menu of the Radio3.0 applet.

[Return to Table Of Contents](#TOC)

***

<a name="Annex"></a>
## Annex

<a name="Annex1"></a>
### Annex 1: Description of importable file formats

#### Contents of a `.csv` file (example):

`INC;NAME;URL`  
`true;Radio BluesFlac;https://streams.radiomast.io/radioblues-flac`  
`true;Digital Impulse - Blues;http://5.39.71.159:8990/stream`  

Each line must contain exactly two semicolons, which divides it into three fields.

The first line describes the fields that are in the following ones.  
The INC field contains a boolean. Its value (*true* or *false*) does not matter for the import, but it must be present.  
The NAME field contains the name of the radio station. It must not contain a semicolon.  
The URL field contains the URL of this station's stream.

#### Contents of a `.m3u` file (example):

`#EXTM3U`  
`#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)`  
`http://185.33.21.111:80/baroque_64`  
`#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)`  
`http://185.33.21.111:80/baroque_mobile_aac`  
`#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)`  
`http://185.33.21.111:80/baroque_128`  
`...etc...`  

The first line must be `#EXTM3U`.  
Then, each station is described by a pair of lines. A first line starting with "#EXTINF:-1," and ending with the station name. A second line containing the stream URL.

Note: The `-1` after `#EXTINF:` means that the duration of the track is unknown, which is normal for a radio stream.

#### Contents of a `.xpfs` file (example):

    <?xml version="1.0" encoding="utf-8"?><playlist version="1" xmlns="http://xspf.org/ns/0/"><title>1.FM - Otto's Baroque Music (www.1.fm)</title><trackList><track><location>http://185.33.21.111:80/baroque_128</location><title>1.FM - Otto's Baroque Music (www.1.fm)</title></track><track><location>http://185.33.21.111:80/baroque_64</location><title>1.FM - Otto's Baroque Music (www.1.fm)</title></track>...other tracks...</trackList></playlist>

All data are registered on a single line. Here they are presented in a more understandable way:

    <?xml version="1.0" encoding="utf-8"?>
    <playlist version="1" xmlns="http://xspf.org/ns/0/">
        <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
        <trackList>
            
            <track>
                <location>http://185.33.21.111:80/baroque_128</location>
                <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
            </track>
            
            <track>
                <location>http://185.33.21.111:80/baroque_64</location>
                <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
            </track>
            
            ...other tracks...
        </trackList>
    </playlist>

The first line describes the version of XML and the character encoding used. All files in XPFS format start with this.

The playlist is described between the `<playlist>` and `</playlist>` markups.

The first *title* (between `<title>` and `</title>`) is that of the playlist. (In this case, it is the name of the radio.)

The track list is located between the `<tracklist>` and `</tracklist>` markups.

Each *track* contains, in this order, a *location* - i.e. the URL of the stream - and a *title*, which could have been more explicit here by indicating the stream's bitrate and format.

#### Contents of a `.pls` file (example):
    [playlist]
    numberofentries=8
    File1=http://185.33.21.111:80/baroque_mobile_aac
    Title1=1.FM - Otto's Baroque Music (www.1.fm)
    Length1=-1
    File2=http://185.33.21.111:80/baroque_64
    Title2=1.FM - Otto's Baroque Music (www.1.fm)
    Length2=-1
    ...6 other entries...

A `.pls` file starts with a line containing only `[playlist]`.  
The second line indicates that this file contains 8 entries numbered from 1 to 8.

Each entry is described by a set of 3 successive lines. The role of each of them is easily understandable.

[Return to the "File to import" section](#FileToImport)

[^](#)


[screenshot]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/screenshot.png
[sshot_settings_tabs]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_Settings_All_Tabs.png
[sshot_radios_tab1]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_1.png
[sshot_radios_tab2]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_2.png
[sshot_radios_tab3]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_3.png
[sshot_radios_tab4]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RadiosTab_4.png
[plus_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_list_add_button.png
[minus_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_list_remove_button.png
[pencil_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_list_edit_button.png
[unchecked_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_checkbox_symbolic_button.png
[moveup_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_up_button.png
[movedown_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_down_button.png
[top_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_top_button.png
[bottom_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_bottom_button.png
[prevcat_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_previous_button.png
[nextcat_button]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/R3_go_next_button.png
[sshot_menu_myradiostations]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_Menu_MyRadioStations.png  "My Radio Stations"

[sshot_search_tab1]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_SearchTab_1.png
[sshot_search_tab2]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_SearchTab_2.png

[sshot_import_tab1]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_ImportTab_1.png
[sshot_import_tab2]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_ImportTab_2.png

[sshot_menu_tab]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_MenuTab.png

[sshot_behavior1_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior1-StartUp.png

[sshot_behavior2_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior2-VolumeStep.png

[sshot_behavior3_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior3-ShowHelp.png

[sshot_behavior4_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior4-Notifications.png

[sshot_behavior5_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior5-CodecAndBitrate.png

[sshot_behavior6_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_Behavior6-SymbolicIconColor.png

[sshot_recording_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_RecordingSettings.png
[sshot_network_settings]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Radio30_NetworkSettings.png

[sshot_yt_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_YT_Tab.png

[sshot_sched1_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_SchedulingTab_1.png

[sshot_sched2_settings]: https://raw.githubusercontent.com/claudiux/docs/master/Radio3.0/screenshots/Radio30_SchedulingTab_2.png

[shoutcast]: https://directory.shoutcast.com/
[shoutcast_baroque]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Shcst1.png
[shoutcast_save]: https://github.com/claudiux/docs/raw/master/Radio3.0/screenshots/Shcst2.png
