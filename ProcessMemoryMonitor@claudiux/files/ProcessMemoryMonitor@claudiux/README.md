# Process Memory Monitor

Monitors memory usage of Cinnamon or any other process.

Universal Unique IDentifier (UUID): `ProcessMemoryMonitor@claudiux`

Author: @claudiux.

Special thanks to: @mtwebster.

## No requirement

This applet works on Cinnamon's horizontal panels, with no other requirements.

## Operating

By default, this applet displays the (resident) memory usage of the cinnamon process.

There is no menu, but a context menu.

Hovering over the applet, stats are shown.

Left-clicking on this applet allows you to reset or reconnect to the process.

Right-clicking on this applet allows you to:

  * Configure this applet.
  * Set the Refresh interval (from 0 up to 10 seconds, by step of 0.5 second).
  * Open the System Monitor.

## Configuration

There are four tabs to configure this applet:

  1. Process: Enter the **process name** (such as *mpv* or *firefox-bin*) or **PID** (Process ID) you wish to monitor, then press the *Apply* button. If this field is empty, the monitored process is *cinnamon*. You can open the System Monitor to know process names or PIDs.

  2. Style: Select the font weight, family and size for display on the panel. You can also choose to let the applet calculate the label width, or set it yourself.

  3. Characters: Select the characters indicating the current variation in value. You can also choose to display none.

  4. Abbreviations: You can choose the abbreviations you wish to use for *mebibyte (MiB)* and *kibyte per minute (kiB/min)*.

## Nota Bene

The responsiveness of this applet depends on the refresh interval you set.

Before a new refresh interval (or other setting as abbreviation) is taken into account, you must wait for the current cycle to finish.

For example, if you decide to change the refresh interval from 10 sec. to 1 sec. but the current cycle started 3 sec. ago, you'll have to wait 7 sec.

This applet performs fewer calculations when you set the label width yourself.

The variation characters used are [emoji](https://emojidb.org/). Use copy-and-paste.