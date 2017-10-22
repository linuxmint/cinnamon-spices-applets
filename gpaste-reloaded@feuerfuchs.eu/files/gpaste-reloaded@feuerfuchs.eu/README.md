GPaste is a clipboard management tool. This applet lets you access your clipboard through an icon in the panel.

This is a completely re-written GPaste applet based on the [gnome shell extension](https://github.com/Keruspe/GPaste/tree/master/src/gnome-shell). It offers the following features:
* Search for entries
* Access the native GPaste GUI
* Support for multiple histories
* Manually add entries to the history
* Unlimited instances


# Installation

For this applet to work, it is necessary that GPaste is installed!

* If you use an Arch-based distro, that means you have to install the package "gpaste".
* If you use a Ubuntu-based distro, install the packages "gpaste", "gpaste-applet" and "gir1.2-gpaste-4.0".
* Other distros: Check if there's a package for GPaste. If there isn't, check the GitHub page linked below.

Finally, make sure that the GPaste daemon is running. You can either use the GPaste UI or just reboot.

GPaste Github page: https://github.com/Keruspe/GPaste

To install the applet itself, execute the `install.sh` script. If the applet doesn't appear in the applet list, you should restart Cinnamon by pressing Alt+F2, typing 'r' (without ') and hitting enter.
To remove the applet, just run `install.sh -r`.
