## Applet status

- Applet ready to be published. Estimated date of publishing: **May 29, 2017**.
- Applet ready to be translated.

## Description

Argos for Cinnamon lets you write Cinnamon applets in a language that every Linux user is already intimately familiar with: Bash scripts. Not only that, if you are familiar or more comfortable with any other language (like Python, Ruby, JavaScript or even Perl or PHP), Argos for Cinnamon can handle them as well.

More precisely, Argos for Cinnamon is an applet that turns executables' standard output into panel dropdown menus. It is inspired by, and fully compatible with, the Gnome Shell extension called [Argos](https://github.com/p-e-w/argos) by [Philipp Emanuel Weidmann](https://github.com/p-e-w), which in turn is inspired by, and fully compatible with, the [BitBar](https://github.com/matryer/bitbar) application for macOS. Argos for Cinnamon supports many [BitBar plugins](https://github.com/matryer/bitbar-plugins) without modifications, giving you access to a large library of well-tested scripts in addition to being able to write your own.

## Tested environments

* [x] ![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-2.8.svg)
* [x] ![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.0.svg)
* [x] ![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.2.svg)
* [x] ![Cinnamon 3.4](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.4.svg)

## Key features

- **100% API compatible with BitBar 1.9.2:** All BitBar plugins that run on Linux (i.e. do not contain macOS-specific code) will work with Argos (else it's a bug).
- **Beyond BitBar:** Argos can do everything that BitBar can do, but also some things that BitBar can't do (yet). See the documentation for details (Applet context menu **Extras** > **Help**).
- **Sophisticated asynchronous execution engine:** No matter how long your scripts take to run, Argos will schedule them intelligently and prevent blocking.
- **Unicode support:** Just print your text to stdout. It will be rendered the way you expect.
- **Optimized for minimum resource consumption:** Even with multiple plugins refreshing every second, Argos typically uses less than 1% of the CPU.
- **Fully documented**.

## Usage

After placing a new instance of **Argos for Cinnamon** into a panel, one of the example scripts provided by this applet will be automatically attached to it and a menu will be created based on the output of the executed plugin. These example scripts contain various examples of what **Argos for Cinnamon** can do.

**Read the help file for this applet before trying any script with it. And pay attention to all warnings.**

## ToDo

* [x] Test applet on all the other Cinnamon versions. ![Priority HIGH](https://img.shields.io/badge/Priority-HIGH-orange.svg?style=plastic)
* [x] Add a tooltip to the applet. I'm thinking on adding some basic information to it like the rotation and execution intervals, name of the script file and some other information that can be seen at a glance of the tooltip without opening the context menu or the applet settings window. ![Priority HIGH](https://img.shields.io/badge/Priority-HIGH-orange.svg?style=plastic)

#### Postponed

- I'm thinking about adding the possibility to create more types of elements and not be limited to just menu items. More precisely, I'm thinking about adding buttons. Buttons can occupy more vertical space than menu items, but one could fit 5 or 6 buttons in the same horizontal space that 2 menu items would occupy. But I will start to work on this after this applet reaches an stable state. ![Priority LOW](https://img.shields.io/badge/Priority-LOW-blue.svg?style=plastic)

<!--
Badges
![Priority CRITICAL](https://img.shields.io/badge/Priority-CRITICAL-red.svg?style=plastic)
![Priority HIGH](https://img.shields.io/badge/Priority-HIGH-orange.svg?style=plastic)
![Priority LOW](https://img.shields.io/badge/Priority-LOW-blue.svg?style=plastic)
-->

## Known issues

No known issues for the moment.

## Issue reports

**Issue reporters should adjunct the output of the following commands.**
**Check the content of the log files for sensible information BEFORE running the commands!!!**

`inxi -xxxSc0 -! 31`
`pastebin ~/.cinnamon/glass.log`
`pastebin ~/.xsession-errors`

## [Download Argos for Cinnamon applet](https://odyseus.github.io/CinnamonTools/pkg/0dyseus@ArgosForCinnamon.tar.gz)

## References to anyone that could be interested in testing the applet

@buzz @copecu @fortalezense @maladro1t @NikoKrause @Radek71 @sphh @DamienNZ @muzena @eson57 @giwhub
