## System monitor applet
This applet uses glibtop to get system resources usage statistics and displays them in graphs and also as text in tooltip.

All graph colors and sizes are configurable. Color settings support alpha channel, for ex. setting background alpha to 0 can make the background transparent.

Cinnamon settings API is used. All changes are applied on the fly and it is not necessary to restart the Cinnamon.

### Installing glibtop
* Ubuntu, Mint
```
sudo apt-get install gir1.2-gtop-2.0
```
* Fedora
```
sudo dnf install libgtop2
```