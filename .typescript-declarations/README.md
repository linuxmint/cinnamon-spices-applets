# Typescript declaration files

## Purpose

These are Typescript declaration files (.d.ts) describing libraries usually present in a system which is using Cinnamon. They only help Typescript's static type checking and autocomplete functions, they are never transpiled into JS and they should never end up in the "files" folder.

These alone are a big help but it's still recommended to refer to [GJS docs](https://gjs-docs.gnome.org/) and reading the files in `/usr/share/cinnamon/js/` folder because they have complete implementations/documentation.

## Files

Everything in the folder root is generated with [GIR2TS](https://github.com/Gr3q/GIR2TS) from ```.gir``` files usually located in ```/usr/share/gir-1.0/```, usually part of the ```gobject-introspection``` package.

The declaration files are not complete, there are other libraries which can exist on a system.

Please refer to the documentation if you want to use the tool and generate more declarations.

**DISCALIMER**: The tool is not complete nor is it producing 100% correct results due to the fact that GIR files (and C language in general) has features which are not present in Typescript or impossible to implement like overloaded functions, class inheritance from multiple classes. Some of them can be worked around and some of them cannot. Nevertheless, it produces usable declarations and is a good starting point which can be fixed up when they see usage.

Files in the ```cinnamon``` folder are written by hand and should match existing files in `/usr/share/cinnamon/js/` folder (for version 3.8 and above). Currently not all files have declarations, only for the essentials. Contributions are welcome.

## Bootstrap an applet with Typescript

TODO: add these

* only above 3.8

* folder structure

* look out for circular imports and recommended code structure

* exact typescript.json file to use

* testing