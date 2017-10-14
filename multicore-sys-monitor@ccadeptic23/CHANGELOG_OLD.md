Changelog
=========

New changelog info is available in the commit history.

Version 1.5
-----------
Disk IO monitoring is now no longer in beta
Applet no longer attempts to read from disabled devices.
Added Logarithmic scaling option. And description of scaling options to prefs window.
Also prefs window will no longer show devices it dected in the past. But settings will be retained.
  (ie wont show all flash drives ever put into machine, but will remember colors set for them)
Several bug fixes.

Version 1.45
-----------
Fixed gjs shebang to cjs this was why the preferences werent working
Lots of small changes, some code clean up, and "/" mountpoint monitoring
Changed code so that all versions of ubuntu can use the same applet
Added the use of an error icon when the applet fails due to gtop not being installed.
Network line graph now has auto scaling disabled. Its too hard to see what is going on when the axis keeps changing.

Version 1.4
-----------
added ability to seperate code into different files
changed line chart scaling so that the max does not jump around.
added a beta version for disk performance.
Shows error icon applet and message when gtop is not installed.

Version 1.32
-----------
Fixed issue where systems with older version of the glib gir would crash when closing preferences menu.

Version 1.31
-----------
added the color selection choice for swap.

Version 1.3
-----------
New improved customization menu
Added Network Usage Monitoring

Version 1.2
------------
* Memory Visualization expanded and is now a Pie Chart.
* Vertical Bars Graph minor visuals improvement. When the height of vertical bars was 0, it would display annoying little line fragments. Now nice and clean.
* Moved the configuration menu to open on Right click. Left click now opens the system monitor.
* Changed the default color scheme to be monochromatic. I have been using it and think it looks much better. Especially on default Cinnamon.

Version 1.1
-----------
Added the use of a config file, and a menu system to change a few of the parameters. It is called prefs.json.
At the moment the only way to change the colors is to modify this file. I am hoping to add a color selector soon, but documentation is very thin.
If you have seen a cinnamon or gnome-shell extension/applet that uses one I would be very grateful to hear about it.
Also backup the file, and only do it if you feel comfortable.
There are 3 values that control the color of the applet all use arrays of the format:
[r,b,g,a]
r-red from 0 to 1.0
g-green from 0 to 1.0
b-blue from 0 to 1.0
a-alpha from 0 to 1.0

These 3 are: BackgroundColor, ColorsMem, and ColorsCPUs

ColorsCPUs requires a little more explaination. It is an array of arrays the first level is the cpu number that will use that color. For example,
if I had 2 cpus and the first one was red and the second on was green my ColorsCPUs entry would be:
"ColorsCPUs":[[1,0,0,1],[0,1,0,1]]

The ColorsMem is also a matrix but it will always have one row.(For now)

Note 1: that if you have more cpu's than colors defined in the config file.
Then the colors will repeat until you run out of cpus. Add more arrays if you want to specify them.

Note 2: A couple people wanted a monochromatic theme so I will put an extra config file called monoprefs.json.
backup the original prefs.json and rename this one to prefs.json to use it. Then restart cinnamon, before changing the settings again.

Version 1
---------
Initial drop. Psst..When tha bars heights are the same as the applet this is 100%.