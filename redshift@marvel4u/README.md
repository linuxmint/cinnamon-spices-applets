# Redshift applet

A powerful applet that allows quick activation and configuration of the red filter and brightness provided by redshift. It supports manual change of the temperature and brightness which is not possible in the redshift-gtk and enable/disable transition between day and night.


## Installing

1) Install redshift:
- Debian/Ubuntu/Linux Mint and other Debian based distributions: sudo apt-get install redshift.
- Red Hat/Cent OS/Fedora: sudo dnf install redshift.

2) Extract to ~/.local/share/cinnamon/applets.

3) Enable the applet in cinnamon settings.


## Changelog

* 2.1.0
  - Tooltip improvements with more information about the state of Redshift.
  - Translation fixes.
  
* 2.0.0
  - Options for transition between day and night (oneshot option still available).
  - Applet configuration menu.
  - Preferences are saved between computer shutdowns using the applet configuration (enabled on startup, temperature and brigthness remembered).
  - Added Spanish localization.
  - Icon improved: black lightbulb for Redshift disabled, red lightbulb for oneshot mode and red sunset for transition between day and night.

* 1.0.0
  - stable release.

> Forked from bightness@markbokil.com: https://cinnamon-spices.linuxmint.com/applets/view/64

Thanks to [@Martin1887](https://github.com/Martin1887 "@Martin1887 on Github") for his work on versions 2.0.0 and 2.1.0.
