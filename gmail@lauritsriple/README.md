# cinnamon-gmail-applet
Should be working. Not completely finished. Only tested on arch linux.

## Needed Python libaries
keyring,keyrings-alt,feedparser,urlparser (I think this is installed by default):.
To install them you need pip for python3. Short install list:
```
sudo apt-get install pip3
sudo pip3 install feedparser
sudo pip3 install keyring
sudo pip3 install keyrings-alt
```
## Storage of username and password
Uses the system keyring service (gnome-keyring) to store and extract the password, so they are not stored in cleartext. You might have to install this.

## Gmail atom feed
Uses the gmail atom feed to get info from gmail. You might have to enable access for less secure apps in gmail. Test in your browser if you have access with one of these links. https://mail.google.com/mail/feed/atom or https://username:password@mail.google.com/mail/feed/atom

## Install from git
~~cd ~/.local/share/cinnamon/applets~~
~~git clone https://github.com/lauritsriple/cinnamon-gmail-applet.git gmail@lauritsriple~~
Merged to https://github.com/linuxmint/cinnamon-spices-applets/

## Install from spices
You can install this from spices. Just click availible applets (online) and serach for gmail. There is currently two applets with almost the same name so make sure you choose the one which has gmail@lauritsriple. I tried to get the other one to work, but i couldn't and i didn't like that it stored password in plain text.

## TODO
- [X] Add notifications when receiving new mail
- [X] Lit panel icon on new mail
- [ ] Move atom feedparser to pure js
- [ ] Move credential storage to pure js
- [ ] Configure storage of passord in settings-schema.json to hide password while typing
