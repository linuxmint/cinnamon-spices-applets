# Stackoverflow Questions Notifier Applet
A Linux Mint Cinnamon Applet that checks 
[Stackoverflow](http://stackoverflow.com/) 
site and shows a notification when a new question (with one or several tags) is 
posted 

The frequency timeout and the tags of interest can be set up

# Installation 
* Right click on your panel, click `Add applets to the panel`
* Click on `Get more online` tab
* Find `Stackoverflow Questions Notifier`, right click and `Mark for installation`
* Once installed `Add to panel`
* Right click on the applet icon, click `Configure`, 
  set the tags you're interested in and the frequency time, defaults values are:
  "`c`, `java`, `bash`, `javascript`" for tags and 5 minutes for time 

# Tested
Tested on Cinnamon 2.4.6, Linux Mint 17.1

# Change Log

### v 1.0.3
* Duplicated questions notification bug solved for good!

### v 1.0.2
* Minor improvements over duplicated question notifications bug

### v 1.0.1
* Minor bug fixes: The error messages weren't showing

### v 1.0.0
* Show popup notifications every n minutes with new questions posted under certain tags
* Let the user disabled/enabled notifications by clicking on the applet icon
* Notifications contain a link for the question 
* The applet configuration dialog lets the user set the list of tags (labels separated by `,`)
* If the maximum number of request to the API site is reached, the applet will block  
  itself until the service throttle time is restore again 

# About 

I'm a fan of [Stackoverflow](http://stackoverflow.com/), I like to help 
people around, to learn new stuff and to win some reputation points at the same time. 

I also spend a lot of time in my LinuxMint box, so I wrote this applet to
hunt for questions that are of interest without spending time refreshing the 
browser waiting for some of those questions to appear. 
