## Change Log

##### 1.06
- Removed *multiversion* because it is not worth the trouble.
- Moved some prototypes into a separate "modules file".
- Removed the use of *get_file_contents_utf8_sync* in favor of an asynchronous function to avoid the *dangerous* flag.
- Added option to set a custom icon size for the extension option buttons. This serves to avoid the enabling/disabling of extensions when one clicks accidentally (because of too small icons) an option button.
- Changed the name of all custom icons to avoid possible conflicts with icons imported by other xlets.
- Fixed a warnings logged into the *.xsession-errors*.

##### 1.05
- Fixed incorrect setting name that prevented the correct update of the enabled/disabled extensions on this applet menu.

##### 1.04
- Added Czech localization. Thanks to [Radek71](https://github.com/Radek71).
- Added some missing strings that needed to be translated.

##### 1.03
- Some fixes/improvements for Cinnamon 3.2.x.

##### 1.02
- Reverted back to use Python 2 on the helper script and force to use Python 2 to execute it.

##### 1.01
- Fixed initial detection of extensions with multi version enabled.
- Removed unnecessary directory.

##### 1.00
- Initial release.
