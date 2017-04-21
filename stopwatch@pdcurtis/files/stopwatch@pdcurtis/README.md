# Stopwatch Applet

## Summary

This is a very simple to use Stopwatch Applet which can have multiple instances in the panel. In its basic form it is controled completely by clicking the Applet - the first click starts it and it displays an increasing time, the second click pauses it and a third click resets it ready for the next time. The display starts with minutes and seconds and maintains a constant width, for example two minutes and 7 seconds is 02:07 to avoid jitter. If the time exceeds one hour it goes to 01:02:03, over a day and the days are displayed in the tooltip. To aid knowing the status at a glance it is grey when Ready,  green when Running and orange when Paused and the tooltip always displays the name of the instance, the status, time and what the next click does. 

## Rationale

It is useful to have a very simple timer quickly and permanently available in the panel, in particular if you are operating on internet connections where you are paying by the minute such as the satellite links I sometimes use. it is complementary to the The Network Usage Monitor Applet (NUMA) enables one to continuously display the speed and data usage on a selected interface when charges are for data usage. There are of course many other uses. 


## Features:
 
**The Settings Screen** can be reached from the right click menu as well as System Settings -> Applets. It enables you to:

   * Set the refresh interval - use a slow refresh if you have multiple active counters and/or a slow machine - the default is every two seconds, one second is more pleasing as t gives a continuos count.
   * Provide a meaningful title for the counter which is displayed in the first part of the tooltip - useful for identification if you have multiple instances of counters - default is Stopwatch.
   * Change the mode from the default sequence on clicking of 'start -> pause -> reset' to 'start -> pause -> continue -> pause -> continue etc'. In this continuous mode mode one needs the Right Click (Context) Menu to reset the counter.

**The Right Click (Context)** menu has options to:

  * Start the counter - only for completeness
  * Pause the counter - only for completeness 
  * Reset the counter - required in 'continuous mode' 
  * Continue counting from the count before pausing - as per the continuous mode. 
  * Continue counting as if it had not been interupted - mainly useful if you have clicked and paused by mistake! 
  * Open the Settings Screen from within the Applet 
  * Expand a drop down Housekeeping and System menu which also allows:
  
     - Viewing the Version and Change log 
     - Opening the Help file
     - Opening the Gnome System Monitor - this allows one, for example, to check the processor overheads in running multiple instances at high refresh rates on a low powered machine.

And that is about it - the help file is hopefully redundant as there is always full information when you hover over options on the Settings screen or the Applet itself. 

There is one additional attribute. The applet was not only intended to be useful in its own right but is also intended to provides a 'tutorial' framework for other more complex applets with many sections of code reusable and fully commented. One useful example is that it provides a sample Settings Screen and a 'standard' right click (context) menu which opens the Settings Screen and a Housekeeping submenu accessing help and a version/update files (which live in the applet folder). It also shows how to run the gnome system monitor program in case you want to find out how much machine power this applet is using at various update rates. Items with a ++ in the comment are not specific to this applet and may be useful for re-use. 

## Additional Notes: 

  * If you run over a day the days are only shown in the tooltip and the Applet has a red background to warn you rather than extend the size of the Applet. 
  * This Help file can be edited to include your own notes but may be overwritten if a new version is loaded. 

## Manual Installation:

   * Download from Cinnamon Spices
   * Unzip and extract folder stopwatch@pdcurtis to ~/.local/share/cinnamon/applets/
   * Enable the applet in Cinnamon Settings -> Applets
   * You can also access the Settings Screen from Cinnamon Settings -> Applets
