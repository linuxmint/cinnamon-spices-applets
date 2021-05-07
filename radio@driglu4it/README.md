# Radio++
A simple radio applet for Cinnamon. The radio-applet has been totally rewritten for Cinnamon 4.6. All information below are refering to this version. The old readme can be found [here](https://github.com/linuxmint/cinnamon-spices-applets/tree/092e3f889e27dc98ee3734651bd777efb286c95d/radio@driglu4it)

## Features
- Radio Station search 
- The radio applet can be controlled (paused, sound increased/decreased) with programms with MPRIS control (e.g.the sound applet, kdeconnect or playerctl). Such programs also receive the title of the current playing song (e.g you can show the current playing song in the sound applet by activating the option "Show song information on the panel" in the sound applet). 
- All other running programs with sound output which have implemented the MPRIS interface (e.g. most Browsers, Spotify, ...) are automatically paused when starting a radio channel 
- A download dialog is opened when clicking on the applet for downloading the missing required dependencies (all except youtube-dl. See **Dependencies** section)
- The current playing song title can be copied to the clipboard or even downloaded from Youtube 
- The volume can be controlled by using the mouse wheel while the cursor is placed on the icon in the panel. Also it is possible to toggle the play/pause status by middleclick on the icon 
- The title of the radio channel can be shown in the panel
- The icon color changes when a radio channel ist playing

## Dependencies
It is used the [mpv media player](https://mpv.io) for playing the radio channel. As the mpv media player doesn't support MPRIS control out of the box, it is used [this plugin](https://github.com/hoyon/mpv-mpris) to get this feature. For the mpv player and the plugin, it is opened a download dialogue when clicking on the applet.

**TLDR** Run this [gist](https://gist.github.com/jonath92/0f6bf4606bc8a34be1bb0826c99b73d1) as sudo to install `youtube-dl`

For the youtube-download feature, it is needed `youtube-dl`. As google frequently makes technically changes on Youtube, it is highly recommended to always have the newest version of youtube-dl installed as otherwilse the feature will most likely stop working after a short time. Unfortunately, the newest version in the official linux mint apt repository is usually not even close sufficiently up to date. Therefore I highly recommend to install `youtube-dl` by following the [official installation instruction](https://github.com/ytdl-org/youtube-dl#installation). However as the `mpv` package already includes an outdated youtube-dl version, it first needs to be removed to prevent conflicts which may occur when diferrent versions of youtube-dl are installed on your system. In order to automatically updating `youtube-dl`, I furthermore recommend to create a script in `/etc/cron.daily` (which needs to be without extension). I have created a [gist](https://gist.github.com/jonath92/0f6bf4606bc8a34be1bb0826c99b73d1) for this purpose. 

### Below Cinnamon 4.6 
[Moc player](http://moc.daper.net) 


## Known Issues

- Special characters (e.g German Umlaute) are not shown correctly on the sound applet (when the option "Show song information on the panel" is activated). This is a limitation of the mpv player. I haven't yet found a workaround for that. Ideas are welcome.
- For some radio stations (e.g. BBC) the metadata can't be shown
