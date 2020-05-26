Multi-line taskbar applet for Cinnamon (Linux Mint)
==============================

This is a clone of the original Cinnamon applet that adds support for a multi-line taskbar.

Installation
------------

1. Download the applet and install to ```~/.local/share/cinnamon/applets/```
2. Go to Menu > Cinnamon Settings > Applets
3. Ensure applet 'Cinnamon Multi-Line taskbar' is present
4. Uncheck the default 'Cinnamon Window List'
5. Enable applet 'Cinnamon Multi-Line taskbar'
6. Go to Menu > Cinnamon Settings > Panel
7. Check 'Use customized panel size'
8. Set bottom height to something around 35-70 pixels (depending on your theme and number of rows for the taskbar)

Configuring the applet
----------------------
1. File ```applet.js``` contains two constants: ```TASKBAR_ROW_COUNT``` and ```MIN_BUTTONS_PER_LINE```
2. Restart Cinnamon to see the changes

Known issues
------------
1. Drag-and-Drop (reorder) functionality of the bottom bar might not work



