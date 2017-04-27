## What it does:

This applet keeps track of your Internet usage.

In some countries, ISPs limit the amount of data their customers can use. Passed a certain amount of bits downloaded/uploaded, you either get cut off, you pay more or your connection speed is reduced. The situation is even worse if you are using a mobile connection, especially when roaming.

## How it does it:

The vnstat daemon runs in the background and collects info about your Internet usage.

The applet detects which device you're currently using, and simply exports a graph using vnstati.

## What you need for it to work:

You need:
* To install vnstat
* To install vnstati
* To have the vnstat daemon running
* To have vnstat configured for the devices you are using.

Notes: In Linux Mint, you can simply run `apt install vnstati` and that will take care of everything for the built in devices. In other distributions it might depend on the way things are packaged but it's likely to be similar.

It is possible to add additional devices, for example a USB Mobile Internet stick. Running `man vnstat` will give some information on how to proceed but beware it is not trivial.

## You're not alone:

If you like this applet, chances are you don't like your ISP :) Don't worry, you're not alone... feel free to name and shame your ISP and the limits you're restricted to in the comments section. It won't change anything of course, but you never know.. it might make you feel better :)
