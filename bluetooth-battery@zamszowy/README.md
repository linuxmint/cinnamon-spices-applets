# Bluetooth (and other) devices battery monitor

This applet monitors (through UPowerGlib) battery levels of mice, keyboards, headphones and other connected devices.  
It displays icon and text with battery level information, and for mice, keyboards and headphones, battery icon contains also mouse/keyboard/headphones symbol.  
Device with lowest battery is displayed in panel. When clicked, it displays list with all monitored devices.

## Settings
You can disable monitoring (it also disables blacklist configuration) of keyboards, mice, headphones or all other devices.  
You can also choose to display in applet icon only, text only or icon and text.

## Blacklist
You can blacklist any device detected by the applet.  
All detected devices are automatically added to blacklist (common devices like mice and keyboards are added just as comments, other are disabled right away).

## Bluetooth Headphones
Currently (with bluetoothd v5.64) reporting battery percentage for bluetooth headphones can be enabled by starting bluetoothd with experimental features,
but bear in mind that enabling it can cause some issues, like mice not connecting automatically (see https://github.com/bluez/bluez/issues/236 for details).  
This could be somehow circumvented by enabling only one experimental UUID, but it's still not guaranteed to be bug free - expect issues!

## Icons
Icons are based on [Papirus icon theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
