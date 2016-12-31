# cinnamon-gmail-applet
Currently work in progress, but should be possible to use master at all times.

##Needed Python libaries
keyrings,keyrings-alt,feedparser,urlparser (I think this is installed by default):.
To install them you need pip for python3. Short install list:
```
sudo apt-get install pip3
sudo pip3 install feedparser
sudo pip3 install keyrings
sudo pip3 install keyrings-alt
```

## Install from git
```
cd ~/.local/share/cinnamon/applets
git clone https://github.com/lauritsriple/cinnamon-gmail-applet.git gmail@lauritsriple
```
## Install from spices
You can install this from spices. Just click availible applets (online) and serach for gmail. There is currently two applets with almost the same name so make sure you choose the one which has gmail@lauritsriple. I tried to get the other one to work, but i couldn't and i didn't like that it stored password in plain text.

## TODO
* Add notifications when receiving new mail
* Lit panel icon on new mail
