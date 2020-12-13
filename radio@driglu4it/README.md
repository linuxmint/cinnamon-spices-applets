# Radio++
A simple radio applet for Cinnamon with editable list of stations.  Special thanks for the improvements and translation NikoKrause (https://github.com/NikoKrause). You can control the volume with the mouse wheel, and also mark the stations that are to be shown in the list. The applet uses the mpv player for playing the radio stream in combination with [this](https://github.com/hoyon/mpv-mpris) plugin which implements the MPRIS Interface. This allows you to control the radio with several programs such as the sound applet, kdeconnect or playerctl. The last one is required for the applet anyway as it is used on the hand for controlling the volume and on the other hand it is also used to automatically stop all other media players, which implement MPRIS, when starting a radio channel. 

## Requirements
```
sudo apt-get install playerctl mpv 
```

The plugin for mpv mentioned above is automatically downloaded at the first start of the applet and is located in the applet folder. 

## Known Issues
- The volume of the radio can be changed either by using the mouse wheel when the cursor is above the applet icon or by changing the volume of the MPV Player in the sound applet. However the two sound settings are independent of each other and not synchronized as it should be. This is most likely a Bug of the sound applet and is reported on (Github)[https://github.com/linuxmint/cinnamon/issues/9770]
- Special characters (e.g German Umlaute) are not shown correctly on the sound applet (when the option "Show song information on the panel" is activated). This is a limitation of the used MPRIS Plugin. 
- After restarting cinnamon, the radio channel is not indicated by a dot and not shown in the tooltip. This will be fixed in future. 
- There is currently no maximum volume limit which can leads to scratching noises. Therefore there should be a limit (not sure which value though). This will be fixed in future. 

## Ideas for improvements
- Automatically stop playing when another MPRIS meida player starts
- Adding an option to show the application volume in the tooltip 
- Adding an option to show the title of the radio channel in the panel 
- Adding an option to show the last played radio channel italic
- Better Error Handling (e.g. show a notification when radio url is invalid)