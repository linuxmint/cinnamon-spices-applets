# IP Indicator
IP indicator applet for Cinnamon desktop environment

Useful in case when often switching VPNs. It shows flag of country of your public IP or customized icon when matching ISP (Internet Service Provider) is found. After opening menu additionally IP, ISP and the country name are displayed. 

Some ISPs have not very human friendly name, therefore there is options to set ISP nickname, which will be shown instead.

# How it works

1. periodically check network interfaces with `ifconfig` command. When new VPN connection is established, usually new `tun0` interface is created. This options generates no network traffic, therefore it can be executed often.
2. periodically call free IP Services. Several IP services are defined, through which the applet cycles and figures out only public IP. As this method generates load on these services, it should not be used very frequent, therefore the interval is possible be set in minute interval.

When any technique recognizes that something has changed, then another request is sent to chosen IP service. Response provides detailed  information that is shown in the tooltip.

# Installation
Clone this repository to `.local/share/cinnamon/applets/`

For parsing ifconfig output, external shell script is used: `getNetworkInterfaces.sh`. Make sure that this script has set permissions to be executable! 
```
chmod 755 getNetworkInterfaces.sh
```

# Troubleshooting
1. Go to applet's configuration and set debug level to 2. 
2. Remove applet and add it again to the panel. 
3. Try to reproduce the issue. 
4. Open ticket on github and provide the logs from `.cinnamon/glass.log`.

# Sources
Flag icons used from http://www.famfamfam.com/lab/icons/flags/.

Following IP Services are called:
- https://api.ipify.org?format=json
- http://bot.whatismyipaddress.com/
- https://myexternalip.com/json
- https://icanhazip.com
- http://ipinfo.io/json
- http://ip-api.com/json - chosen service resolving ISP 

# Screenshots
IP: 

![ip](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/ipindicator%40matus.benko%40gmail.com/screenshot-ip.png)

Icon: 

![icon](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/ipindicator%40matus.benko%40gmail.com/screenshot-icon.png)

Icon and IP:

![iconIp](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/ipindicator%40matus.benko%40gmail.com/screenshot.png)

Tooltip:

![tooltip](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/ipindicator%40matus.benko%40gmail.com/screenshot-tooltip.png)

Settings:

![settings](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/ipindicator%40matus.benko%40gmail.com/screenshot-settings.png)

Custom ISP icon:

![isp](https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/ipindicator%40matus.benko%40gmail.com/screenshot-isp.png)

# Kudos

- Simon Brown - maintenance
- Erik Zetterberg - IP and icon mode suggestion
- Mirko Hanker - help with the flags
