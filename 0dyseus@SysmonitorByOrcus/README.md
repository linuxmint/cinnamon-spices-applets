<h2 style="color:red;">Bug reports, feature requests and contributions</h2>
<span style="color:red;">
If anyone has bugs to report, a feature request or a contribution, do so on <a href="https://github.com/Odyseus/CinnamonTools">this xlet GitHub page</a>.
</span>

## System Monitor (Fork By Odyseus) applet description

This applet is a fork of [System Monitor](https://cinnamon-spices.linuxmint.com/applets/view/88) applet by Josef Michálek (a.k.a. Orcus).

## Compatibility

![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-2.8.svg)
![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.0.svg)
![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.2.svg)
![Cinnamon 3.4](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.4.svg)

## Differences with the original applet
**This applet is not compatible with vertical panels!**

- This applet uses Cinnamon's native settings system instead of an external library (gjs).
- I added an option to use a custom command on applet click.
- I added an option to set a custom width for each graph individually.
- I added an option to align this applet tooltip text to the left.
- Removed NetworkManager dependency.

## Dependencies

- **gir1.2-gtop-2.0**: The gtop library reads information about processes and the state of the
system.
- **NetworkManager**: NetworkManager is a system network service that manages your network devices and connections, attempting to keep active network connectivity when available.
    - **Note:** NetworkManager is only used if the **GTop** library version installed on a system is < **2.32** and doesn't support certain library calls.

**Important note:** NetworkManager is only used if the **GTop** library version installed on a system is < **2.32** and doesn't support certain library calls. So, basically, if the network graph on this applet works without having installed NetworkManager, then you don't need to install it.

#### [Localized help](https://odyseus.github.io/CinnamonTools/help_files/0dyseus@SysmonitorByOrcus.html)
#### [Contributors/Mentions](https://odyseus.github.io/CinnamonTools/help_files/0dyseus@SysmonitorByOrcus.html#xlet-contributors)
#### [Full change log](https://odyseus.github.io/CinnamonTools/help_files/0dyseus@SysmonitorByOrcus.html#xlet-changelog)
