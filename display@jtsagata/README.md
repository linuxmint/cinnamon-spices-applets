This is a cinnamon applet for handling multimonitor configurations.

Installation
============
1) Unzip, copy the folder "display@jtsagata" to "~/.local/share/cinnamon/applets/".
2) Enable the applet in cinnamon settings.
3) Give feedback


Usage
=====
1. First install arandr
		sudo apt-get install arandr
arandr is a tool that helps you setup multimonitor configurations. 
Each configuration is just a plain bash script on $HOME/.screenlayouts folder.

2. Create some layouts with arandr. Save it with a descriptive name.
3. Restart cinnamon

Nvidia
======
NVidia blob finally supports randr. Be sure to install version 304.51 or bigger. You can check the version from nvidia-settings tool.