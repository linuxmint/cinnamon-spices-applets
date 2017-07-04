<h2 style="color:red;">Bug reports, feature requests and contributions</h2>
<p style="color:red;">
Bug reports, feature requests and contributions should be done on this xlet's repository linked next.
</p>

<table><tbody>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/issues.svg"></td>
<td><a href="https://github.com/Odyseus/CinnamonTools"><strong style="font-size: 1.2em">
Bug reports/Feature requests/Contributions
</strong></a></td></tr>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/help.svg"></td>
<td><a href="https://odyseus.github.io/CinnamonTools/help_files/0dyseus@SysmonitorByOrcus.html"><strong style="font-size: 1.2em">
Localized help
</strong></a></td></tr>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/contributors.svg"></td>
<td><a href="https://odyseus.github.io/CinnamonTools/help_files/0dyseus@SysmonitorByOrcus.html#xlet-contributors"><strong style="font-size: 1.2em">
Contributors/Mentions
</strong></a></td></tr>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/changelog.svg"></td>
<td><a href="https://odyseus.github.io/CinnamonTools/help_files/0dyseus@SysmonitorByOrcus.html#xlet-changelog"><strong style="font-size: 1.2em">
Full change log
</strong></a></td></tr>

</tbody></table>

## Compatibility

![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-2.8.svg)
![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.0.svg)
![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.2.svg)
![Cinnamon 3.4](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.4.svg)

<span style="color:red;"><strong>Do not install on any other version of Cinnamon.</strong></span>

## Description

This applet is a fork of [System Monitor](https://cinnamon-spices.linuxmint.com/applets/view/88) applet by Josef Michálek (a.k.a. Orcus).

## Differences with the original applet

**This applet is not compatible with vertical panels!**

- This applet uses Cinnamon's native settings system instead of an external library (gjs).
- I added an option to use a custom command on applet click.
- I added an option to set a custom width for each graph individually.
- I added an option to align this applet tooltip text to the left.
- Removed NetworkManager dependency.

## Dependencies
- **GTop:** The gtop library reads information about processes and the state of the system.
    - **Debian based distributions:** The package is called **gir1.2-gtop-2.0**.
    - **Archlinux based distributions:** The package is called **libgtop**.
    - **Fedora based distributions:** The package is called **libgtop2-devel**.
- **NetworkManager:** NetworkManager is a system network service that manages your network devices and connections, attempting to keep active network connectivity when available.
    - **Debian based distributions:** The package is called **gir1.2-networkmanager-1.0**.
    - **Archlinux based distributions:** The package is called **networkmanager**.
    - **Fedora based distributions:** The package is called **NetworkManager**.

**Important note:** NetworkManager is only used if the **GTop** library version installed on a system is < **2.32** and doesn't support certain library calls. So, basically, if the network graph on this applet works without having installed NetworkManager, then you don't need to install it.

**Restart Cinnamon after installing the packages for the applet to recognize them.**
