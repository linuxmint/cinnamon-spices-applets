A Cinnamon Applet for interacting with the various functions provided by KDE Connect.

## Requirements

- KDE Connect
- python3 (Should be installed already, if you're using cinnamon)

## Installation

Download and extract the files in the "files" folder to ~/.local/share/cinnamon/applets/.

## Usage

The Applet will display all paired and reachable devices and a sub menu for each one, which contains menu items for all the different features supported for the device. The features available for each device depend on it's supported and enabled Plugins in KDE Connect.
The menu items in the sub menu are grouped by "Info" modules, that mainly show information and "Action" modules that mainly execute some action when clicked.

## Compatibility

### KDE Connect

- **1.3**: Fully Supported; Not fully tested
- **1.4**: Fully Supported; Fully tested
- **21.12.3**: Fully Supported; Fully tested

NOTE: _Versions between these versions or older versions are likely to work but are not tested at all and there are no workarounds for these_

### Cinnamon

The Applet is tested with Cinnamon versions **> 5.2.7**, but should work on the newest version and could very well work on older versions.

### Notes

This Applet is inspired by the KDE Connect Control Center Applet by [Severga](https://github.com/Severga).


**If you find any bugs, please report them [here](https://github.com/linuxmint/cinnamon-spices-applets)**
