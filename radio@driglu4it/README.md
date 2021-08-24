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

## Dependencies

The [mpv media player](https://mpv.io) is used for playing the radio channel. As the mpv media player doesn't support MPRIS control out of the box, [this plugin](https://github.com/hoyon/mpv-mpris) is used to get this feature. For the mpv player and the plugin, a download dialogue is opened when clicking on the applet.

**TLDR** Run this [gist](https://gist.github.com/jonath92/0f6bf4606bc8a34be1bb0826c99b73d1) as sudo to install `youtube-dl`

`youtube-dl` is needed for the youtube-download feature. As google frequently makes technical changes to Youtube, it is highly recommended to always have the newest version of youtube-dl installed as otherwise the feature will most likely stop working after a short time. Unfortunately, the newest version in the official linux mint apt repository is usually not even close to sufficiently up to date. Therefore I highly recommend installing `youtube-dl` by following the [official installation instructions](https://github.com/ytdl-org/youtube-dl#installation). However as the `mpv` package already includes an outdated youtube-dl version, it first needs to be removed to prevent conflicts which may occur when different versions of youtube-dl are installed on your system. In order to automatically update `youtube-dl`, I furthermore recommend creating a script in `/etc/cron.daily` (which needs to be without extension). I have created a [gist](https://gist.github.com/jonath92/0f6bf4606bc8a34be1bb0826c99b73d1) for this purpose.

## Known Issues

- Special characters (e.g German Umlaute) are not shown correctly on the sound applet (when the option "Show song information on the panel" is activated). This is a limitation of the mpv player. I haven't yet found a workaround for that. Ideas are welcome.
- For some radio stations (e.g. BBC) the metadata can't be shown
