# Nvidia Prime Display Applet for Cinnamon Versions up to 3.8

## Summary

The Nvidia Prime Display Applet is a cut down version of the Bumblebee Applet I wrote a couple of years ago to enable me to monitor the temperature of the nVidia Discrete Graphics Processor Unit on my laptop which has an Core i7 Haswell architecture and Optimus technology to switch between the integrated Intel 4600 graphics and discrete nVidia GTX 765M graphics. NOTE: Use is currently restricted to Cinnamon versions less than 3.8 due to changes in the way that nVidia Prime is integrated into Cinnamon.

The preferred method of switching with the latest kernels and nVidia drivers no longer uses Bumblebee but utilises nVidia Prime which is simpler to install and use. This Applet allows one to monitor whether the power consuming discrete graphics is on and display the nVidia GPU temperature, but only when it is enabled as monitoring the temperature requires the graphics processor to be turned on. The Bumblebee applet is still available for those who wish to use Bumblebee, which still has some advantages over nVidia Prime, although it is more difficult to install.

NOTE: Use is currently restricted to Cinnamon versions less than 3.8 due to changes in the way that nVidia Prime is now integrated into Cinnamon without use of bbswitch. A well tested patch from a user of Nvidia Prime would be welcome as the author is commited to using Bumblebee on his only Optimus machine and is not prepared to offer changes which are untested.

## Rationale

It is useful to have continuous indication of whether the Discrete Graphics Processor Unit is in use and its temperature which is a concern on some laptops.

## Features

The latest versions 3.3.0 and higher work with horizontal and vertical panels.  The indication of which GPU is active has changed to be an icon. The GPU temperature display is beside the icon on horizontal panels and below on vertical panels.  The display is shortened (by removing the degree symbol) if over 100 degrees on vertical panels because of width restrictions.

The temperature display in the panel can now be inhibited to save space if required in settings.  One can also configure the update rate of the applet in settings.

Clicking the applet opens nvidia-settings which allows one to change GPU in the same way as the built in NVIDIA Prime applet.

The right click context menu also gives the ability to run the nVidia Settings program as well as the System Monitor and Power Statistics, all useful for monitoring and controlling power consumption which is paramount when using a laptop on batteries.

There is error checking to ensure the nvidia drivers, nvidia-settings and bbswith are loaded. It displays a message of Err if these are not found.

## Requirements

The applet requires at least Cinnamon 2.0 to access the configuration from within the applet. Mint versions with less than Cinnamon 2.2 have now passed their end of life so all current version are supported.

the nVidia graphics packages must be installed  and working before installing this applet but no other packages are essential. Cinnamon 3.2 or higher is required to support a vertical panel but not to support other features of the applet.

There is a tick box option on the configuration screen to access enhanced functionality through the Right Click Context Menu. This needs a Cinnamon Restart or log out/in before the change is visible. Currently this adds the glxspheres64 Graphics Processor Test to the menu.

glxsheres64 only needs to be installed if you want to use the applet to test the relative performances of the Intel and nVidia graphics processors. glxsheres64 is part of the VirtualGL package which needs to be installed from  http://sourceforge.net/projects/virtualgl/files/VirtualGL/ - download the latest version and install using gdebi (should be the default for a right click on the downloaded file). It should run about five times faster when the nVidia GPU is active and is a very good test as to how good your cooling is for both the CPU and nVidia GPU.

## Translations and other Contributions

The internal changes required in the applet to allow translations are being implemented but no translations are available at this time. Translations are usually contributed by people fluent in the language and will be very much appreciated. Users please note I am rarely able to take responsibility for the accuracy of translations!

Although comments and suggestions are always welcome any contributions which are contemplated must follow discussion. Changes can have many unintended consequences and the integrity of the applet is paramount. Unsolicited Pull Requests will never be authorised other than for urgent and critical bug fixes from the Cinnamon Team or for translations.

## Manual Installation:

   * The nVidia drivers and nVidia Prime must be installed and working before installing this applet.
   * Download from the Spices Web Site
   * Unzip and extract folder ```nvidiaprime@pdcurtis``` to ```~/.local/share/cinnamon/applets/```
   * Install glxspheres64 if required.
   * Enable the applet in System Settings -> Applets
   * You can also access the Settings Screen from System Settings -> Applets or from the Applets Context menu

