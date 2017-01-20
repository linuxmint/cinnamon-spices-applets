## System Monitor fork applet description

This applet is a fork of [System Monitor](https://cinnamon-spices.linuxmint.com/applets/view/88) applet by Josef Michálek (a.k.a. Orcus).

## Differences with the original applet
- This applet uses Cinnamon's native settings system instead of an external library (gjs).
- I added an option to use a custom command on applet click.
- I added an option to set a custom width for each graph individually.
- I added an option to align this applet tooltip text to the left.
- Removed NetworkManager dependency (only for distros that don't support certain **gtop** library calls).

## Compatibility

- ![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-2.8.svg) ![Linux Mint 17.3](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-17.3.svg)
- ![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-3.0.svg) ![Linux Mint 18](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-18.svg)
- ![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Cinnamon-3.2.svg) ![Linux Mint 18.1](https://odyseus.github.io/CinnamonTools/lib/MyBadges/Linux_Mint-18.1.svg)

## Dependencies

- **gir1.2-gtop-2.0**: The gtop library reads information about processes and the state of the
system.

## Contributors

- [buzz](https://github.com/buzz): Bug fixes.

<div style="color:red;" markdown="1">
## Bug report and feature request

Spices comments system is absolutely useless to report bugs with any king of legibility. In addition, there is no notifications system for new comments. So, if anyone has bugs to report or a feature request, do so on this xlet GitHub page. Just click the **Website** button next to the **Download** button.
</div>

## Change Log

##### 1.8
- Re-added compatibility for Cinnamon 2.8.8 (Linux Mint 17.3). Compatibility for this version of Cinnamon was accidentally lost when the dependency on NetworkManager was removed.

##### 1.7
- Removed dependency on NetworkManager. Thanks to [buzz](https://github.com/buzz).

##### 1.6
- Added support for localizations. If someone wants to contribute with translations, inside the Help section of this applet (found in the applet context menu or the Help.md file inside this applet folder) you will find some pointers on how to do it.

##### 1.5
- Re-writed to use Cinnamon's native settings system instead of an external library. This allowed me to remove **gjs** as a dependency for this applet.
- Added an option to use a custom command on applet click.
- Added an option to set a custom width for each graph individually.
- Added an option to align this applet tooltip text to the left. ¬¬


##### 1.4
- Initial release of the fork.

