# Radio++
A simple radio applet for Cinnamon.

## Features
- For Cinnamon 4.6 and above: The radio applet can be controlled (paused, sound increased/decreased) with programms with MPRIS control (e.g.the sound applet, kdeconnect or playerctl). Such programs also receive the title of the current playing song (e.g you can show the current playing song in the sound applet by activating the option "Show song information on the panel" in the sound applet). However be aware that there are some minor Bugs in this feature due to upstream issues (see section **known Issues**)
- For Cinnamon 4.6 and above: All other running programs with sound output which have implemented the MPRIS interface (e.g. most Browsers, Spotify, ...) are stopped when starting a radio channel 
- The volume can be controlled with the mouse wheel. 
- Three options for the icon: Symbolic, Full Color or Bicolor Icon. For the Symbolic Icon the color of the Icon is changed to a user-defined color when playing a radio stream
- In the settings are two buttons which help you to find the radio stream url of your favorite radio station. The first one open this [URL Search engine](https://streamurl.link) and the second one open this [Radio List Collection](https://wiki.ubuntuusers.de/Internetradio/Stationen/) in your default Browser when clicking on it
- A download dialog is opened when clicking on the applet for the missing dependencies


## Dependencies
It is opened a download dialoge for each missing dependencies when clicking on the applet which makes the installation process of the radio applet as easy as possible. So it is not necessary to manually install the dependencies. The used dependencies are therefore only listed for your information. 

### Cinnamon 4.6 and above 
It is used the [mpv media player](https://mpv.io) for playing the radio channel. The command line utility [playerctl](https://github.com/altdesktop/playerctl) is used to stop running programms with MPRIS control (including the aplet itself) and changing the volume of the applet. 

As the mpv media player doesn't support MPRIS control out of the box, it is used [this plugin](https://github.com/hoyon/mpv-mpris)
to get this feature. 

### Below Cinnamon 4.6 
[Moc player](http://moc.daper.net) 


## Known Issues
- The volume of the radio can be changed either by using the mouse wheel when the cursor is above the applet icon or by changing the volume of the MPV Player in the sound applet. However the two sound settings are independent of each other and not synchronized as it should be. This is most likely a Bug of the sound applet and is reported on [Github](https://github.com/linuxmint/cinnamon/issues/9770)
- Special characters (e.g German Umlaute) are not shown correctly on the sound applet (when the option "Show song information on the panel" is activated). This is a limitation of the used MPRIS Plugin. 

- There is currently no maximum volume limit which can leads to scratching noises. Therefore there should be a limit (not sure which value though). This will be fixed in future. 

## Ideas for improvements
- Automatically stop playing when another MPRIS media player starts
- Adding an option to show the application volume in the tooltip 
- Adding an option to show the title of the radio channel in the panel 
- Adding an option to show the last played radio channel italic
- Better Error Handling (e.g. show a notification when radio url is 
invalid)
- Add a option "copy title" in the right click menu