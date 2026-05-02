### v3.14.0~20260502
  * Improvements to tooltips:
    * CPUs: option to group them in sets of 4.
    * Do not hide the tooltip too early.
  * Fixes [#8622](https://github.com/linuxmint/cinnamon-spices-applets/issues/8622)
  * Fixes [#8629](https://github.com/linuxmint/cinnamon-spices-applets/issues/8629)

### v3.13.6~20260430
  * You can specify the minimum unit of measurement of your choice for the amount of data transferred: byte, kilobyte, megabyte, etc.
  * Displays the tooltip instantly when the applet is hovered over.
  * Fixes [#8617](https://github.com/linuxmint/cinnamon-spices-applets/issues/8617)
  * Code cleanup.

### v3.13.5~20260426
  * Flow (Network, Disk I/O): Select minimum unit (k, M, G etc.)

### v3.13.4~20260425
  * Adds ability to modify the size of the display font, for each type of graph.
  * Fixes [#8595](https://github.com/linuxmint/cinnamon-spices-applets/issues/8595)

### v3.13.3~20260425
  * Adds ability to select the size of the tooltip font.
  * Fixes [#8593](https://github.com/linuxmint/cinnamon-spices-applets/issues/8593)

### v3.13.2~20260424
  * Battery: uses several methods to obtain its measurements.
  * Fixes [#8588](https://github.com/linuxmint/cinnamon-spices-applets/issues/8588)

### v3.13.1~20260422
  * Memory: Can display only Used and Available memory, for users who are not familiar with concepts such as Cache, Buffers, Shared etc.


### v3.13.0~20260420
  * Customize the labels. Many enhancements. You can use emojis as characters and set the vertical offset (in pixels) for each of them. You can bring them to the background or to the foreground (use colors with transparency from 50% to 67%).

### v3.12.1~20260417
  * Avoid errors drawing curves.

### v3.12.0~20260417
  * Adding leds for Disk and for Network.
  * Better take into account logarithmic scale and automatic scale.

### v3.11.3~20260414
  * Improved accuracy of the battery charge level and lifespan displayed in the tooltip.
  * Fixes [#8542](https://github.com/linuxmint/cinnamon-spices-applets/issues/8542)

### v3.11.2~20260412
  * Bugfix.
  * Fixes [#8527](https://github.com/linuxmint/cinnamon-spices-applets/issues/8527)

### v3.11.1~20260410
  * Set position of display markers (Memory, Disk Usage, Battery).
  * Fixes [#8518](https://github.com/linuxmint/cinnamon-spices-applets/issues/8518)

### v3.11.0~20260409
  * Battery: New module fixing [#8485](https://github.com/linuxmint/cinnamon-spices-applets/issues/8485)
  * Swap: Display “0.00” instead of “NaN” when the swap amount used is zero.
  * Disk I/O: Show Read/Write average speed in panel.
  * Fixes [#8500](https://github.com/linuxmint/cinnamon-spices-applets/issues/8500)
  * Tooltip: Show or hide for each module.

### v3.10.4~20260404
  * Panel display improvements. Better using the `DejaVuSansMono-Bold.ttf` font from the `fonts-dejavu-mono` package.
  * Avoids changing Refresh Rate when updating applet.
  * Fixes [#8495](https://github.com/linuxmint/cinnamon-spices-applets/issues/8495)

### v3.10.3~20260404
  * Memory: The user can choose whether or not to display the memory usage percentage.
  * Fixes [#8493](https://github.com/linuxmint/cinnamon-spices-applets/issues/8493)

### v3.10.2~20260403
  * Disk usage: The user can choose whether or not to display the usage percentage for each disk in the panel.
  * Fixes [#8487](https://github.com/linuxmint/cinnamon-spices-applets/issues/8487)
  * Fixes errors related to tooltip display.
  * Some improvements.

### v3.10.1~20260324
  * The user can choose between the htop method (recommended) and the System Monitor method to calculate memory values.
  * Fixes [#8457](https://github.com/linuxmint/cinnamon-spices-applets/issues/8457)

### v3.10.0~20260323
  * Makes the latest version compatible with Cinnamon 5.6 and later!

### v3.9.1~20260322
  * CPU: adds option Show only the CPU Load Over Time.
  * Also you can set How many bars you want to display.
  * Fixes [#7960](https://github.com/linuxmint/cinnamon-spices-applets/issues/7960)

### v3.9.0~20260321
  * Memory: Now able to use a Bar chart.

### v3.8.4~20260320
  * CPU: adds option Ignore Hyper-Threading. (Only when option "Merge all" is set to true.)
  * Fixes [#7960](https://github.com/linuxmint/cinnamon-spices-applets/issues/7960)

### v3.8.3~20260314
  * Bug fix: The units of measurement for used memory and available memory are now correct.

### v3.8.2~20260314
  * Adds option 'Enable Swap' in the Memory tab. 

### v3.8.1~20260313
  * Choose the order in which the boxes appear.

### v3.8.0~20260312
  * Can show the amounts (in Bytes) of Total, Used and Available memory in the tooltip.
  * Same for Swap.
  * Changes "min" values for all widths.

### v3.7.2~20260309
  * Display improvements.

### v3.7.1~20260309
  * Changing certain messages.

### v3.7.0~20260308
  * New section in **Network**: "Total amount or instant speed".
  * The user can choose to display the *Instant network speed* or the *Total transfer amount* or... none.
  * Values can be displayed permanently or only when hovering over this applet.
  * The user can choose the corner in which to display these values.
  * Fixes [#8350](https://github.com/linuxmint/cinnamon-spices-applets/issues/8350)
  * New option in **CPU**: "Corner in which to display the temperature".

### v3.6.1~20260307
  * New option "Use symbols instead of words" in tooltip for Networks and Disks.
  * Checking this option for Networks: Replaces 'Up' with '▲' and 'Down' with '▼'.
  * Checking this option for Disks: Replaces 'Read' with '▲' and 'Write' with '▼'.

### v3.6.0~20260306
  * Fixes net data errors in tooltip.
  * Fixes [#8362](https://github.com/linuxmint/cinnamon-spices-applets/issues/8362)

### v3.5.2~20260220
  * Adds colors for CPU Temperature warnings.
  * Adds CPU Temperature to the tooltip.
  * Fixes [#8348](https://github.com/linuxmint/cinnamon-spices-applets/issues/8348)
  * Fixes [#8349](https://github.com/linuxmint/cinnamon-spices-applets/issues/8349)

### v3.5.1~20260219
  * Make some messages easier to understand.
  * Button to apply the multiple of the width of each graph.

### v3.5.0~20260219
  * Ability to show the CPU temperature.

### v3.4.2~20260213
  * Ability to choose the radius of curvature in corners.
  * Better detection of network devices.
  * Fixes [#8311](https://github.com/linuxmint/cinnamon-spices-applets/issues/8311)

### v3.4.1~20260208
  * Smoother reading of all system data, even those related to networks.
  * The box width can be adjusted in increments of 1, 2, 4, 8, 16, 32, and 64 pixels in the General tab of this applet's settings.

### v3.4.0~20260203
  * Smoother reading of most system data.
  * Uses readFileAsync module.

### v3.3.0~20260106
  * Better takes into account HiDPI display.
  * Changes graph height in pixels with % of panel height.
  * Lets open the Configure submenu of context menu.
  * Fixes [#8148](https://github.com/linuxmint/cinnamon-spices-applets/issues/8148)

### v3.2.2~20260105
  * Takes into account HiDPI display.

### v3.2.1~20260104
  * "Graph height (pixels)" cannot exceed the height of the panel.
  * Fixes [#8148](https://github.com/linuxmint/cinnamon-spices-applets/issues/8148)

### v3.2.0~20251211
  * Added option "Graph height (pixels)". Many thanks to Alex Rock (@Pierstoval)!
  * Now compatible with Cinnamon 6.6.

### v3.1.7~20251111
  * Loop improvement.

### v3.1.6~20251106
  * Fixes [#7898](https://github.com/linuxmint/cinnamon-spices-applets/issues/7898)
  * Avoids freeze at startup.
  * Improved tooltip.

### v3.1.5~20251029
  * Avoids freeze at startup.
  * Fixes [#7898](https://github.com/linuxmint/cinnamon-spices-applets/issues/7898)

### v3.1.4~20251021
  * Avoids random freezes.
  * Fixes [#7898](https://github.com/linuxmint/cinnamon-spices-applets/issues/7898)

### v3.1.3~20251013
  * Support for encrypted partitions.
  * Fixes [#7880](https://github.com/linuxmint/cinnamon-spices-applets/issues/7880)
  * Special thanks to [chrisstavrou](https://github.com/chrisstavrou).

### v3.1.2~20251005
  * The values are formatted to the local locale, in tooltip.
  * Fixes [#7854](https://github.com/linuxmint/cinnamon-spices-applets/issues/7854)

### v3.1.1~20251005
  * Adds the option "Place % at the very end of the line" in the General tab of this applet tooltip.

### v3.1.0~20251004
  * Improved tooltip.
  * Fixes [#7849](https://github.com/linuxmint/cinnamon-spices-applets/issues/7849)

### v3.0.1~20250922
  * Improved network management regarding status changes and data readings.

### v3.0.0~20250831
  * The different colors for cache and buffer memory in the RAM graph are back!
  * Code cleanup.

### v2.9.1~20250829
  * Code cleanup.

### v2.9.0~20250829
  * Reduces data recovery time by a factor of 50!

### v2.8.4~20250826
  * Improves context menu to access to settings.
  * Middle-click opens settings.

### v2.8.3~20250826
  * Fixes [#7559](https://github.com/linuxmint/cinnamon-spices-applets/issues/7559)


### v2.8.2~20250825
  * Try to fix [#7559](https://github.com/linuxmint/cinnamon-spices-applets/issues/7559)
  * Improves the Disk Usage chart.

### v2.8.1~20250825
  * Disk usage: the user can set a maximum value (in %) for each defined path.
  * When the value reaches this maximum, the alert color is used in the bar chart and this value is highlighted in bold in the tooltip.

### v2.8.0~20250825
  * From now, can display disk usage.
  * Fixes [#7546](https://github.com/linuxmint/cinnamon-spices-applets/issues/7546)

### v2.7.2~20250819
  * Improved loops.
  * Changed to_string method.
  * Code cleanup.

### v2.7.1~20250814
  * Improved Graph Border options.

### v2.7.0~20250814
  * Added Border options.

### v2.6.3~20250813
  * Updated the `get-disk-info.sh` script.

### v2.6.2~20250813
  * New options for Swap in the Memory graph.

### v2.6.1~20250813
  * Improved memory measurement speed.

### v2.6.0~20250813
  * Improved processor measurement speed.

### v2.5.2~20250811
  * Speed improvement.

### v2.5.1~20250810
  * Adds the amounts of Buffer memory, Cache, and Shared memory to the tooltip.
  * Improved tooltip display.

### v2.5.0~20250809
  * Fixes [#7460](https://github.com/linuxmint/cinnamon-spices-applets/issues/7460)
  * Fixes [#7505](https://github.com/linuxmint/cinnamon-spices-applets/issues/7505)
  * Calculates the percentage of memory used, as does `gnome-system-monitor`.
  * No longer includes cache memory or buffer memory in the statistics.
  * Improved calculation of tooltip width based on translations of displayed messages.

### v2.4.0~20250808
  * Improved memory calculation.
  * Fixes [#7460](https://github.com/linuxmint/cinnamon-spices-applets/issues/7460)

### v2.3.5~20250808
  * Speed improvement.

### v2.3.4~20250806
  * Fixes [#7461](https://github.com/linuxmint/cinnamon-spices-applets/issues/7461)
  * From now on, you can choose to set the origin of the pie chart (Mem) at 12 o'clock.

### v2.3.3~20250806
  * Fixes [#7444](https://github.com/linuxmint/cinnamon-spices-applets/issues/7444)
  * From now on, you can choose the Square view for each widget.

### v2.3.2~20250806
  * Fixes [#7443](https://github.com/linuxmint/cinnamon-spices-applets/issues/7443)
  * Fixes [#7445](https://github.com/linuxmint/cinnamon-spices-applets/issues/7445)

### v2.3.1~20250806
  * New script `get-cpu-data3.sh` created by @LeosBitto. Again, this script improves performance. Many thanks to him!
  * Show icon when the 'Without any graphics' option is selected in context menu.

### v2.3.0~20250805
  * New options "Label" in settings: one for each type (CPU, Mem, Net, Disks). This option is only visible when the Labels option is checked in the General tab.
  * New option "Merge all" in CPU, Net, Disks tabs. Once this option is checked, a single device grouping all devices is displayed. The colors used are #0 and #1 (for Net and Disks).
  * The user can choose up to 32 different colors.

### v2.2.2~20250804
  * New script `get-cpu-data3.sh` created by @LeosBitto. This script improves performance. Many thanks to him!
  * This script fixes:
    * [#7453](https://github.com/linuxmint/cinnamon-spices-applets/issues/7453)
    * [#7458](https://github.com/linuxmint/cinnamon-spices-applets/issues/7458)

### v2.2.1~20250727
  * CPU: the measured values are more accurate.

### v2.2.0~20250727
  * Fixes [#7445](https://github.com/linuxmint/cinnamon-spices-applets/issues/7445)
  * The calculation of CPU usage is now correct.

### v2.1.0~20250726
  * Fixes many bugs, at least from Cinnamon 6.4:
    * [#3016](https://github.com/linuxmint/cinnamon-spices-applets/issues/3016)
    * [#7439](https://github.com/linuxmint/cinnamon-spices-applets/issues/7439)
    * [#7440](https://github.com/linuxmint/cinnamon-spices-applets/issues/7440)

  * Added the option in General tab of this applet settings: Limit height to the size of a colored icon.

  * Clicking on the applet opens the system monitor.

  * Better manage processes.

### v2.0.0~20250725

  * Fixes many bugs, at least from Cinnamon 6.4: 
    * [#2960](https://github.com/linuxmint/cinnamon-spices-applets/issues/2960)
    * [#3025](https://github.com/linuxmint/cinnamon-spices-applets/issues/3025)
    * [#3096](https://github.com/linuxmint/cinnamon-spices-applets/issues/3096)
    * [#3419](https://github.com/linuxmint/cinnamon-spices-applets/issues/3419)
    * [#4571](https://github.com/linuxmint/cinnamon-spices-applets/issues/4571)
    * [#5177](https://github.com/linuxmint/cinnamon-spices-applets/issues/5177)
    * [#6660](https://github.com/linuxmint/cinnamon-spices-applets/issues/6660)

  * Modification of the settings interface starting with version 6.4 of Cinnamon. A new “Colors” tab allows users to choose the colors for network and disk devices.

  * After changing certain settings, the user must refresh the graphs and tooltips using the “Refresh All” option in the context menu (right-click on the applet). Improvements are coming soon.

  * The `gir1.2-gtop-2.0` package is no longer required starting with version 6.4 of Cinnamon.

  * The *nvme* disks are taken into account from Cinnamon 6.4.
