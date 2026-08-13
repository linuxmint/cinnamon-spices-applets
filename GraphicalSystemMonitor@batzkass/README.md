
Graphical System Monitor

---------------

A customizable system monitor showing data and history charts in your cinnamon panel.

####  Features
* Monitors cpu, memory, swap, network, system load
* Colored chart in the panel along with optional textual values
* Tooltip with large chart containing more history on hover
* Launch system monitor app of your choice on click
* Size and colors fully customizable
* Horizontal/Vertical panel layouts, although the layout will be better on a horizontal one

#### Prerequisites
This applet uses glibtop to get system resources usage statistics. It may be pre-installed in your distro, otherwise you must install it:
* Ubuntu, Mint
```
sudo apt-get install gir1.2-gtop-2.0
```
* Fedora
```
sudo dnf install libgtop2
```

#### Notes
This is a fork of sysmonitor@orcus. The main idea was kept, but most of the code was rewritten. Also add graphical tooltips and textual data on the graphs. provider.js was almost kept as is.

Thanks to @orcus for his original work. 
