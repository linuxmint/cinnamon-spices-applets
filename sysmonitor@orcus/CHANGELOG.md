### 1.6.4
* Fixed memory leak
* Applet now uses one drawing area for all graphs, it should reduce drawing overhead

### 1.6.3
* Fixed rendering, it should be pixel perfect now
* Added option to show decimal value as CPU usage in the tooltip

### 1.6.2
* Fixed applet not loading in Cinnamon older than 3.2

### 1.6.1
* Fixed an issue with applet not loading on some distributions due to a missing function `GTop.glibtop.get_netlist`

### 1.6
* Added support for vertical panels
* Applet checks for missing dependency on startup (glibtop) and asks the user to install it instead of just failing to load

### 1.5
* Using Cinnamon Applet Settings API instead of custom application

### 1.4
* Changed CPU provider to support system suspend without breaking

### 1.3
* Rewrote rendering code, applet now supports smooth graphs

### 1.2
* Enabled customization through custom application

### 1.1
* Added more data providers

### 1.0
* First applet version
