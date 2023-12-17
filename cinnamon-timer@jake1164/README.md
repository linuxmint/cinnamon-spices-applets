# Countdown Timer

A simple countdown timer app, modeled after a kitchen timer. I wanted something easy to remind myself to get up every hour and stretch. To jazz it up a little the timer can play a sound, flash a message, open the applet menu, or display a confirmation dialog on the screen. You can display several notifications at once, such as displaying the confirmation dialog while playing an alarm sound. 

All settings can be changed by right clicking on the icon and selecting configure. Changes are immediate and you dont need to restart cinnamon for them to take effect.

## Installing

0) Add sox play if you want sound capability: sudo apt-get install sox

1) Extract to ~/.local/share/cinnamon/applets

2) Enable the applet in cinnamon settings

## Tips
* if you want change panel icon color, edit stylesheet.css.

    File path
    
          ~/.local/share/cinnamon/applets/cinnamon-time@jake1164/3.4/stylesheet.css
    
    Example
    
        .timer-running .system-status-icon {
	            color: orange;
        }

## TODO:

## Changelog
* 1.3.1
  - Fixed bug. (Panel icon status incorrect when timer has expired once)

* 1.3.0
  - Added auto loop.

* 1.2.0
  - The time of the alarm is displayed (configurable).
  - Changed the order of the default Preset Times to be strictly descending.

* 1.1.3
  - Added support for Cinnamon 4.0

* 1.1.2
  - Added legacy support for Cinnamon 2.6 - 3.2 (No dropdown or slider settings in settings window)
  
* 1.1.1
  - Changed Preset Times to include separate time spinners for hours, minutes and seconds.
  
* 1.1.0
  - Moved slider intervals into cinnamon-settings. 
  - Moved Preset Times into cinnamon-settings
    - Added a Label that will override the default label and be displayed in the selection menu.
    - Added a custom message per preset that will override the global message and display when complete.
  - Changed the sound selector to use the built in cinnamon-settings sound selection dialog.

* 1.0.0
  - Took over applet from @axos88.
  - Fixed settings to use cinnamon settings.
  - Made audio setting more user friendly. 
  - Made the timer persistant over a reboot.

> Forked from axos88@countdown-timer: https://cinnamon-spices.linuxmint.com/applets/view/280
> Forked from timer-notifications@markbokil.com: https://cinnamon-spices.linuxmint.com/applets/view/68
