# Shadowsocks Switch
Shadowsocks Switch simplifies enabling and disabling Shadowsocks.

## Requirements
This applet acts as a wrapper around `ss-local` utility and therefore requires 
`shadowsocks-libev` to be present. Run `apt-get install shadowsocks-libev` to install 
it before using this applet.

## Rationale
Shadowsocks is a secure proxy that is made to bypass internet censorship, so the use 
case is a lot like we use VPN nowadays. While other VPN protocols have Network Manager 
plugins that add convenient GUI to quickly enable/disable the VPN connection, Shadowsocks 
doesn't have one.

I'm using Shadowsocks myself, so I wanted a simple and convenient UI to quickly 
enable/disable the Shadowsocks connection.

## How it works
Upon installation this applet adds an icon with a pop-up toggle in the system tray.

When you switch the proxy on, the applet does the following.

1. Reads and saves your current system proxy settings (proxy mode, SOCKS5 host and port).
2. Runs `ss-local -c <config>` in background (`<config>` defaults to 
   `/etc/shadowsocks-libev/config.json`).
3. Sets your system proxy mode to `Manual`, SOCKS5 host to `localhost` and SOCKS5 port 
   to the `local_port` value from `<config>`.

When you are done using Shadowsocks, you switch it off and the applet restores your 
previous system proxy settings and stops the proxy.

## Settings
The applet uses a Shadowsocks configuration file to discover the local proxy port. The 
default path to the configuration file is `/etc/shadowsocks-libev/config.json`, but 
you can point the applet to any other configuration file via applet settings (click on 
the cog icon in the Applets window).

## Credits
Shadowsocks tray icon is based on [Papirus Icon Theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
