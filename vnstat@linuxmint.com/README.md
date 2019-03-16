## What it does:

This applet keeps track of your Internet usage.

In some countries, ISPs limit the amount of data their customers can use. Passed a certain amount of bits downloaded/uploaded, you either get cut off, you pay more or your connection speed is reduced. The situation is even worse if you are using a mobile connection, especially when roaming.

## How it does it:

The vnstat daemon runs in the background and collects info about your Internet usage all the time the machine is running and maintains a data set from once it is initially activated.

The applet detects which device you're currently using, and simply exports a graph using vnstati. The latest version allows you to select the type of graph although for most users the default summary will be the most useful.

## What you need for it to work:

You need:

  * To install vnstat
  * To install vnstati
  * To have the vnstat daemon running
  * To have vnstat configured for the devices you are using.

Notes: In Linux Mint, you can simply run `apt install vnstati` and that will take care of everything for the built in devices. In other distributions it might depend on the way things are packaged but it's likely to be similar.

It is possible to add additional devices, for example a USB Mobile Internet stick. Running `man vnstat` will give some information on how to proceed but beware it is not trivial.


## Use on Distributions other than Mint:

  * The original versions assumed the NMClient and NetworkManager libraries are in use as is the case in Mint versions up to 18.3 and most other current distro versions.
  * Version 1.0.0 can also switch to the more recent NM library used on some recent distributions such as Fedora 27 and higher.
   * Version 1.0.1 and higher can only use the new NM libraries when Cinnamon 4.0 or higher is in use to avoid potential segfaults in Cinnamon 4.0. This should support all current Linux Distributions which support Cinnamon 4.0.
  * It is possible that you may have to set up vnstati on other distributions - running `man vnstat` will provide information on how to proceed if that is the case.
  * Feedback on your experiences on other distributions would be welcome.

### Support

The original author of this Applet was Clem. More recently it has been supported and extended by @pdcurtis who is now listed as the current author. He occasionally checks the comments on the [Cinnamon Spices Web Site](http://cinnamon-spices.linuxmint.com/applets/view/31), however that does not automatically notify him so if you want a rapid response please also alert him via the [Form at www.pcurtis.com](http://www.pcurtis.com/contact_form.htm?applets). On github, mentioning @pdcurtis in any conversation will cause it to be emailed to him.
.

