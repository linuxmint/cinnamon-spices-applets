# Sensors Monitor

[Download][download]

This applet displays and monitors the values ​​of many computer sensors concerning **Temperatures** (from CPU, GPU, Power Supply), **Fan Speed**, **Voltages**, **Intrusions**.

It notifies you with color changes when a value reaches or exceeds its limit.

It uses values from the `sensors` command. (See [lm-sensors][lmsensors].)

Any suggestion to improve this _Sensors@claudiux_ applet is welcome.

## Benefits

  * Allows simultaneous display and monitoring of values ​​from multiple sensors, including sensors of the same type. (For example: 2 temperatures, 3 voltages, 1 fan speed, 1 intrusion detector can be displayed in the panel.) The number of values displayed in the panel depends only on the size that you can or want to allow to this applet.

  * This applet's tooltip can display sensor values ​​and limits, including those that are not displayed in the panel. The number of sensors you can display in the tooltip depends only on the height of your desktop.

  * All values are displayed in your local format.

  * Many display options are present in the settings.

  * The menu of this applet gives you direct access to the different kinds of settings, and contains useful shortcuts.

  * Avoid wasted processor time and memory leaks.

## Dependencies

This applet needs three packages:

  * [_lm-sensors_][lmsensors] to get the sensor values.
  * _xsensors_ to display these values in an independent graphical interface.
  * _fonts-symbola_ that contains some symbols used by this applet.


_**Sensors@claudiux** helps you to install these packages, if any._

## Install

### From Cinnamon Settings (recommended)
Just go to `System Settings > Applets` then

  1. In the just opened window, in Download tab, search this applet with the keyword **Sensors** and download it.
  2. Go to the _Manage_ tab of the same window, click on this applet then add it to Cinnamon.
  3. Open the settings of this applet and configure it as you want.

### From the Cinnamon Spices website
[Download the package][download] containing the latest version of this applet and extract the contents into `~/.local/share/cinnamon/applets`. Then go to `System Settings > Applets` and run the 2-3 steps above.

## Settings

There are five tabs in settings:

  * General
  * Temperature
  * Fan
  * Voltage
  * Intrusion

All these tabs are directly accessible from the menu of this applet.

## FAQ

### How to display the temperature of each of my disks?

#### Internal disks
Try to load the __drivetemp__ module:

  sudo modprobe drivetemp

If that give you a valid result running _sensors_, add __drivetemp__ into the list of modules to load at startup of your computer:

  echo "drivetemp" | sudo tee -a /etc/modules

#### External disks (on USB port)
  echo "%sudo ALL = NOPASSWD: /usr/sbin/smartctl" | sudo tee /etc/sudoers.d/smartctl

Then log out and log in your session.

### My PC has several temperature sensors and their values ​​are different. Why and which one to choose?

Example:

  * CPUTIN = CPU Temperature Index
  * AUXTIN = Auxiliary Temperature Index
  * SYSTIN = System Temperature Index

AUXTIN is the Power Supply temperature sensor (if there is one) while SYSTIN relates to Motherboard.

CPUTIN and CoreTemp are different. The temperatures they indicate are not from the same sensor. CoreTemp is the sensor on the processor while CPUTIN is the motherboard CPU temp sensor.

Coretemp gives the real temperature of each processor core (Core 0, Core 1, ...) and the real global temperature of the processor in Package.

There is a part of the `sensors` command output:

```
Package id 0:  +44.0°C  (high = +69.0°C, crit = +75.0°C)
Core 0:        +43.0°C  (high = +69.0°C, crit = +75.0°C)
Core 1:        +42.0°C  (high = +69.0°C, crit = +75.0°C)
Core 2:        +40.0°C  (high = +69.0°C, crit = +75.0°C)
Core 3:        +40.0°C  (high = +69.0°C, crit = +75.0°C)
[...]
CPUTIN:         +49.0°C  (high = +80.0°C, hyst = +75.0°C)
                         (crit low = +127.0°C, crit = +127.0°C)
```

