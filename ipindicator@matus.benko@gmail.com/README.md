# ip-indicator_mint
IP indicator applet for Cinnamon desktop environment

Useful in case when often switching VPNs. It shows flag of country of your public IP or customized icon when matching ISP (Internet Service Provider) is found. After opening menu additionally IP, ISP and the country name are visible. 

Some ISPs have not very human friendly name, therefore there is options to set ISP nickname, which will be shown instead.

# How it works
After the reading about the reasons why previous IP service has shut down, I realized that spamming GET requests every few seconds to get the GEO IP, is not the most network traffic friendly solution. Therefore in this new version I introduced 2 layers of recognizing, when the public IP gets changed:

1. periodically checking network interfaces via ifconfig command. When creating new VPN connection, usually new tun0 interface is created. This options generates no network traffic, therefore it can be repeated after X seconds.
2. periodically calling free IP Services. More IP services are defined, through which the applet cycles and figures out only public IP. As this method generates load on the servers, it should not be used as frequent, therefore interval could be set in minutes.

After any of these layers recognized, that something has changed, another request is fired to http://ip-api.com/json. In the answer is provided full information that we need: IP, ISP, Country and CountryCode.

# Installation
Clone this repository to `.local/share/cinnamon/applets/`

For parsing ifconfig output externall shell script is used: `getNetworkInterfaces.sh`. Make sure that this script has set permissions to be executable! 
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
- http://geoip.nekudo.com/api/
- http://ip-json.rhcloud.com/json
- http://ipinfo.io/json
- http://ip-api.com/json

# Screenshots
![screenshot](http://i.imgur.com/2wXSV1v.png)
![settings](http://i.imgur.com/a3MlXg7.png)

