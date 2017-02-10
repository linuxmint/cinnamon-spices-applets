Desktop Capture<a name="top">&nbsp;</a>
===============
A comprehensive screenshot and screencasting applet for Cinnamon.

![Applet configured for Cinnamon Screenshot and Recorder](https://raw.github.com/rjanja/desktop-capture/master/img/cinnamon-screenshot.png "Applet configured for Cinnamon Screenshot and FFmpeg Recorder")


### Intro<a name="intro">&nbsp;</a>
This project started because I wanted a simple way to choose and switch between capture software packages. There are many options out there and I wanted something to tie them into Cinnamon.

My favorite capture software has always been Shutter, but when I found it wouldn't behave with Cinnamon I decided to write an Cinnamon-specific screenshot utility and integrate it into Desktop Capture. So while <i>Cinnamon Screenshot</i> comes with this applet, you are free to use any capture software you like. Shutter will continue to be supported because it is still a great tool despite being abandonware.

### Features<a name="features">&nbsp;</a>
* Built-in capture tool: Full screen, Window, Area, Cinnamon UI, Screen, Monitor (and multi-monitor)
* Built-in uploading to Imgur.com
* Copy path/URL/image data to clipboard
* Compatible with screenshot utilities including GNOME-Screenshot, Shutter, xwd, Imagemagick, and Kazam
* Compatible with recorders including RecordMyDesktop, Byzanz, and FFmpeg
* Extensive options and further customisations are possible via JSON support file. 
* Options for changing most configuration settings; further customisations are possible via JSON support file.

![Notification](https://raw.github.com/rjanja/desktop-capture/master/img/notification.png "Notifications")

### Requirements

This applet is multi-version, meaning different versions of Cinnamon will have different experiences and functionality.

Beginning with Cinnamon **2.6** anonymous imgur uploads are supported (once more).

Beginning with Cinnamon **3.2** authenticated imgur uploads are supported, and there is an included wizard to help you connect to your account.

![Imgur](https://raw.github.com/rjanja/desktop-capture/master/img/imgur-album.png "Choosing the album to upload into, once connected to your imgur account")


### Installation<a name="installing">&nbsp;</a>
* Make sure you have Cinnamon 2.6 or newer
* Check out source with git, move `capture@rjanja` folder into `~/.local/share/cinnamon/applets/`, restart Cinnamon and add applet normally

### Selection modes - advanced usage<a name="usage">&nbsp;</a>
* ##### Area
    * Use directional keys (up, left, down, right) to move selection
    * Hold shift while using directional keys to resize selection
    * Press ENTER to complete capture

* ##### Cinnamon UI
    * Move your mouse cursor over an actor
    * Use mousewheel scroll up/down to traverse hierarchy through reactive actors
    * Hold shift while clicking to activate an actor
    * Click (without holding shift) to complete capture

### Adding program support<a name="extending">&nbsp;</a>
A number of program-specific options can be set for your preferred capture program by manually editing the `support.json` file. New programs can be added by creating a new block, just remember not to use trailing commas on the last elements and do not try to add comments as they seem to break the parser.

![Extending](https://raw.github.com/rjanja/desktop-capture/master/img/custom-entries.png "Extending program support")

For camera/screenshot programs, a standard set of "supported" features can be enabled. If they are missing, or set to false, they will be considered to be disabled/not present. Custom options can be supplied which will appear after the standard supported options, with the key being the text that shall be shown and the value being the full command to run, including the executable name.

For recorder/screencast programs, there is no similar list of "supported" features; only "custom" entries are used here.

### Thanks
* The Linux Mint development team and contributors for all of their efforts!
* infektedpc, who developed the very first screenshot applet for Cinnamon!
* Ben Scholzen, author of Shell's Area Screenshot extension, from which area selection and timer have been integrated and improved upon
* The author(s) of Shell's capture backend, from which Cinnamon has benefited
