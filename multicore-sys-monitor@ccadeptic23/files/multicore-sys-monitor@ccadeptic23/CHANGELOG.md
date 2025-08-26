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
