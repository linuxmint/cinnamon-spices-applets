# Desktop Icon Size

Cinnamon applet to change size and position of desktop icons

![Main interface](https://raw.githubusercontent.com/wiki/lotsrc/DesktopIconSize/screenshot_full.png)

![Organizing the desktop](https://raw.githubusercontent.com/wiki/lotsrc/DesktopIconSize/demo.gif)

Spices entry [https://cinnamon-spices.linuxmint.com/applets/view/268](https://cinnamon-spices.linuxmint.com/applets/view/268)

## Features

* Precise icon size selection
* Custom desktop grid
* 5 different layouts
* Icon ordering
* Bar sub layout
* Multiple profiles

## Requeriments

* Cinnamon desktop environment 2.2+
* Nemo file browser managing the desktop (default in Linux Mint Cinnamon)
* Python 3.4+

## Installing

* Download the [latest release](https://github.com/lotsrc/DesktopIconSize/releases/latest)
* Open the file and copy the `desktopiconsize@lotsrc` directory to `~/.local/share/cinnamon/applets/`
* Add the applet to a panel by right clicking a panel and selecting *Add applets to the panel*. Choose Desktop Icon Size

## Notes

It is recommended setting the desktop context menu option *Keep Aligned* disabled. 

The icon data is updated by renaming the desktop files to a different name and then back to the original one, so it is the safest not to use the program when reading or writing to the desktop (Downloading a file or watching a video saved in the desktop).

## License

GNU General Public License version 2 or later. See [LICENSE](LICENSE)
