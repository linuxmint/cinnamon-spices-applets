<h2 style="color:red;">Bug reports, feature requests and contributions</h2>
<span style="color:red;">
If anyone has bugs to report, a feature request or a contribution, do so on <a href="https://github.com/Odyseus/CinnamonTools">this xlet GitHub page</a>.
</span>

## Argos for Cinnamon applet description

Argos for Cinnamon lets you write Cinnamon applets in a language that every Linux user is already intimately familiar with: Bash scripts. Not only that, if you are familiar or more comfortable with any other language (like Python, Ruby, JavaScript or even Perl or PHP), Argos for Cinnamon can handle them as well.

More precisely, Argos for Cinnamon is an applet that turns executables' standard output into panel dropdown menus. It is inspired by, and fully compatible with, the Gnome Shell extension called [Argos](https://github.com/p-e-w/argos) by [Philipp Emanuel Weidmann](https://github.com/p-e-w), which in turn is inspired by, and fully compatible with, the [BitBar](https://github.com/matryer/bitbar) application for macOS. Argos for Cinnamon supports many [BitBar plugins](https://github.com/matryer/bitbar-plugins) without modifications, giving you access to a large library of well-tested scripts in addition to being able to write your own.

## Compatibility

![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-2.8.svg)
![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.0.svg)
![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.2.svg)
![Cinnamon 3.4](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.4.svg)

## Key features

- **100% API [compatible with BitBar 1.9.2](#argos-bitbar-compatibility):** All BitBar plugins that run on Linux (i.e. do not contain macOS-specific code) will work with Argos (else it's a bug).
- **Beyond BitBar:** Argos can do everything that BitBar can do, but also some things that BitBar can't do (yet). See the documentation for details.
- **Sophisticated asynchronous execution engine:** No matter how long your scripts take to run, Argos will schedule them intelligently and prevent blocking.
- **Unicode support:** Just print your text to stdout. It will be rendered the way you expect.
- **Optimized for minimum resource consumption:** Even with multiple plugins refreshing every second, Argos typically uses less than 1% of the CPU.
- **Fully documented**.

## Known issues

No known issues for the moment.

## Contributors/Mentions
- **[Philipp Emanuel Weidmann](https://github.com/p-e-w):**: Author of the gnome-shell extension called [Argos](https://github.com/p-e-w/argos).
- **[giwhub](https://github.com/giwhub):** Chinese localization.

[Full change log](https://github.com/Odyseus/CinnamonTools/blob/master/applets/0dyseus%40ArgosForCinnamon/CHANGE_LOG.md)
