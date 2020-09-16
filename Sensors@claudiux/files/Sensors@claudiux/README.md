# Sensors@claudiux

This applet displays and monitors the values ​​of many computer sensors concerning **temperatures** (from CPU, GPU, power supply), **fan speed**, **voltages**, **intrusions**.

It notifies you with color changes when a value reaches or exceeds its limit.

Any suggestion to improve Sensors@claudiux is welcome.

## Benefits

  * Allows simultaneous display and monitoring of values ​​from multiple sensors, including sensors of the same type. For example: 2 temperatures, 3 voltages, 1 fan speed, 1 intrusion detector can be displayed in the panel. The number of values displayed in the panel depends only on the size that you can (or want) to allow this applet.

  * This applet's tooltip can display sensor values ​​and limits, including those that are not displayed in the panel. The number of sensors you can display in the tooltip depends only on the height of your desktop.

  * All values are displayed in your local format.

  * Many display options are present in the settings.

  * The menu of this applet gives you direct access to the different kinds of settings, and contains useful shortcuts.

## Dependencies

This applet needs three packages:

  * _sensors_ to get the sensor values.
  * _xsensors_ to display these values in an independent graphical interface.
  * _fonts-symbola_ that contains some symbols used by this applet.


_**Sensors@claudiux** helps you to install these packages, if any._

## Settings

There are five tabs in settings:

  * General
  * Temperature sensors
  * Fan sensors
  * Voltage sensors
  * Intrusion sensors

All these tabs are directly accessible from the menu of this applet.


## FAQ

### My PC has several temperature sensors and their values ​​are different. Why and which one to choose?

Example:

CPUTIN = CPU Temperature Index
AUXTIN = Auxiliary Temperature Index
SYSTIN = System Temperature Index

AUXTIN is the power supply temp sensor (if there is one) while SYSTIN relates to Motherboard.

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
  4. Your `/etc/sensors3.conf` file must be configured for your chip. Search on the Net if a configuration already exists.

### Some values seem to be wrong

Your `/etc/sensors3.conf` file must be configured for your chip. Search on the Net if a configuration already exists.

### How to report an issue or make a feature request?

  1. Click on the "Issues" button at the top of this page and open a "New issue".
  2. Start the title with: **SanitizeXsessionErrors@claudiux:** . This title must contain a very short description of the issue (or feature request).
  3. Mention me in the text: @claudiux.
  4. Indicate the version numbers of Cinnamon (command: `cinnamon --version` in a terminal), of sensors (command: `sensors -v` in a terminal) and of this applet (visible by opening its menu).
  5. Open the General tab of settings of this applet, click on the button "Example of sensor values from this computer", copy all the content of the just opened window and paste it between two triple-backquotes in the text of the issue.
  6. Open a terminal and execute the command: `sensors -j`. (If it does not work, try `sensors -u`.) Copy/paste the output in the text of the issue, also between triple-backquotes.
  7. Describe your problem in as much detail as possible. Thank you.

### My ~/.xsession-errors file is flooded by 'posix_spawn' messages

Please install the [Sanitize ~/.xsession-errors][sanitize] Cinnamon extension.

## Contributing

Any contribution or translation is welcome!

## Thank the author

If you think this Cinnamon applet is useful then please take the time to log in with your Github account and click on the star at the top of this page. It really encourages me!

Claudiux ([@claudiux][claudiux])


[sanitize]: https://cinnamon-spices.linuxmint.com/extensions/view/87
[claudiux]: https://github.com/claudiux
