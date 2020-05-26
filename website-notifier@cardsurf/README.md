# Website notifier
An applet that shows a notification when a website updates for Linux Mint Cinnamon

## Features
* Periodically refreshes a website
* Shows a notification when the website updates
* Displays notification as a system popup or an applet popup
* Customizable:
  * Set a maximum number of characters in notification text
  * Choose tooltip text
  * Customize an icon shown in a panel
  * Write a script that refreshes a website

## Refresh
To refresh a website on demand click on the applet with a left mouse button

## Notifications
To show the last notification text click on the applet with a middle mouse button

## Scripts
To write a script that refreshes a website: 
  
1. Edit the script file: ~/.local/share/cinnamon/applets/website-notifier@cardsurf/scripts/custom.sh
2. Modify the `refresh` function

## Source code
Browse the source of the applet in the [original repository](https://gitlab.com/cardsurf/website-notifier).  
