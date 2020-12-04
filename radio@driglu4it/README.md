# Radio++
A simple radio applet for Cinnamon with editable list of stations.  Special thanks for the improvements and translation NikoKrause (https://github.com/NikoKrause). You can control the volume with the mouse wheel, and also mark the stations that are to be shown in the list. The applet uses the mpv player for playing the radio stream in combination with [this](https://github.com/hoyon/mpv-mpris) plugin which implements the MPRIS Interface. This allows you to control the radio with several programs such as the sound applet, kdeconnect or playerctl. The last one is required for the applet anyway as it is used on the hand for controlling the volume and on the other hand it is also used to automatically stop all other media players, which implement MPRIS, when starting a radio channel. 

## Requirements
```
sudo apt-get install playerctl mpv 
```

The plugin for mpv mentioned above is automatically downloaded at the first start of the applet and is located in the applet folder. 