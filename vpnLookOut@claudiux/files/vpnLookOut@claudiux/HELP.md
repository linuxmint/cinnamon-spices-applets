# VPN LookOut - Help

## About VPN

### What is a "VPN"?

A _Virtual Private Network_ (VPN) is a way to create a secure and encrypted link between your computer and a remote server.

All requests from your computer seem to come from this remote server, which may be in a foreign country.

It's a good way to do things that are not allowed in (or from) your country, but are allowed in another country.

VPN increases Freedom.

### How to link my computer to a VPN ?

#### Subscribe to a VPN provider

Search for "VPN" in a search engine and thousands of proposals are displayed.

Preferably choose a provider that offers you an _openvpn_ VPN link.

Take the time to compare multiple providers.

#### Install requisite packages

    apt install openvpn network-manager-openvpn network-manager-openvpn-gnome

#### Network Settings

Download the config file given by your provider.

**Rename it if its name contains spaces.** Delete all spaces or replace them with another character.

Open Cinnamon's Network Settings, click the "+" under the list of connections. An _Add VPN_ window appears. Choose _Import from file..._ and select this config file.

Fill in the login and password of your VPN account, if any, then click on _Add_.

#### Try to connect to the VPN link

Use the Network applet (look at the systray of your panel) or the Network Settings.

If it fails, please read the FAQ of your VPN provider.



## About the VPN LookOut Applet

### Features
This VPN LookOut applet is usefull and highly configurable.

It allows you to:
  * connect to one of your VPN servers,
  * change your VPN server if you have more than one,
  * disconnect from the current VPN server.

It monitors the status of the VPN link. The icon of this applet becomes:
  * Green when the link is up.
  * Red when the link is down.
  * Grey when the link status is undefined.

When the VPN link is interrupted:
  * An audible alert can be emitted,
  * All apps that you explicitly listed are closed.
  * This applet may try to reactivate the VPN link.

When the VPN link becomes active again:
  * All apps that you explicitly listed are restarted.

You can set a keyboard shortcut to connect to / disconnect from the VPN. The default is: `<Super>v`.
A middle click on the applet icon has the same effect.

### Requirements:

For full facilities including help, notifications and audible alerts the `zenity`, `sox`, `libsox-fmt-mp3` and `xdg-utils` libraries must be installed. They can be installed wih the Synaptic Package Manager or using the following terminal command:
 * LinuxMint: `apt update && apt install zenity sox libsox-fmt-mp3 xdg-utils`
 * Fedora: `sudo dnf update && sudo dnf install zenity sox xdg-utils`
 * Archlinux: `sudo pacman -Syu zenity sox xdg-utils`

**Note that this applet helps you to install these dependencies, if any.**

### Preconizations:

#### Transfere the /tmp directory into memory (Useless for Arch)
It is recommended to transfere the /tmp directory into memory, for two reasons:
  * Make applet execution faster.
  * Reduce hard disk wear (especially if it's a SSD).

To do this, add this line at the end of the file /etc/fstab; then, restart the computer:
        tmpfs /tmp tmpfs defaults,size=500M 0 0
(Beware to put the final character 's' at the 'defaults' word. In the `size` parameter, 'M' is for MB, 'G' is for GB; be careful, the memory allocated for /tmp is no longer available for the rest.)

#### Install at least Transmission
You can install (or re-install) Transmission (torrent client):
        apt install transmission transmission-gtk



### Settings

There are 4 panels in the Settings window (accessible by right clicking on the applet icon), described above.

#### VPN-related Apps Manager panel

_Manage VPN-related Apps_: When checked, it allows this applet to manage the VPN-related applications you listed above. This list only appears when this checkbox is checked. Unchecking the checkbox does not destroy this list, but only disables the management of these applications.

_Managed Apps_: The line about Transmission (a torrent client installed by default) can be an example.
  * _Name_: What you want.
  * _Command_: The command to run the application, as you write in a terminal, without its path. For example: `transmission-gtk` and not `/usr/bin/transmission-gtk`.
  * _Restart_: If set to TRUE, this application restarts when the VPN link becomes active again.
  * _Shut down_: If set to TRUE, this application is stopped as soon as the VPN link is broken, but you can start this application while the VPN is idle.
  * _VPN Only_: If set to TRUE, this application is quickly stopped if it is started while the VPN is idle.

Some known commands (Linux Mint):
  * Transmission: `transmission-gtk`
  * qBittorrent: `qbittorrent`
  * Deluge: `deluge-gtk`


#### Notifications panel
_Display_:

  * _Refresh interval_: Time interval, in seconds, between two verifications of VPN link status. A low value increases security but causes more activity. Choose a value that is greater as your computer is slow.
  * _Type of Display_: Do you want an icon, on the panel, with or without text?


_Sound Alert_:

  * _Emit an audible alert when VPN shuts down_: If checked, a phone-outgoing-busy sound is emitted for 3 seconds when the VPN link becomes broken.
  * _Emit this audible alert when this Applet starts, if VPN is down_: If checked and, at the startup of Cinnamon, the VPN link is down, then the audible alert sounds.


#### VPN panel

**VPN**

_VPN Network Interface_: You should be able to leave this field empty. This applet will try to detect this.

_VPN Name_: This information is automatically changed when connecting to a VPN. It therefore contains the name of the last VPN to which you connected.

_Connect to VPN as this applet starts_: Useful if you want to be connected to your VPN at startup of Cinnamon, immediatly after you log in.

_Try to reconnect to VPN when it shuts down incidentally_: Useful if being connected to your VPN is paramount.

_Do not try to reconnect automatically if the VPN has been disconnected by the user_ : If, by this applet _only_, the user disconnects the VPN, then no automatic reconnection will be tried.

**Activity Logs**

_Log the VPN status changes and the VPN-related Apps status changes_: This option allows this applet to log the VPN status changes and the VPN-related applications status changes. You will can display the log file to make diagnostics.

_Lifetime (days)_: Lifetime of a record in the log file, in days. When this applet starts, then once a day, the too old records are deleted from the log file.

#### Keyboard shortcuts panel

You can set one or two keyboard shortcuts to connect / disconnect your VPN link. Default is `<Super>v`.

Middle clicking on the icon has the same effect.


### Translation

The vpnLookOut applet is designed to allow translations of messages (initially in English).

A vpnLookOut.pot template file is available in the `po/` directory, you can use it with software such as `poedit` to translate these messages.

Save your translation file into the same `po/` directory. To make it active, restart Cinnamon one or two times with <ctrl>-<alt>-<esc>.


### Issue Reporting and Feature Requests

To report an issue or request a feature, please go to [https://github.com/linuxmint/cinnamon-spices-applets/issues].

A github account is required.

Please, mention me with *@claudiux* _in your message_ and mention this applet with *vpnLookOut@claudiux* _in the title_.


## To encourage the author

If you like this applet, please write a message on this page [https://cinnamon-spices.linuxmint.com/applets/view/305], connecting you with your github (or G+ or FB) account.

You can also increase the score of this applet, clicking on the star at the top of this same page.

Many thanks.

Claudiux
