GnomeTurboNoteExtension
=======================

# **[Instalation]** #

Install dependences

```
#!shell
sudo apt-get install python-qt4
sudo apt-get install libwmf-bin
sudo apt-get install python-notify2
sudo apt-get install python-qt4-dbus-dbg
sudo apt-get install sqlite3
sudo apt-get install zip
sudo apt-get install libgnome2-bin
```

* Need LibreOffice (default)
install svn  and checkout this branch in your /usr/share/cinnamon/applets

* Set permissions for your user like this

```
#!shell
sudo chmod 777 /usr/share/cinnamon/applets/turbonote@iksws.com.br/
```


* Configure file *turbonote-adds/config_note.py* (only if you use white themes) check variable icon color use *_b* to white themes  and image_color_title_revert for themes with top with other dark color
*

* Enjoy! enable in Tweak Tool 
* Start the server  in menu option 


IF not show icon on tray or up server check all confs links are corrects!


***[TIPS]***

if you use fedora 
You need install EOG package for show images
In fedora check config_note.py change eth0 for em1
```
#!shell
sudo apt-get install eog-plugins
```
Remember

You need have a last version  libre office the app use office-converter in image files


### IMPLEMENTS LIST ###

**OK** = Implemented

**1/2** = 50% Implemented

* [**OK**] Send Note
* [**OK**] Receive Note
* [**OK**] Contact List and Manager
* [**OK**] History List[Receive] and Manager
* [**OK**] History List[Send] and Manager
* [**OK**] List all Attacheds
* [**OK**] Note Options (Stay on top and Title)
* [**NO**] Note Style Confs (All colors)
* [**OK**] Receive Images
* [**OK**] Receive Attacheds
* [**OK**] Send and responde notes with the Width and Heigth equals a window size
* [**1/2**] Send Images (Only to linux2linux working at now)

For send images (only linux to linux) use the icon take a picture and save in dir TMP_SEND the app get image in this dir and send with the  message.
For windows you need take a picture and save anywhere use attached button chouse a picture and attach it.

* [**OK**] Send Attacheds
* [**1/2**] ShortCut Commands
* [**OK**] Re-Send Note

Developer mail: ikswss@gmail.com


***SHORT CUTs COMMANDs***

In the box press CTRL + ENTER to show contact list, double click for send or CTRL + ENTER for send,  you can select multiple contacts and using the button send for send to multiples contacts.

You can reply message to the contact who sent only CTRL+R in the box.

***MENU***

You can manage your contacts, for add you need only the enter host name and press ENTER or click ADD button and  the app will check if name existe in network.

You can manager messages in history[R], you can sent again message in history[S] double click in message for sent.
You can manager your images and attacheds 
