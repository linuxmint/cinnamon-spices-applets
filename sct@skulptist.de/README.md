# SCT Toggle 

A Cinnamon applet to toggle through color temperatures.

The code is there: [github.com/Matthias-Hermsdorf/cinnamon-sct-applet](https://github.com/Matthias-Hermsdorf/cinnamon-sct-applet)

### Requirements:
You need to install `sct` to set the color temperature.
Install it with your favorite package management or using the following terminal command:
```sh
sudo apt install sct
```

## Usage
Color temperature steps at 4000K, 5500K and 6500K are predefined. Just click on the Applet Icon to 
select the next one. 
You can define your favorite color steps ins the applet settings by right clicking the applet and
choose setup. Add up to 7 steps with Values between 1000 and 10000, where 1000 is red, 6500 is daylight
and 10000 is very blue.
If the app icon is not the one you want to use, change it in the settings and select another one from the
gtk icon library.