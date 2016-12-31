# Help for Quick Menu applet

### IMPORTANT!!!
Never delete any of the files found inside this applet folder. It might break this applet functionality.

***

### Applet usage

- Menu items to .desktop files will be displayed with the icon and name declared inside the .desktop files themselves.
- The menu can be kept open while activating menu items by pressing **Ctrl** + left click or with middle click.

***

### How to set a different icon for each sub-menu
- Create a file at the same level as the folders that will be used to create the sub-menus.
- The file name can be customized, doesn't need to have an extension name and can be a hidden file (a dot file). By default is called **0_icons_for_sub_menus.json**.
- Whatever name is chosen for the file, it will be automatically ignored and will never be shown on the menu.
- The path to the icon has to be a full path. A path starting with **~/** can be used and will be expanded to the user's home folder.
- If any sub-folder has more folders that need to have custom icons, just create another **0_icons_for_sub_menus.json** file at the same level that those folders.
- The content of the file is a *JSON object* and has to look as follows:
```json
{
    "Folder name 1": "Icon name or icon path for Folder name 1",
    "Folder name 2": "Icon name or icon path for Folder name 2",
    "Folder name 3": "Icon name or icon path for Folder name 3",
    "Folder name n": "Icon name or icon path for Folder name n"
}
```

**Warning!!!** JSON *"language"* is very strict. Just be sure to ONLY use double quotes. And the last key/value combination DOESN'T have to end with a comma (**Folder name n** in the previous example).

***

### Applet localization

- If this applet was installed from Cinnamon Settings, all of this applet's localizations were automatically installed.
- If this applet was installed manually and not trough Cinnamon Settings, localizations can be installed by executing the script called **localizations.sh** from a terminal opened inside the applet's folder.
- If this applet has no locale available for your language, you could create it by following [these instructions](https://github.com/Odyseus/CinnamonTools/wiki/Xlet-localizations) and send the .po file to me.
    - If you have a GitHub account:
        - You could send a pull request with the new locale file.
        - If you don't want to clone the repository, just create a Gist and send me the link.
    - If you don't have/want a GitHub account:
        - You can send me a [Pastebin](http://pastebin.com/) (or similar service) to my [Mint Forums account](https://forums.linuxmint.com/memberlist.php?mode=viewprofile&u=164858).
- If the source text (in English) and/or my translation to Spanish has errors/inconsistencies, feel free to report them.
