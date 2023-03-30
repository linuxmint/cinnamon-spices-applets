# VPN-Sentinel

## Summary

This **VPN-Sentinel@claudiux** applet aims to replace the [VPN Look-Out applet](https://cinnamon-spices.linuxmint.com/applets/view/305) which I am also the author.

This is a simple applet that I wrote because I often saw too late that my VPN (_Virtual Private Network_) was shut down.

This applet shows the state of the VPN (connected or disconnected) using colored icons. It can be used on horizontal or vertical panel.

But also, it can:

  * show VPN server country flag,

  * try to restart the VPN link when it shuts down incidentally,

  * close the VPN-related apps (like Transmission, qBittorrent, Deluge...) when your VPN shuts down, and restart them when your VPN link becomes active again,

  * quickly close a VPN-related app if it is started when the VPN is idle.

  * bypass VPN for domains specified by user.

## VPN types supported

  * OpenVPN (IPv4 and IPv6)
  * PPTP/L2TP
  * IPsec
  * WireGuard©

Please look at your VPN provider documentation to configure your connection with NetworkManager.

This applet uses nmcli (NetworkManager client) to start and stop connections. So if your connection doesn't work with NetworkManager, it won't work with this applet.

## Features
The VPN Look-Out Applet normally shows an icon that changes color depending on the state of the VPN connection. You can modify these colors. By default these are:

  * Green: the VPN is connected.
  * Red: the VPN is disconnected.
  * Grey: waiting for VPN status (only when the applet starts, for a few seconds, or if it is misconfigured).

When hovering over or click on the icon, are displayed:

  * the status of the VPN,
  * the name of the connection,
  * the network interface used,
  * the time the VPN was connected.

 For example:
```
  VPN: Copenhagen (IPv6)
  Device: enp2s0
  Since: 11:09:02
```

The most important settings are accessible by the menu (clicking on applet icon) ; they are shown in bold in the list below. For access to all of them, use the _Configure..._ option in the Right Click Menu.


## WireGuard© (optional)

To use Wireguard© with VPN-Sentinel, you must have:

  * NetworkManager and nmcli (version >= 1.16) - Check it with the command: `nmcli --version`
  * a VPN-provider that offers Wireguard connections
  * a private key, a public key (optionally a pre-shared key) and various other data given by this provider (ip address, server url and port...)
  * at least one `.conf` file that looks like:

```
[Interface]
PrivateKey = YOUR_PRIVATE_KEY
Address = YOUR_IP_ADDRESS
DNS = 8.8.8.8

[Peer]
PublicKey = YOUR_PUBLIC_KEY
Endpoint = SERVER_URL:PORT
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 15
```

Create in your home directory a directory named `WIREGUARD` and its subdirectory `wireguard-configs`:

`mkdir -p ~/WIREGUARD/wireguard-configs`

### Install Wireguard
On Linux Mint:  `apt install wireguard wireguard-tools openresolv`

Or on [other distros](https://www.wireguard.com/install/#installation).

### Create your private and public keys

Use the following commands:

`cd ~/WIREGUARD`

`wg genkey | tee privatekey | wg pubkey > publickey`

`chown 600 privatekey publickey`


To know your keys:

`cat publickey`

`cat privatekey`

Enter your public key (and only this one!) in your account on your Wireguard service provider's website.

**Your private key is...private! Only you should own it; your provider does not need it.**

### Complete your config files

Your provider gave you at least one configuration file with the extension `.conf`.

Put all these `.conf` files into `~/WIREGUARD/wireguard-configs`. No file name should contain spaces. The file name (before .conf) must not contain more than **15** characters.

In the directory `~/WIREGUARD/`, create a bash script `modify-conf.sh` like this:

```#!/bin/sh

PUBLICKEY="here your public key"

PRIVATEKEY="here your private key"

IPADDRESS="here the IP of the Wireguard server"

for f in $(ls -1A wireguard-configs/*.conf); do {

  echo "\n\n\tProcessing $f"

  chmod 600 $f

  sed "s/YOUR_PRIVATE_KEY/${PRIVATEKEY}/" $f > $f.temp

  sed "s/YOUR_IP_ADDRESS/${IPADDRESS}/" $f.temp > $f.temp2

  sed "/PresharedKey.*/d" $f.temp2 > $f

  rm -f $f.temp*

}; done
```

Make this script executable: `chmod +x modify-conf.sh`



N.B.

  * If your provider gave you a *preshared key*, add a line `PRESHAREDKEY="..."` before *for* and replace the last line beginning by *sed* by this one: `sed "s/YOUR_PRESHARED_KEY/${PRESHAREDKEY}/" $f.temp2 > $f`
  * **Adapt the content of this script** to that of your configuration files, replacing *YOUR_PRIVATE_KEY* etc with the words you find there.
  * If you only have a few configuration files, don't complicate your life with a script, but rather use the good old copy/paste.

### Using these .conf files

Create in the ~/WIREGUARD/ directory this executable script named _installall_ containing:

```#!/bin/bash
configs="AuSydney.conf|Au-Sydney(W) BrRiodeJaneiro.conf|Br-RiodeJan(W) CaEast.conf|Ca-East(W)"

_wgpath="$HOME/WIREGUARD/wireguard-configs"

for c in $configs
do
  IFS='|'
  set -- $c
  echo "Importing ${wgpath}/$1 ... "
  sudo nmcli connection import type wireguard file "${wgpath}/$1"
  echo "Renaming ${1%%.conf} as $2 ..."
  nmcli connection modify "${1%%.conf}" connection.id "$2"
  nmcli connection modify "$2" connection.autoconnect no
  nmcli connection modify "$2" connection.interface-name "$2"
  nmcli connection down "$2"
done
```

The _configs_ and _wgpath_ lines must be adapted to your own configuration.

_configs_ is a string where each space separates 2 connections. Each connection is defined by a .conf file and a name separated by the pipe character (|). Do not use spaces in names!

Once it is ready, execute this script.
