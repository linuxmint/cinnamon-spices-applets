## Changelog

### 3.5.1~20200810
  * Fixes a minor bug.
  * Now can detect usage of Wireguard (but not manage it).

### 3.5.0~20191218
  * Some bug fixes and code cleanup. See [issue 8914](https://github.com/linuxmint/cinnamon/issues/8914) - Many thanks to @Odyseus and @collinss !

### 3.4.2~20191207
  * Activate vpnLookOut with middle-click or keyboard shortcut.
  * Change tooltip.

### 3.4.1~20191205
  * New option in Settings -> VPN: Deactivate vpnLookOut at startup.

### 3.4.0~20191108
  * Add ability to deactivate vpnLookOut.

### 3.3.5~20191106
  * Bug fixes.
  * Compatible with Cinnamon 4.4.
  * Cinnamon 4.2 and above versions: Add ability to use symbolic icons.

### 3.3.4~20190702
  * Now compatible with Cinnamon 4.2.

### 3.3.3~20190202
  * Improves responsiveness.

### 3.3.2~20190106
  * Improves time zone detection.

### 3.3.1~20181122
  * Now showing in the tooltip (hovering the icon) the keyboard and mouse shortcuts to connect / disconnect.
  * "Switch to" (another VPN) events are now registered in the log file.
  * Update of French, Spanish and Italian translations.

### 3.3.0~20181120
  * New option in Settings (VPN layout):
   * "Do not try to reconnect automatically if the VPN has been disconnected by the user"
   * This option appears only when the option "Try to reconnect to VPN when it shuts down incidentally" is checked.

### 3.2.1~20181115
  * Improves display and management of Activity Log.

### 3.2.0~20181111
  * Capability of logging:
   * the status of the VPN link,
   * the status of the VPN-related Apps.
  * New entry in the menu to view the log file.
  * Settings - New options in the VPN panel to:
   * set logging on/off,
   * set the lifetime of a record in the log file.

### 3.1.0~20181107
  * VPN-related Apps Management:
   * New `VPN Only` option for each managed app: you can require that an application be shut down quickly if it is started while the VPN is idle.
  * Improved translations into French, Spanish and Italian.

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
