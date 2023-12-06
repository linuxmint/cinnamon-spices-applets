# Radio++

A simple radio applet for Cinnamon. The radio-applet has been totally rewritten for Cinnamon 4.6. All information below refers to this version. The old readme can be found [here](https://github.com/linuxmint/cinnamon-spices-applets/tree/092e3f889e27dc98ee3734651bd777efb286c95d/radio@driglu4it)

## Features

- Radio Station search
- The radio applet can be controlled (paused, sound increased/decreased) by programs with MPRIS control (e.g. the sound applet, kdeconnect or playerctl). Such programs also receive the title of the current playing song (e.g you can show the current playing song in the sound applet by activating the option "Show song information on the panel" in the sound applet).
- All other running programs with sound output which have implemented the MPRIS interface (e.g. most Browsers, Spotify, ...) are automatically paused when starting a radio channel
- A download dialog is opened when clicking on the applet for downloading the missing required dependencies (all except youtube-dl. See **Dependencies** section)
- The current playing song title can be copied to the clipboard or even downloaded from Youtube
- The volume can be controlled by using the mouse wheel while the cursor is placed on the icon in the panel. Also it is possible to toggle the play/pause status by middleclicking on the icon
- The title of the radio channel can be shown in the panel
- The icon color changes when a radio channel is playing
- Seek backward/forward

## Dependencies

The [mpv media player](https://mpv.io) is used for playing the radio channel. As the mpv media player doesn't support MPRIS control out of the box, [this plugin](https://github.com/hoyon/mpv-mpris) is used to get this feature. For the mpv player and the plugin, a download dialogue is opened when clicking on the applet. 

**TLDR** Run this [gist](https://gist.github.com/jonath92/0f6bf4606bc8a34be1bb0826c99b73d1) as sudo to install `youtube-dl`

For the youtube download feature you can either use [youtube-dl](https://github.com/ytdl-org/youtube-dl) or [yt-dlp](https://github.com/yt-dlp/yt-dlp). By default youtube-dl is selected. As google frequently makes technical changes to Youtube, it is highly recommended to always have the newest version of the download cli tool installed as otherwise the feature will most likely stop working after a short time. Unfortunately, the newest version in the official linux mint apt repository is usually not even close to sufficiently up to date. Therefore I highly recommend installing the software by following the official installstion instruction which can be found on the respective github page and adding a script in `/etc/cron.daily` to automate the update. I have created a gist for both [youtube-dl](https://gist.github.com/jonath92/0f6bf4606bc8a34be1bb0826c99b73d1) and [yt-dlp](https://gist.github.com/jonath92/039e998b3d3f6ba4afd5d5c671eaedf1) for this purpose.

## Known Issues

- Special characters (e.g German Umlaute) are not shown correctly on the sound applet (when the option "Show song information on the panel" is activated). This is a [bug](https://github.com/mpv-player/mpv/issues/8844) of the mpv player. There is an open [pull request](https://github.com/mpv-player/mpv/pull/8845) which will fix that. At the moment the only workaround is to compile mpv from the source of the mentioned pull request. 
- For some radio stations (e.g. BBC) the metadata can't be shown
- It is automatically downloaded the compiled version of the mpv mpris plugin which however is only suitable for 64-bit x86 architecutres (e.g. not for the raspberry pi). In that case you unfortunately have to [build the plugin](https://github.com/hoyon/mpv-mpris#build) by yourself at the moment and place the plugin at: `~/.cinnamon/configs/radio@driglu4it/.mpris.so`. 

## New Maintainer Needed
I (https://github.com/jonath92) have been expanding and maintaining the Radio Applet for a while now, but for personal reasons I unfortunately have very little time for this project. Therefore I am looking for a new mainainter. I am still more than willing to help a new maintainer with technical questions about the code. If you need help regarding the code, just open an issue in the applet repo and notify me in the issue. 