## Change Log

##### 1.05
- Fixed Google Translate language detection due to changes on Google's side.
- Changed *multiversion* implementation. Created symlinks inside the version folder so I don't keep forgetting to copy the files from the root folder. The only *unique* file, and the only reason that I use *multiversion*, is the settings-schema.json file.
- Changed the way the imports are done.
- Removed *dangerous* flag. Achieved by changing all synchronous functions to their asynchronous counterparts.
- General code clean up.

##### 1.04
- Fixed keybindings not registered on applet initialization.
- Implemented 4 different translation mechanisms that will allow to have various translation options at hand without the need to constantly change the applet settings. Read the HELP.md file for more details (It can be accessed from this applet context menu).
- Re-designed the translation history mechanism to be *smarter*. Now, for example, if a string is translated into four different languages, all the strings will be stored into four different entries in the translation history.
- Re-designed the translation history window. Now, only one instance of the history window can be opened at the same time. Removed **Reload** button in favor of auto-update of the history window content every time the translation history changes and the translation window is open.
- Moved some of the context menu entries into a sub-menu.
- Removed unused import from appletHelper.py file.
- Added new icons to the icons folder that represent the translation services used by this applet.
- Added debugging options to facilitate development.

##### 1.03
- Fixed keybinding display on applet tooltip.

##### 1.02
- Added German localization. Thanks to [NikoKrause](https://github.com/NikoKrause).

##### 1.01
- Added Czech localization. Thanks to [Radek71](https://github.com/Radek71).
- Added missing translatable strings.
- Improved clean up when removing applet.

##### 1.00
- Initial release.
