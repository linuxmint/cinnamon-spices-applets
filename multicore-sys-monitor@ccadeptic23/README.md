You must install the **gir1.2-gtop-2.0** package to use this applet.

**Instructions for upgrading to Cinnamon 3.4**

Uninstall the applet from Applet Settings, delete ```~/.local/share/cinnamon/applets/multicore-sys-monitor@ccadeptic23``` and ```~/.cinnamon/configs/multicore-sys-monitor@ccadeptic23```. Then reinstall from Applet Settings, so it re-downloads it.

The below instructions are outdated. You can customize the color scheme in the applet's settings app.

**How to Configure Colors (in prefs.json)**

Edit config file in called prefs.json. Also backup the file, and only do it if you feel comfortable.
There are three values that control the color of the applet that all use arrays in the settings format:

[r, b, g, a]
r (red): 0-1.0
g (green): 0-1.0
b (blue): 0-1.0
a (alpha): 0-1.0

The three propteries using these values are ```BackgroundColor```, ```ColorsMem```, and ```ColorsCPUs```.

ColorsCPUs requires a little more explanation. It is an array of arrays. The first level is the CPU number that will use that color. For example,
if you have two CPUs where the first one is red, and the second one is green, your ColorsCPUs entry would be:

```
"ColorsCPUs": [[1, 0, 0, 1], [0, 1, 0, 1]]
```

The ```ColorsMem``` property is also a matrix like this, but instead of the CPU number, each of the sub arrays are for different parts of the memory utilization.
The first row is the memory that is "used up", meaning it is not available for a program to use. This is the value the system monitor shows as the memory percentage. The second value is buffered memory, the third is cached memory, and the fourth is free memory.

For example, If you wanted the used up memory to be red, the buffered memory to be green, the cached memory to be blue, and the free memory to be white, the ```ColorsMem``` property's value would be:

```
"ColorsMem": [[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1], [1, 1, 1, 1]]
```

If you want free memory to be transparent, make the fourth entry all ```0``` values.

If you have more CPUs than colors defined in the config file, then the colors will repeat over the remaining CPU cores. This behavior happens with the memory colors as well. Add more arrays if you want to specify them.

[View the original author's changelog](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/multicore-sys-monitor%40ccadeptic23/CHANGELOG_OLD.md).

## Translations

[Status of translations](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/multicore-sys-monitor%40ccadeptic23.md#)

