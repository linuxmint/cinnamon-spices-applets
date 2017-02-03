# Countdown Timer

A simple countdown timer app, modeled after a kitchen timer. I wanted something easy to remind myself to get up every hour and stretch. To jazz it up a little the timer can play a sound, flash a message, open the applet menu, or plaster a confirmation dialog on the screen -- hard to miss. You can display several notifications at once, such as displaying the confirmation dialog while playing an alarm sound. The app defaults to just a message, the app menu being popped open, and a minutes countdown label on the panel. The label can be disabled in config.js

To set the sound, message, or confirm dialog edit the ~/.local/share/cinnamon/applets/timer-notifications@markbokil.com/config.js file. You can right-click applet to edit the config file. Select right-click Restart Cinnamon to reload the applet after editing.

## Installing

0) Add sox play if you want sound capability: sudo apt-get install sox

1) Extract to ~/.local/share/cinnamon/applets

2) Enable the applet in cinnamon settings

3) Restart Cinnamon if you change the config.js file. Right-click applet > Restart


## TODO:
  * Add GUI for options and save to gsettings schema avoiding config.js approach.

## Changelog

* 2.1.0
  - Started using stock icons instead of customs - thanks zagortenay333!

* 2.0.0
  - Forked code from original author
  - Now displaying hours, minutes, seconds
  - Slider has multiple with different (increasing) steps, to be able to easily pick any interval between 10 seconds and 24 hours.
  - Streamlined UI: moved preset into main menu in order to be able to start the timer with two clicks
  - refactored and cleaned out the code a bit
  - presets and intervals for the slider can now be dynamically configured.
* 1.0.2
  - centered confirm dialog text
  - added restart to right-click menu
  - fixed 3 min preset error
  - added panel label countdown
* 1.0.1
  - added run, stop, alarm states to icon,
  - added 3 min. tea time
  - centered dialog button with CSS
  - tweaked slider code to reset icons timer/on off if dragged to zero
  - added right-click edit menu.
* 1.0.0
  - stable release.

> Forked from timer-notifications@markbokil.com: https://cinnamon-spices.linuxmint.com/applets/view/68
