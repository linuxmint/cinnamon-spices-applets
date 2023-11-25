# cinnamon-applet-IntelTurboBoost

![Build](https://img.shields.io/badge/build-passing-green.svg)
![Technology](https://img.shields.io/badge/javascript-powered-green.svg)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](https://opensource.org/licenses/MIT)

## Description

**cinnamon-applet-IntelTurboBoost** is a simple systray applet designed for Cinnamon desktop environments.

**Intel Turbo Boost©** is a remarkable technology, yet there are numerous reports on the Internet regarding potential 
instability, ranging from system crashes to thermal throttling. 

Most of the time these issues are related to the motherboard, not the processor itself. In my case the root cause was a 
well known issue regarding my motherboard [VRM](https://www.tomshardware.com/reviews/vrm-voltage-regulator-module-definition,5771.html). Budget motherboards...

Until I discovered and fixed my issue I had to disable **Intel Turbo Boost©** at **BIOS** whenever I wanted to have a 
stable system for critical tasks.

This applet simplifies the process of enabling or disabling **Intel Turbo Boost©** while your system is running, 
eliminating the need for a full system reboot. If you are struggling with **Intel Turbo Boost©**, here are some 
scenarios in which you might consider disabling the feature (for the moment at least):

+ Banking applications.
+ Avoiding thermal throttling.
+ Achieving extreme power savings.

**Important:** Please be aware that if **Intel Turbo Boost©** is disabled at the BIOS level, 
this applet **cannot override** those settings. It serves as a convenient in-session toggle 
for **Intel Turbo Boost©**.

## Disclaimer

This tool may potentially cause damage to your hardware due to its use of reverse-engineered methods involving 
**Model Specific Registers (MSRs)**. Use it at your own risk.

## Processors Tested

These are the processors the applet was successfully tested:

+ **i5-10400F**
+ **i5-7200U**

You are more than welcomed to update this list.

## Requirements

**cinnamon-applet-IntelTurboBoost** requires **msr-tools** package.

### Installing requirements on Linux

Make sure **msr-tools** and **python3-polib** packages are installed before using **cinnamon-applet-IntelTurboBoost**.

On **Ubuntu/Debian** systems, install them with:

~~~bash
$ sudo apt-get install msr-tools
$ sudo apt-get install python3-polib
~~~

On **Redhat/Fedora** systems, install them with:

~~~bash
$ yum install msr-tools
$ yum install python3-polib
~~~
    
## Installation

1. Right click on the cinnamon panel that you wish to add **Intel Turbo Boost** and click on "**Applets**".
1. Click on the "**Download**" tab, search for **Intel Turbo Boost** and click on the install button.
1. Back to the "**Manage**" tab, select **Intel Turbo Boost** and add it to the panel using the "**+**" button at the bottom.

## Troubleshooting

In case of issues with the applet, you can always check if **Intel Turbo Boost©** is enabled with the following command: 

~~~bash
$ cat /sys/devices/system/cpu/intel_pstate/no_turbo
~~~

## Issues

Please report issues [here](https://github.com/wsmenezes/cinnamon-applet-IntelTurboBoost/issues).

## License

**cinnamon-applet-IntelTurboBoost** is Free software under the MIT license, see [LICENSE.txt](./LICENSE.txt) for details.

## Credits

**cinnamon-applet-IntelTurboBoost** was developed by:

![mint_badge](https://www.linuxmint.com/img/signatures/donors/8410.png?time=1666829753)
