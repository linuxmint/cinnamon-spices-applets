# SCT Toggle 

A Cinnamon Applet commonly used in Linux Mint to toggle through color temperatures.

## Install from this repo
1. Install `sct` with your favorite package management or by the terminal command `sudo apt install sct` . This command line tool 
sets the screen temperature easily with `sct 5000`
1. Download the code from here.
1. Copy the "sct@skulptist.de" directory to ~/.local/share/cinnamon/applets .
1. Open the Mint Menu, search for "Applets" and open the applet configuration app.
1. Add the applet to your screen by searching for `sct@skulptist.de`, select it and press the + button to add it.

## Install from the official repo
As soon as my pull request is acepted, you could omit the cloning and copying steps and download the applet through the applets app.

Don't forget to give a star for the applet ;-)

You have to install `sct`. It does not get shipped with the applet.

## Usage
Color temperature steps at 4000K, 5500K and 6500K are predefined. Just click on the Applet Icon to 
select the next one. 

You can define your favorite color steps in the applet settings by right clicking the applet and
choose setup. Add up to 7 steps with Values between 1000 and 10000, where 1000 is red, 6500 is daylight
and 10000 is very blue.

If the app icon is not the one you want to use, change it in the settings and select another one from the
gtk icon library.