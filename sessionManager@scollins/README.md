Session Manager
---------------

Session Manager is an applet that provides easy access to session controls such as shut down, restart, log off, switch user, etc. It has been tested in Arch, Fedora and Linux Mint, and supports a wide variety of software configurations. If your particular configuration is not supported, please submit a feature request on github, and I will add it at my earliest convenience.

#### Features
* Option to set both the panel text and icon (supports both full-color and symbolic icons)
* Ability to change the icon size in the menu
* Supports multiple display managers (login screen):
    * MDM
    * GDM
    * LightDM
    * LXDM
* Supports multiple session tools:
    * Consolekit
    * Upower
    * Systemd

#### Known issues
* Currently uses some synchronous calls. In practice this doesn't cause any issues, but it does cause this applet to be flagged in applet settings as 'dangerous'.
