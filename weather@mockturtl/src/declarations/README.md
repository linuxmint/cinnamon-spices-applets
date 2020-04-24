# Typescript declaration files

## Purpose:

These are Typescript declaration files (.d.ts) describing 
libraries already present in a system whats using Cinnamon. They help Typescript's  static type checking and autocomplete functions, they are never transpiled into JS and they never end up in the "files" folder.

## Files:

Everything is generated with [GIR2TS](https://github.com/Gr3q/GIR2TS) except ```cinnamon.d.ts```, what is made by hand.

They are generated from ```.gir``` files usually located in ```/usr/share/gir-1.0/```, usually part of the ```gobject-introspection``` package.

The declaration files are not complete, there are other libraries what can exist on a system.

Please refer to the documentation if you want to use the tool.



**DISCALIMER**: The tool is not complete nor is it producing 100% correct results due to the fact that using things what are not present in Typrescript like overloaded functions, class inheritance from multiple classes and interfaces. 


