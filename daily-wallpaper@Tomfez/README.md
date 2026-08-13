# Daily desktop wallpaper for Cinnamon

## Summary
A Cinnamon applet to apply a daily wallpaper to your Cinnamon Desktop Background.

Inspired by the [Bing extension](https://github.com/linuxmint/cinnamon-spices-applets/tree/8e808be8c81a9264a3a5a6985a5b44df1053f6ce/bing-wallpaper%40starcross.dev) made by [@Starcross](https://github.com/Starcross).

The point of making this applet was to give some parameters to let the user save the wallpaper in a desired directory and browse previous wallpapers like the official Bing desktop application for Windows.

By default, each day the new wallpaper will be downloaded from the source and applied as the desktop background. You can turn off the daily update if you want to keep the current desktop wallpaper.

The resolution used is the maximum found from each source. This will give the best quality and can be resized by Cinnamon (change the Picture aspect in Backgrounds -> Settings if needed) 

Currently there are 3 sources :
 - Bing
 - APOD
 - Wikimedia

## Functionnalities
- Turn On/Off daily update
- Choose your own directory for saving the wallpapers (default is "~/.config/dailywallpaper")
- Get the most recent or a random wallpaper each time the applet refresh
- Change the timer to check for a new wallpaper (default is 12h)
- Browse previous wallpapers (up to 7 days which is the maximum you can go with Bing) 

## Screenshots
### Settings
![Settings](<screenshots/settings.png>)

### Panel
![Panel](<screenshots/panel.png>)