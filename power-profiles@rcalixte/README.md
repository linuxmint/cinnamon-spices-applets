POWER PROFILES
==============
An applet to modify the current system power profile as determined by
`power-profiles-daemon` (accessible via the command-line as `powerprofilesctl`
if installed correctly)

DESCRIPTION
-----------
This is an applet that will set the profile via the input menu or keyboard
shortcuts.

The following options are selectable from the applet menu (see the screenshot):
 * Power Saver
 * Balanced
 * Performance (if available)

There are two customizable keyboard shortcuts for switching profiles:
 * Previous profile
 * Next profile

There are also settings for customizing the operation of the keyboard
shortcuts:
 * Cycle through profiles when using keyboard shortcuts (Default: `false`)

 This will determine whether the keyboard shortcuts will cycle through the
 available system power profiles.
 _Example:_ The current profile is 'Power Saver' and the keyboard shortcut for
 'Previous profile' is entered. If this option is set to `false`, the profile
 will stay set at 'Power Saver' and if the option is set to `true`, the
 profile will change to 'Performance' if it is available or 'Balanced'
 otherwise.
 
 * On-screen display for keyboard shortcuts (Default: `true`)

 This will control whether there is an on-screen display (see the screenshot)
 if a keyboard shortcut defined via the applet configuration settings is
 entered. Similar to volume and other system on-screen displays, even if the
 option to cycle is set to `false` and the profile is unchanged by the keyboard
 shortcut, the on-screen display will still be shown.

COMPATIBILITY
-------------
This applet has been tested to be compatible with Cinnamon 5.6+ but is
supported for Cinnamon 5.4+.

DEPENDENCIES
------------
This applet depends on the following packages being installed:
 * [power-profiles-daemon](https://gitlab.freedesktop.org/hadess/power-profiles-daemon)

On Debian-based, Arch-based, Fedora-based, and Gentoo-based systems, the
package is available in the default repositories as `power-profiles-daemon`.

KNOWN ISSUES
------------
The `power-profiles-daemon` package and daemon conflicts with TLP and other
similar applications - there should only be one such tool installed and
running to ensure overall stability.

[READ MORE](https://gitlab.freedesktop.org/hadess/power-profiles-daemon#conflicts)
