Graphical Hardware Monitor
==========================

**Graphical Hardware Monitor** is an applet that displays realtime CPU and memory load.

The code for this applet can be found under hwmonitor@sylfurd here : [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets/)

### Usage

You can open the configuration dialog by right-clicking the applet and selecting **Configure...**. In the dialog, you can:

* Select a scale factor between 1,0 and 5,0. The width of the applet is then calculated as:
  * Width = {scale factor} * {panel height}
* Select the update frequency for the graph, by selecting the number of seconds between updates in the Update frequency combo.

### Requirements

**Graphical Hardware Monitor** requires the **Gtop** package to collect system information. It might allready be installed on your system, but if the applet or graph is not shown, you might need to install the **Gtop** package manually.

**Ubuntu / Mint**: install the package **gir1.2-gtop-2.0**
**Fedora**: install the package **libgtop2-devel**
**Arch**: install the package **libgtop**

### Example

![screenshot](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/hwmonitor%40sylfurd/screenshot.png)

### Contributing

*  Original author : Sylfurd
*  Author : Hultan
