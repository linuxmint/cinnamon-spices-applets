# Multi-Core System Monitor

This applet displays real-time CPU usage for each core/processor as well as overall memory and disk usage (including encrypted partitions).
It also can display the CPU temperature.

## Dependencies

For Cinnamon version lesser than 6.4 you must install the `gir1.2-gtop-2.0` package to use this applet. This package is no longer needed with Cinnamon 6.4+.

## CPU temperature

By default, this applet read the CPU temperature from the system file: 
`/sys/class/thermal/thermal_zone1/temp`

If this does not work for you, search for the appropriate file from `/sys/class/thermal/thermal_zone*` using nemo.

Once found, this file should contain the information `41000` when the CPU temperature is 41°C.
Then enter its path in the "Path to the system file used to check the CPU temperature" field, in the CPU tab of this applet's settings.

You can display the CPU temperature in degrees Fahrenheit (°F), if you wish.

You can set color warnings when the CPU temperature reaches a High or Critical level.


## Instructions for upgrading to Cinnamon 6.4

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
