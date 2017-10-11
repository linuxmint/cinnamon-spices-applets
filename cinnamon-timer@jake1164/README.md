# Countdown Timer

A simple countdown timer app, modeled after a kitchen timer. I wanted something easy to remind myself to get up every hour and stretch. To jazz it up a little the timer can play a sound, flash a message, open the applet menu, or plaster a confirmation dialog on the screen -- hard to miss. You can display several notifications at once, such as displaying the confirmation dialog while playing an alarm sound. The app defaults to just a message, the app menu being popped open, and a minutes countdown label on the panel. The label can be disabled in config.js

To set the sound, message, or confirm dialog edit the ~/.local/share/cinnamon/applets/timer-notifications@markbokil.com/config.js file. You can right-click applet to edit the config file. Select right-click Restart Cinnamon to reload the applet after editing.

## Installing

0) Add sox play if you want sound capability: sudo apt-get install sox

1) Extract to ~/.local/share/cinnamon/applets

2) Enable the applet in cinnamon settings

## TODO:

## Changelog

* 1.0.0
  - Took over applet from @axos88.
  - Fixed settings to use cinnamon settings.
  - Made audio setting more user friendly. 

> Forked from axos88@countdown-timer: https://cinnamon-spices.linuxmint.com/applets/view/280
> Forked from timer-notifications@markbokil.com: https://cinnamon-spices.linuxmint.com/applets/view/68
