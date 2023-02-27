# Battery Applet with Monitoring and Shutdown (BAMS)

## Summary

This is a simple applet I have written for my laptop because I have recently had a couple of times where I have missed the notifications about low battery and have had shutdowns losing data and potentially reducing battery capacity through a complete discharge. The applet draws on my code for the NUMA (Network Utilisation Monitoring and Alert) Applet so much of the code is well developed and tested.

This applet allows one to set a level at which the machine starts to shutdown (suspend to memory as currently set up) with plenty of warning - the shutdown level is 2/3 of the initial alert level which can be adjusted between 10% and 40%.

## Rationale

The current Settings and Power Applet only allow limited choices of handling low battery state - in fact latest version of Cinnamon seems to have lost the setting to specify the action when the battery is critical and there seems to be no easy way to set the 'critical shutdown' level in Mint 18 Sarah/Cinnamon 3.0 and higher. This applet complements the existing power facilities by allowing much more and easier control of automatic shutdown and recovery thereby considerably reducing the chances of both data lose or shortening battery life through accidental total discharge.

## Status

Fully supported by Author, under continuing development and in continuous use on several of his machines.

## Features

The applet normally shows the percentage charge on a coloured background which is:

  * Green when above the alert level (set currently to 1.5 times the 'shutdown' level.)
  * Green has Red Border when discharging.
  * Orange between the warning and shutdown level
  * Red and flashing at and below the Shutdown level (even when charging).

   When the battery is Discharging the warning and shutdown regions have a much longer flashing message in the applet which is difficult to miss.

  * When the Alert level is reached a modal alert is put up which can not be missed as no input can be made until it is cleared and short fixed audible alert is also given. For Cinnamon versions earlier than 2.6 an critical alert is used instead as modal alerts are not available. The default alert sound is short and high pitched.
  * The audible alert sound file can be specified in the Applet Settings rather than use a preset system file when used with Cinnamon 3.2 and higher. Mine lasts for 30 seconds and can be heard throughout the house so is not ideal for libraries - thanks to Brandon at http://soundbible.com/1911-Mandatory-Evacuation.html and used under Attribution 3.0 Licence. A brief warning is displayed whenever the applet starts if user specified files are in use te remind users of potential consequences of long loud files. The warning can be inhibited but this is not recommended.
    * **note1:** The file must be an .oga with mime type audio/x-vorbis+ogg - the mime type is crucial to it being recognised. You can convert any audio file (.mp3, .wav, etc) into this format by using any number of different free on-line conversion tools. When doing the conversion, you must be sure to select Ogg(Vorbis) as the Codec to be used during the conversion process. If your conversion was successful, it will be possible to preview the sound with the arrow button attached to the BAMS file selection dialog box.
    * **note2:** There cannot be any spaces in the filename.
  * When the Shutdown level is reached an alert box is put up with options of an immediate suspend or cancel - if nothing is done it suspends 30 seconds latter. If cancelled (or the machine is turned back on without the battery being on charge) the alert and shutdown sequence is restarted after the battery has dropped another 1%. The alert box is accompanied by an audible alert which can be specified in Settings with Cinnamon 3.2 and higher. This should be a short sound just to alert one if using the machine as it cannot be cancelled and could continue when the machine is reactivated.

The alert level can be set to between 10% and 40% of full by a slider on the left click menu or in the configuration screen. The refresh rate can also be set in the configuration screen.

The intention is to allow the possibility of leaving suspend with enough battery to close programs and shut down after powering up from suspend without a charger after an accidental unattended suspend. It is suggested that the 'shutdown level' is set to about 10% to allow time. Do not forget that the battery still drains, although slowly, during suspend.

Version 1.3.0 introduced support for vertical panels and has extra display modes including an optional icon showing battery state. The modes, which are selected in the Configure screen, are:

  * Classic - Battery Percentage with an extended message in the panel as above (only for horizontal panels)
  * Classic Plus - Classic with addition of a Battery Icon (only for horizontal panels)
  * Compact - Battery Percentage without an extended message, just the background changes (suitable for vertical panels)
  * Compact Plus - Compact with addition of Battery Icon (suitable for vertical panels)
  * Battery Icon Only - retains the coloured background showing status (suitable for vertical panels)

If a Classic mode is used on a vertical panel the extended message is not shown which allows it to be used in a vertical panel in the default 'Classic' configuration.

The right click menu gives access to some useful utilities as well as the change log and this help file.

Many laptops do not implement a suspend well. The suspend which is in use is a Suspend to Memory which is better supported than Hibernate (suspend to disk) but it does use power a little power when in that mode so it is still possible to loose work if the level is set too low or it is left too long. It is sensible to make sure the laptop does suspend reliably before trusting this applet to save work. The code for suspending is different in Mint 18 and higher to Mint 17.3 and earlier versions. The script calls both methods which should not cause problems but you can comment out the redundant one if you want in suspendScript.

## Translations and other Contributions

The internal changes required in the applet to allow translations are implemented and several translations are available. Translations are usually contributed by people fluent in the language and will be very much appreciated. Users please note I will rarely be able to take responsibility for the accuracy of translations!

Although comments and suggestions are always welcome any contributions which are contemplated must follow discussion. Changes can have many unintended consequences and the integrity of the applet is paramount. Unsolicited Pull Requests will never be authorised other than for urgent and critical bug fixes from the Cinnamon Team.

## Requirements:

Cinnamon Version 2.2 or higher which is available for all the Mint versions which are still supported - currently back to Mint 17.0 LTS. Cinnamon 2.6 or higher is required to support Modal Alerts. The latest versions have been tested up to Cinnamon 5.6.

For full facilities including notifications and audible alerts the ```zenity sox``` and ```libsox-fmt-mp3``` libraries must be installed. They can be installed wih the Synaptic Package Manager or using the following terminal command:

        sudo apt-get install zenity sox libsox-fmt-mp3

## Manual Installation:

   * Download from the Spices Web Site
   * Unzip and extract folder ```batterymonitor@pdcurtis``` to ```~/.local/share/cinnamon/applets/```
   * Install the additional programs required.
   * Enable the applet in System Settings -> Applets
   * You can also access the Settings Screen from System Settings -> Applets or from the Applets Context menu
