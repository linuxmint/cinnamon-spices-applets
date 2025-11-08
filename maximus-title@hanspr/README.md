Maximus Window Title
--------------------

This applet is desinged to work in pair with:

* maximus-buttons@hanspr
* maximus extension to remove the title bar on maximized windows
* Multiple monitors. Add the applet to panels in all monitors to follow titles on different monitors

# Features

* It will display the name of the current active window on panel

# How to configure
* Install the applet
* Edit the panel and reposition at the center of the panel
  * If in edit mode you do not have a window name active, move the mouse over the applets, until you see it light up and move to the center

# Configuration options
* Apply regex to title option
  * It allow you to setup a regex on the title to clean it before display it
  * If you don't know how to create e regex or are not sure of it use, leave it blank
  * Default regex: `(?:https?|about):.+? -`
  * removes prepended urls from firefox, chrome extensions like `keypass helper url`
* Maximum title length
  * Length of title so it fits better on your current panel width

# Limitations
* It will only work on top, bottom panels that have enough width to hold a window title
* No consideration for vertical panels, it's been tested on horizontal panels only

# Errors
* Please report any errors in github `https://github.com/linuxmint/cinnamon-spices-applets/issues`
