## Changelog

### 3.0.1
  * Now compatible with Cinnamon 4.0.

### 3.0.0 (Only for Cinnamon 3.8 and over)
  * VPN-related Apps Management : You can now manage all applications (for example, torrent clients) that you have registered in the list. (Cf. Settings)
  * Many changes in code and messages. Please, help me by translating these messages into your language, using poedit and the .pot file.

### 2.5.2
  * Translations:
   * Update of vpnLookOut@claudiux.pot
   * Update of es.po, fr.po, it.po

### 2.5.1
  * Adds a keyboard shortcut option to enable / disable the last VPN used.

### 2.5.0
 * Becomes multi-version. For Cinnamon 3.8 (LM 19), the code has been changed to use classes instead of prototypes.
 * Some scripts have been modified for more efficiency.
 * Available languages: English, French, Spanish, Italian, Danish, Swedish.

### 2.4.0
 * Fixes an issue in Cinnamon 3.6.x, setting right permissions to script files.

### 2.3.0
 * A middle click on the icon of this applet is now a quick way to:
   * connect to the last VPN used if it is off;
   * disconnect from the VPN if it is on.

### 2.2.0
 * Now compatible with Arch Linux.
 * Improved compatibility with Fedora 27.

### 2.1.0
 * Now compatible with Fedora 27.

### 2.0.1
 * Bug fixed : Removes all bindings and disconnects all signals, after installing all dependencies (if any), before to reload this applet.
 * Improved installation of translation files.

### 2.0.0
 * New features:
  * When installing this applet, it helps the user to install dependencies, if any.
  * Can connect to the last VPN used, as the applet starts (i.e at user login).
  * Left and right menus : The 'Connect ON/OFF' button disappears when the option 'Try to reconnect to VPN when it shuts down incidentally' is checked.
  * Left menu: If there is more than one VPN connection, a submenu displays all these connections and allows you to connect to the selected one.
  * Icons are adapted to some themes. (To be continued...)
 * Some code optimizations have been made.
 * Some bugs were fixed, especially:
  * If your VPN connection name included spaces, connect/disconnect was not possible in version 1.0.0. This bug was fixed.
 * Available languages  : English, French, Spanish, Italian.
 * Tested on Mint 18.1, 18.2, 18.3 with Cinnamon 3.2, 3.4.

### 1.0.0
 * Detects and displays correctly the status (connected/disconnected) of the VPN (the color of the icon changes).
 * Can emit a sound alert when the VPN disconnect.
 * Can try to reconnect to VPN when it has fallen.
 * Can stop/restart Transmission when VPN disconnects/reconnects.
 * A switch-button (into the menu) lets you manually connect/disconnect the VPN.
 * Internationalization: There is a .pot file (in the 'po' subdirectory) to use with poedit to translate messages. The .po files created are automatically converted in .mo files, which are put into the right directories. The translated messages will appear after the next Cinnamon startup.
 * Available languages  : English, French.
 * Works with Mint 18.2 and Cinnamon 3.2. It can be used on horizontal or vertical panel.
 * Fully functional.
