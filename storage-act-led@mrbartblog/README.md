# Mass Storage Activity LED Indicator

A Cinnamon desktop applet (Linux Mint) that adds a visual disk activity indicator (LED) directly to your system panel. This is a perfect solution for laptop users or PC cases that lack a physical HDD activity LED.

## Description
The applet monitors system statistics and changes its icon color whenever a read or write operation is detected. This allows the user to see in real-time if the system is performing background I/O operations.

## Technical Details (`/proc/diskstats`)
The applet works by parsing the `/proc/diskstats` file, which contains runtime block device statistics. It specifically tracks:
* **Field 4**: Number of reads completed.
* **Field 8**: Number of writes completed.

By comparing the current values with the previous ones every **100ms**, the applet determines the current state:
* ⚫ **Idle** - (black circle) No changes in stats.
* 🟢 **Read** - (green circle) Increase in read count.
* 🔴 **Write** - (red circle) Increase in write count.
* 🟤 **Both** - (brown circle) Simultaneous increase in both read and write counts.

The brown is chosen as halfway between red and green light

## Requirements
* **System Emojis**: This applet utilizes built-in system emoticons as colorful icons. Ensure your system has a font supporting color emojis installed (e.g., Noto Color Emoji).

## Configuration
The applet works automatically for the main disk controller.

The refresh/measurement interval is set to **100ms**. This value can be changed directly in the `applet.js` code. However, in the author's opinion, 100ms provides a very accurate representation of how a physical LED built into a computer would behave – longer would be too slow, and shorter would be hard for the human eye to track.

## Source & License
This software is provided "as-is". For more details, refer to:
* [Original Article](https://zarzyc.wordpress.com/2026/01/13/mass-storage-activity-led-indicator-for-linux-mint-cinnamon/)
* Credits for the icon: [smashingstocks on Flaticon](https://www.flaticon.com/authors/smashingstocks)