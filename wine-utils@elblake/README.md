Wine Utils
==========

Provides easy access to wine's utilities as an applet.

## Features

 * Easy access to Wine command prompt, utilities and installed programs.
 * Switchable between prefixes, a list of prefixes can be specified in a file.

## Prefix List

A list of prefixes can be used by the applet by creating a text file with a
prefix path on each line, each line can begin with a name and colon (:) for
a label. After creating the file, select it from the applet's preferences.

An example prefix list:

    ## Comments can be added in the file
    
    Default: ~/.wine
    For Program 1: ~/.program1_wine
    For Program 2: ~/.program2_wine


