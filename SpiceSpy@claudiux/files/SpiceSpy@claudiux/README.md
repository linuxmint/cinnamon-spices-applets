# SpiceSpy

This applet alerts you when a change is made (new score, new comments) to your favorite spices on the dedicated [Cinnamon website](https://cinnamon-spices.linuxmint.com/).

It's useful for Spices developers and also for users who have posted a comment or a question and are waiting for an answer.

## Installation

System Settings -> Applets:

1. *Download* tab: search and download **SpiceSpy**.
2. *Manage* tab: add **SpiceSpy** to a panel.

## Configure

Open the menu of this applet and select *Configure...*

Some options are available. But the most important are the list of authors and the list of specific Spices you are interested in.

## FAQ

### No instant display

In this applet's menu, try *Refresh...* just once.

There's no point in refreshing several times in a row; you'll just saturate the Cinnamon server with requests and it will end up blocking you for an hour.

Let the applet do its thing and you'll soon see the Spices concerned displayed in its menu.

### Only applets are available in the menu

That's because you've never downloaded any type of Spice other than Applets.

To make a Spice type visible, simply open the Download tab for that Spice type from System Settings. For Themes, you must first have selected Advanced Settings.

### The number of comments is updated very slowly

To avoid overloading the Cinnamon server, requests to it are spaced 13 seconds apart.

On first use, all comment numbers are initialized to zero. Then, every 13 seconds, a comment number is updated.

Once all comment numbers have been updated, you can use the *Mark all as read* menu option. The applet is then fully functional: you'll be notified of any score changes or new comments.

### How to know the Author or the UUID of a spice?

On the [Cinnamon website](https://cinnamon-spices.linuxmint.com/) open the page of a Spice.

Example: [Radio3.0 applet](https://cinnamon-spices.linuxmint.com/applets/view/360). At the top of the page, you see "Radio3.0 by **claudiux**" (the author or current maintainer of this applet is *claudiux*).

Just below, you see the UUID of this applet: **Radio3.0@claudiux**

*Please note that there is no need to enter the UUID of a Spice whose author is already in the Authors list.*


