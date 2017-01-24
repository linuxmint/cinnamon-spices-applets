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

[Full change log](https://github.com/Odyseus/CinnamonTools/blob/master/Applets/0dyseus%40SysmonitorByOrcus/files/0dyseus%40SysmonitorByOrcus/CHANGELOG.md)
