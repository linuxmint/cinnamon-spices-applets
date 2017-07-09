<h2 style="color:red;">Bug reports, feature requests and contributions</h2>
<p style="color:red;">
Bug reports, feature requests and contributions should be done on this xlet's repository linked next.
</p>

<table><tbody>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/issues.svg"></td>
<td><a href="https://github.com/Odyseus/CinnamonTools"><strong>
Bug reports/Feature requests/Contributions
</strong></a></td></tr>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/help.svg"></td>
<td><a href="https://odyseus.github.io/CinnamonTools/help_files/0dyseus@ArgosForCinnamon.html"><strong>
Localized help
</strong></a></td></tr>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/contributors.svg"></td>
<td><a href="https://odyseus.github.io/CinnamonTools/help_files/0dyseus@ArgosForCinnamon.html#xlet-contributors"><strong>
Contributors/Mentions
</strong></a></td></tr>
<tr><td><img src="https://odyseus.github.io/CinnamonTools/lib/img/changelog.svg"></td>
<td><a href="https://odyseus.github.io/CinnamonTools/help_files/0dyseus@ArgosForCinnamon.html#xlet-changelog"><strong>
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

Argos for Cinnamon is an applet that turns executables' standard output into panel dropdown menus. It is inspired by, and fully compatible with, the Gnome Shell extension called [Argos](https://github.com/p-e-w/argos) by [Philipp Emanuel Weidmann](https://github.com/p-e-w), which in turn is inspired by, and fully compatible with, the [BitBar](https://github.com/matryer/bitbar) application for macOS. Argos for Cinnamon supports many [BitBar plugins](https://github.com/matryer/bitbar-plugins) without modifications, giving you access to a large library of well-tested scripts in addition to being able to write your own.

## Key features

- **100% API compatible with BitBar 1.9.2:** All BitBar plugins that run on Linux (i.e. do not contain macOS-specific code) will work with Argos (else it's a bug).
- **Beyond BitBar:** Argos can do everything that BitBar can do, but also some things that BitBar can't do (yet). See the documentation for details.
- **Sophisticated asynchronous execution engine:** No matter how long your scripts take to run, Argos will schedule them intelligently and prevent blocking.
- **Unicode support:** Just print your text to stdout. It will be rendered the way you expect.
- **Optimized for minimum resource consumption:** Even with multiple plugins refreshing every second, Argos typically uses less than 1 percent of the CPU.
- **Fully documented:**

## Dependencies

- **xdg-open command:** Open a URI in the user's preferred application that handles the respective URI or file type.
    - Debian and Archlinux based distributions: This command is installed with the package called **xdg-utils**. Installed by default in modern versions of Linux Mint.