The CPUTIN value can be "polluted" by the temperature of the motherboard (SYSTIN).

So, in this case, choose the _Package id 0_ value to display the temperature of the CPU.

### In settings, no sensor appears in certain tabs.

There are different reasons:

  1. The kernel modules driving these sensors are not started. Beware of too recent hardware / motherboard.
  2. The module is successfully started but it returns a zero value and you have checked the _Show only strictly positive values_ box. Example: Your computer is fanless, so no fan is present to send data to the fan sensor.
  3. Your sensor is wrong or not connected.
  4. Your `/etc/sensors3.conf` file (or any .conf file in `/etc/sensors.d`) must be configured for your chip. Search if a [configuration file][lmsensorsconfigs] already exists. Once config file is installed, reboot the computer.

### Some values seem to be wrong

Your `/etc/sensors3.conf` file must be configured for your chip. Search if a [configuration file][lmsensorsconfigs] already exists.

### My computer seems to have very few sensors

Try the `sensors-detect` command with root rights (`sudo sensors-detect`). See `man sensors-detect` for more information.

If you have specific hardware, try to put into the `/etc/sensors.d/` folder (with root rights) at least one of these [.conf files][lmsensorsconfigs].

### How to report an issue or make a feature request?

  1. Click on the "Issues" button at the top of this page and open a "New issue".
  2. Start the title with: **Sensors@claudiux:** . This title must contain a very short description of the issue (or feature request).
  3. Mention me in the text: @claudiux.
  4. Indicate the version numbers of Cinnamon (command: `cinnamon --version` in a terminal), of sensors (command: `sensors -v` in a terminal) and of this applet (visible by opening its menu).
  5. Open the General tab of settings of this applet, click on the button "Example of sensor values from this computer", copy all the content of the just opened window and paste it between two triple-backquotes in the text of the issue.
  6. Open a terminal and execute the command: `sensors -j`. (If it does not work, try `sensors -u`.) Copy/paste the output in the text of the issue, also between triple-backquotes.
  7. Describe your problem in as much detail as possible. Thank you.

### Since I installed this applet, my ~/.xsession-errors file is flooded by 'posix_spawn' messages

These messages are simple warnings and appear or not depending on the version of GLib used by the Linux distribution. Thus, they appear in Linux Mint 20, but not in Linux Mint 19.3.

To avoid this file flooding, please install the [Sanitize ~/.xsession-errors][sanitize] Cinnamon extension.

## Contributing

Any contribution or translation is welcome!

### Available translations and their authors

| Translation | Code | Author (Github account) |
| ---:|:---:|  --- |
| Czech | cs | Bohuslav Kotál ([@Fotobob1](https://github.com/Fotobob1)) |
| Danish | da | Alan Mortensen ([@Alan01](https://github.com/Alan01)) |
| Dutch | nl | Jurien ([@French77](https://github.com/French77)) |
| French | fr | claudiux ([@claudiux][claudiux]) |
| Spanish | es | claudiux ([@claudiux][claudiux]) |
| Turkish | tr | Serkan Önder ([@serkan-maker](https://github.com/serkan-maker))


_Thank you very much to all of these translators!_


## Thank the author

If you think this Cinnamon applet is useful, then please take the time to log in with your Github account and click on the star at the top of this page. It really encourages me!

Claudiux ([@claudiux][claudiux])


[sanitize]: https://cinnamon-spices.linuxmint.com/extensions/view/87
[claudiux]: https://github.com/claudiux
[lmsensors]: https://github.com/lm-sensors/lm-sensors
[lmsensorsconfigs]: https://github.com/lm-sensors/lm-sensors/tree/master/configs
[spicesupdate]: https://cinnamon-spices.linuxmint.com/applets/view/309
[download]: https://cinnamon-spices.linuxmint.com/files/applets/Sensors@claudiux.zip?0c1b4606-e68e-4d11-ae4e-c1373acd749b
