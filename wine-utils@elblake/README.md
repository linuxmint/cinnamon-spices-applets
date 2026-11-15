Wine Utils
==========

Provides easy access to wine's utilities as an applet.

## Features

 * Easy access to Wine command prompt, utilities and installed programs.
 * Menu of available launcher applications.
 * Switchable between prefixes, prefixes are found automatically and a list of prefixes can be specified in a file.

## New in 1.2.0

 * Prefixes are now automatically found by looking at installed Wine applications.
 * Drive mapping tool, to map drive letters to local paths and network shares.
 * Color editor for Wine, with a feature to import the desktop color theme.
 * Font chooser for Wine that more resembles the system font chooser.
 * Choice between menu items or large icons for launchers and command prompt.
 * Rewritten Run Command with new dialogs.

## Prefix List

A list of prefixes can be used by the applet by creating a text file with a
prefix path on each line, each line can begin with a name and colon (:) for
a label. After creating the file, select it from the applet's preferences.

An example prefix list:

    ## Comments can be added in the file
    
    Default: ~/.wine
    For Program 1: ~/.program1_wine
    For Program 2: ~/.program2_wine


