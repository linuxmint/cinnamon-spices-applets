# Bumblebee And NVidia Display Applet (BAND) 

## Summary

The Bumblebee And NVidia Display (Band) Applet is a relatively simple applet I wrote for my Chillblast Defiant laptop which has an Core i7 Haswell architecture and Optimus technology to switch between the integrated Intel 4600 graphics and discrete nVidia GTX 765M graphics. The switching is done by use of Bumblebee. This Applet allows one to monitor whether the power consuming discrete graphics is on and display the GPU temperature, but only when it is enabled. Monitoring the temperature requires the graphics processor to be turned on every time it is measured - some applets do this all the time and that uses a significant extra amount of power.

## Rationale

It is useful to have continuous indication of whether the Discrete Graphics Processor Unit is in use and its temperature which is a concern on some laptops. The latest versions of Cinnamon provide more support so the option of running programs is now less important. 

## Features

The Right Click (Context menu) gives the ability to easily run the nVidia Settings program without use of the terminal and also the System Monitor and Power Statistics, all useful for monitoring Bumblebee and Power consumption which is paramount when using a laptop on batteries.

The standard Left Click menu provides a configurable list of programs which one can run using the discrete nVidia graphics through Bumblebee - this otherwise requires them to be called through optirun in a terminal or via a modified launcher. This list is configured using the standard applet configuration mechanism.  Currently there are two examples - glxspheres64 is a very good test of the speed of the graphics but may need to be installed. The other example is the nVidia Settings program which is also on the right click menu so it can be overwritten. There are 5 'slots' currently and if you do not require a slot set the Display Name to null or leave it completely empty. One can also configure the update rate of the applet in settings.

The current version has improved error checking to ensure bumblebee is loaded and does not fill the error logs with messages when that is the case. It displays a message of ERROR if bumblebee if bumblebee is not loaded and a message when you hover.To Follow


## Requirements

The applet requires at least Cinnamon 1.8 and 2.0 is desirable to access the configuration from within the applet. 

The Bumblebee and the nVidia graphics packages obviously need to be installed but no other packages are needed. 

glxsheres64 only needs to be installed if you want to use the applet to test the relative performances of the Intel and nVidia graphics processors. glxsheres64 is part of the VirtualGL package which needs to be installed from  http://sourceforge.net/projects/virtualgl/files/VirtualGL/ - download the latest version and install using gdebi (should be the default for a right click on the downloaded file). It should run about five times faster when the nVidia GPU is active and is a very good test as to how good your cooling is for both the CPU and nVidia GPU when it is active.

## Manual Installation:
  
   * Make sure Bumblebee is installed and working.
   * Download from the Spices Web Site
   * Unzip and extract folder ```bumblebee@pdcurtis``` to ```~/.local/share/cinnamon/applets/```
   * Install glxspheres64 if required.
   * Enable the applet in System Settings -> Applets
   * You can also access the Settings Screen from System Settings -> Applets or from the Applets Context menu
