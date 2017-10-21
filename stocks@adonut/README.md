## stocks applet for the [Cinnamon](http://cinnamon.linuxmint.com) desktop.
(inspired by Gnome Shell's stocks extension written by Andrew Miller)

----

### Requirements
	- tested and running in cinnamon 2.0.14 

### Configuration
	- enter the corresponding quotes initials into stocks.list - one each line
	- you need to use google's quotes syntax e.g. GOOG RHT - NOT the one from Yahoo
	- also exchange initals are allowd e.g.: FRA:DTE

### known Issues
	- once the stocks-pickup is done, the system might lag for a fraction of a sec
	normaly you would not feel it, but if you watch a video it might hick-up... 
 
### Todo
	- allow # marks in stocks.list
	- add colors
	- configuration menu on right mouse button
	- enter new quotes interactivly
	
-----

Changelog:

	Version:  0.15
	
	- fixed encoding bug (google delivers in Windows-1252 codepage wich breaks JS UTF-8)   
	- added support for non-$ currency symbols
	
