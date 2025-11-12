Maximus Window Title
--------------------

This applet is desinged to work in pair with:

* maximus-buttons@hanspr
* maximus extension to remove the title bar on maximized windows
* Multiple monitors. Add the applet to panels in all monitors to follow windows on different monitors

# Features
* It will display the name of the current active window on panel
* Multiple monitors
  * Will show the current active or top most window in each monitor
  * Applet will hightligted with your configured background color on the monitor with the focused window

# How to configure
* Install the applet
* Edit the panel and reposition at the center of the panel
  * If in edit mode you do not have a window name active, move the mouse over the applets, until you see it light up and move to the center

# Configuration options
* Apply regex to title option
  * It allows you to apply a regex on the title to clean it before display
  * If you don't know how to create e regex or are not sure of it's use, leave it blank
  * Default regex: `(?:https?|about):.+? -`
  * Default regex, removes prepended urls from firefox, chrome extensions like `keypass helper url`
* Maximum title length
  * Truncate title length, so it fits better on your current panel width
* Focused background color
  * Allows to define a color when the window is focused (useful with multiple monitors)
  * Setting: `#RRGGBBAA`
  * `RRGGBB` : traditional red, green, blue combination of primary colors
  * `AA` : Alpha channel. `FF` fully transparent , `00` or missing fully opaque.

# Limitations
* It will only work on top, bottom panels that have enough width to hold a window title
* No consideration for vertical panels, it's been tested on horizontal panels only

# Errors
* Please report any errors in github `https://github.com/linuxmint/cinnamon-spices-applets/issues`
* Add `@hanspr` at the beggining of your comment to be notified of your request
