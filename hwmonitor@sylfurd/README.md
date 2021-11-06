Graphical Hardware Monitor
==========================

**Graphical Hardware Monitor** is an applet that displays realtime system information (CPU load, memory usage, network in and out, disk usage (read and write)).

The code for this applet can be found under hwmonitor@sylfurd here : [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets/)

Issues can be reported here : [Issues](https://github.com/linuxmint/cinnamon-spices-applets/issues?q=is%3Aissue+hwmonitor+user%3Asylfurd+is%3Aopen)

### Changes

**Version 1.3.1**:
* **Bug Fix
    * Fixed a bug that crashed the applet if the hardcoded default was not a valid device option. The default is now the first device listed after scanning for devices on the system instead of "sda".

**Version 1.3**:
* **Bug Fixes and Feature Enhancements**: Disk Usage Stats
    * Fixed a bug that prevented device mapper volumes (LVM, dm-crypt LUKS, etc.) from displaying usage statistics details or graphs.
    * Disk usage graphs and details statistics are now displayed as throughput with unit and graph scaling (B/s, KB/s, MB/s, etc.).
    * It is now possible to select the disk to monitor from a drop down menu in the settings UI that lists the available storage devices on the system.

**Version 1.2.1**:
 * **New setting**, a new minor UI setting, you can now choose how to draw the grid lines in the graphs. You can choose between:
    * Don't draw grid lines at all
    * Draw grid lines over the graphs **(default)**
    * Draw the graphs over the grid lines.

**Version 1.2**:
 * **New graph**, a graph that shows the battery charge level (**BAT**) for laptops have been added. Non-laptop users should turn off the graph in the settings if you want to save some space.

**Version 1.1.1**:
 * **New setting** for choosing what drive to monitor for **DISK (read)** and **DISK (write)**.

**Version 1.1**:
 * **Two new graphs**, showing disk usage, are now available (called **DISK (read)** and **DISK (write)**). These graphs shows the usage of the **root drive (/)** (fixed in Version 1.1.1). It will automatically set itself up, based on the max usage over time. This means that the graph might show high usage in the beginning, but it will settle down once a reasonable max value has been set. These graphs are available in all versions of Cinnamon.

**Version 1.0**:
 * **Multi-version support**: Should now support older versions of Cinnamon (before 3.8).

**Older versions** (without a version number):
 * You can open the configuration dialog by right-clicking the applet and selecting **Configure...**.
 * Configuration dialog has been cleaned up and divided into pages.
 * Some new themes have been implemented. (Thanks to **@cgvirus**)
 * There are two new graphs showing internet traffic in and out. Note that you might need to adjust the values for your Internet speed in the configuration dialog, both in and out, for the graphs to look good. The default value is 100 Mbit/s. You might want to set the values to slightly higher or lower than the internet speed you have paid for. You can show the graphs in a linear or logarithmic scale.
 * You can now turn on or off each individual graphs.
 * You can now choose the width (horizontal panels) or the height (vertical panels) of each individual graph.
 * You can now show or hide a detail label, which show for example CPU usage %, or used memory etc.
 * You can now control the font size of both the main label and the detail label.
 * Select the update frequency for the graph, by selecting the number of seconds between updates in the Update frequency combo.
 * Select theme : If you select **dark theme**, the graph will be drawn in dark colors and vice versa for **light theme**. If you select **custom theme** you can customize the colors so that they match your desktop theme perfectly.
 * You can set a custom label for each graph. By doing this you will override the labels from the language files.
 * You can now add more than one **Graphical Hardware Monitor** to your panels. Might be useful for people with more than one monitor.
 * The applet now works in both vertical and horizontal panels.

### Requirements

**Graphical Hardware Monitor** requires the **Gtop** and **GUdev** packages to collect system information. It might already be installed on your system, but if the applet or graph is not shown, you might need to install the packages manually.

* **Debian/Ubuntu/Mint**: install the packages **gir1.2-gtop-2.0** and **gir1.2-gudev-1.0**
* **Fedora**: install the package **libgtop2-devel** and **libgudev**
* **Arch/Manjaro**: install the package **libgtop** and **libgudev**

### Example

Horizontal pane examples:

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/horizontal.png)

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/horizontal2.png)

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/horizontal3.png)

Vertical pane examples:

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/vertical.png)![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/vertical2.png)![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/vertical3.png)

### Contributing

*  Sylfurd
*  Hultan (SoftTeam AB)
*  Claudiux
*  D1ceWard
*  kelebek333
*  Jason Hicks
*  spacy01
*  brownsr
*  Alan01
*  eson57
*  renepavlik
*  colinss
*  MrElectroNick
*  NikoKrause
*  giwhub
*  andreevlex
*  clefebvre
*  jacobwills