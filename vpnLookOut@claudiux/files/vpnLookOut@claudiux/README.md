# VPN Look-Out Applet

## Summary

This is a simple applet that I wrote because I often saw too late that my VPN (_Virtual Private Network_) was shut down.

This applet shows the state of the VPN (connected or disconnected) using colored icons. It can be used on horizontal or vertical panel.

But also, it can:
  * try to restart the VPN link when it shuts down incidentally,
  * close the VPN-related apps (like Transmission, qBittorrent, Deluge...) when your VPN shuts down, and restart them when your VPN link becomes active again,
  * quickly close a VPN-related app if it is started when the VPN is idle.

## Status

Fully supported by Author, under continuing development and in continuous use on several machines, running with **Linux Mint**, **Fedora** or **Archlinux**.

## Features

The VPN Look-Out Applet normally shows an icon that changes color depending on the state of the VPN connection :

  * Green: the VPN is connected.
  * Red: the VPN is disconnected.
  * Grey: waiting for VPN status (only when the applet starts, for a few seconds, or if it is misconfigured).

When hovering over or click on the icon, the status of the VPN is displayed with, between brackets, the name of the connection and the network interface used. By example:

  VPN: Connected (Amsterdam / tun0)

The most important settings are accessible by the menu (by left or right click on applet icon) ; they are shown in bold in the list below. For all of them, see Settings in the Right Click Menu.

Settings :
  * VPN Network Interface (default: tun0).
  * VPN Name (name of the connection, automatically filled in, you can change for other existing connection name).
  * Try (or don't try) to connect to VPN when this applet starts.
  * Try (or don't try) to reconnect to VPN when it shuts down incidentally.
  * Refresh Interval for Display (from 1 to 60 seconds).
  * Type of Display : Icon, with or without text 'VPN'.
  * Emit (or don't emit) a sound alert when VPN shuts down.
  * Emit (or don't emit) this sound alert when this Applet starts, if VPN is down.
  * Shut down (or not) properly Transmission as soon as VPN falls. (Cinnamon 2.8 to 3.6.)
  * Try (or don't try) to restart Transmission as soon as VPN restarts. (Cinnamon 2.8 to 3.6.)
  * Manage VPN-related Apps. (Cinnamon 3.8 and over.)
  * Log the status of the VPN link, and the status of the VPN-related Apps.

The left click menu also contains:
  * A button to connect to (or disconnect from) the last VPN used. This button appears only if the option "Try to reconnect to VPN when it shuts down incidentally" is unchecked.
  * A list of all VPN connections available. Click on one of them to change of VPN connection ; it disconnects from actual (if any) and connects to new.

A middle-click on the icon of this applet, or the keyboard shortcut <Super>v (which you can personalize), is a quick way to:
   * connect to the last VPN used if it is "off";
   * disconnect from the VPN if it is "on".

In the menu, there is an option to deactivate/activate vpnLookOut. (From Cinnamon 4.2.)

## Translations
The vpnLookOut applet is designed to allow translations of messages (initially in English). A vpnLookOut.pot template file is available, you can use it with software such as poedit to translate these messages.

Languages already available: English, French, Spanish, Italian, Danish, Swedish.

The installation of the available languages is done automatically.

Translations are usually provided by people who are fluent in the language.

**Any new translation will be welcome.**

Users, please note that I will not be able to take responsibility for the accuracy of translations that I would not have done myself!

## Contributions

While comments and suggestions are always welcome, any contributions considered should be discussed. Changes can have many unintended consequences and the integrity of the applet is paramount. Unsolicited pull requests will never be allowed with the exception of urgent and critical bug fixes from the Cinnamon team.

## Requirements:

For full facilities including notifications and audible alerts the ```zenity```, ```sox```, ```libsox-fmt-mp3``` and ```xdg-utils``` libraries must be installed. They can be installed wih the Synaptic Package Manager or using the following terminal command:
 * LinuxMint:
        apt update && apt install zenity sox libsox-fmt-mp3 xdg-utils
 * Fedora:
        sudo dnf update && sudo dnf install zenity sox xdg-utils
 * Archlinux:
        sudo pacman -Syu zenity sox xdg-utils

**Note that this applet helps you to install these dependencies, if any.**

## Preconizations:

### Transfere the /tmp directory into memory (Useless for Arch)
It is recommended to transfere the /tmp directory into memory, for two reasons:
  * Make applet execution faster.
  * Reduce hard disk wear (especially if it's a SSD).

To do this, add this line at the end of the file /etc/fstab; then, restart the computer:
        ```tmpfs /tmp tmpfs defaults,size=500M 0 0```
(Beware to put the final character 's' at the 'defaults' word. In the `size` parameter, 'M' is for MB, 'G' is for GB; be careful, the memory allocated for /tmp is no longer available for the rest.)

### Install at least Transmission
You can install (or re-install) Transmission (torrent client):
        ```apt install transmission transmission-gtk```


## Automatic Installation
Use the **Applets** menu in Cinnamon Settings, or **Add Applets to Panel** in the context menu (right-click) of your panel.

## Manual Installation:

   * Install the additional programs required.
   * Download the VPN Look-Out Applet from the Spices Web Site.
   * Unzip and extract folder ```vpnLookOut@claudiux``` to ```~/.local/share/cinnamon/applets/```
   * Enable the applet in System Settings -> Applets.
   * You can also access the Settings Screen from System Settings -> Applets, or from the Applets Context menu.
