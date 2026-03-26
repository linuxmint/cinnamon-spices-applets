Author: tuuxx
Applet for BOSE Quiet Comfort 35 II
Get connection details of BOSE Quiet Comfort 35 II, requires: bluez-tools, Pulseaudio and based-connect

--

## Setup:
After installation, set your device MAC-Adress in the Settings. 
You get your Bluetooth MAC with the command bt-device -l or via the Bluetooth manager.
The MAC should be in format: ```XX:XX:XX:XX:XX:XX``` 

**based-connect:** 
Get the based-connect files from here: https://github.com/Denton-L/based-connect. 
Simply run ```make -j``` to build the program. The executable produced will be
called `based-connect`. Put this binary file under ```.local/share/cinnamon/applets/bose@tuuxx/based-connect/based-connect``` or specify another path in the settings of this applet. 







