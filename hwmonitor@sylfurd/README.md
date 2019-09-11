Graphical Hardware Monitor
==========================

**Graphical Hardware Monitor** is an applet that displays realtime CPU and memory load.

The code for this applet can be found under hwmonitor@sylfurd here : [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets/)

### Usage

You can open the configuration dialog by right-clicking the applet and selecting **Configure...**. In the dialog, you can:

* **NEW** You can now turn on or off each individual graph.
* **NEW** You can now choose the width (horizontal panels) or the height (vertical panels) of each individual graph.
* **NEW** There are two new graphs showing internet traffic in and out. The NET graphs shows bytes in/out (per time slot) compared to the max bytes in/out (per time slot), which means that there might be an intial spike. The graph should stabilize itself after a while though (depending on the frequency you have selected). This purpose of this is to make it independant of internet speed.
* Select the update frequency for the graph, by selecting the number of seconds between updates in the Update frequency combo.
* Select theme : If you select **dark theme**, the graph will be drawn in dark colors and vice versa for **light theme**. If you select **custom theme** you can customize the colors so that they match your desktop theme perfectly.
* Choose custom labels : If you check this option, you can override the labels from the language files for each graph.
* You can now add more than one **Graphical Hardware Monitor** to your panels. Might be useful for people with more than one monitor.

### Requirements

**Graphical Hardware Monitor** requires the **Gtop** package to collect system information. It might allready be installed on your system, but if the applet or graph is not shown, you might need to install the **Gtop** package manually.

* **Ubuntu/Mint**: install the package **gir1.2-gtop-2.0**
* **Fedora**: install the package **libgtop2-devel**
* **Arch/Manjaro**: install the package **libgtop**

### Example

Horizontal pane example:

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/horizontal.png)

Vertical pane example:

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/vertical.png)

### Contributing

*  Original author : Sylfurd
*  Author : Hultan (SoftTeam AB)
