# Multi-Core System Monitor

This applet displays real-time CPU usage for each core/processor as well as overall memory and disk usage (including encrypted partitions).
It also can display the CPU temperature.

## Dependencies

For Cinnamon version lesser than 5.6 you must install the `gir1.2-gtop-2.0` package to use this applet. This package is no longer needed with Cinnamon 5.6.+.

Better display using the `DejaVuSansMono-Bold.ttf` font from the `fonts-dejavu-mono` package.

## CPU temperature

By default, this applet read the CPU temperature from the system file: 
`/sys/class/thermal/thermal_zone1/temp`

If this does not work for you, search for the appropriate file from `/sys/class/thermal/thermal_zone*` using nemo.

Once found, this file should contain the information `41000` when the CPU temperature is 41°C.
Then enter its path in the "Path to the system file used to check the CPU temperature" field, in the CPU tab of this applet's settings.

You can display the CPU temperature in degrees Fahrenheit (°F), if you wish.

You can set color warnings when the CPU temperature reaches a High or Critical level.

## Memory

The user can choose between the htop method (recommended) and the System Monitor method to calculate memory values.

## Network

Starting with Cinnamon 5.6, you can display the total amount transferred or the instantaneous transfer speed.

## Battery
Starting with Cinnamon 5.6, you can display the percentage of charge for each battery.
In the tooltip you can see info like this:
  BAT0 (90%):     95%
90% means that your BAT0 battery has a health status of 90% relative to its rated capacity. The older your battery gets, the lower this percentage becomes.
95% means that your battery is charged to 95% of its current maximum capacity. This therefore represents 95% of 90% (i.e., 85.5%) of its rated capacity.


## Instructions for upgrading to Cinnamon 5.6

From Applet Settings:

  * Uninstall entirely this applet, selecting it then using the ⨂ button.
  * Use the Download tab to download this applet.
  * Return to Manage tab to add this applet to your panel.
  * Open this applet settings and configure it using each tab.
  * The Colors tab allows you to set the colors used by Net and Disks devices.
  * In the Net and Disk IO tabs, you can use the “Update Device List” button to display the devices used by your system.
  * Some changes require the use of the “Refresh All” option in the context menu.

## Translations

[Status of translations](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/multicore-sys-monitor%40ccadeptic23.md#)

New translations and updates are welcome!
