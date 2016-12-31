# Help for Custom Cinnamon Menu applet

### IMPORTANT!!!
Never delete any of the files found inside this applet folder. It might break this applet functionality.

***

### Keyboard navigation
**Note:** Almost all keyboard shortcuts on this menu are the same as the original menu. There are just a couple of differences that I was forced to add to my menu to make some of its features to work.

- **Left Arrow** and **Right Arrow** keys:
    - Cycles through the favorites box, applications box and categories box if the focus is in one of these boxes.
    - If the focus is on the custom launchers box, these keys will cycle through this box buttons.
- **Tab** key :
    - If the favorites box, applications box or categories box are currently focused, the **Tab** key will switch the focus to the custom launchers box.
    - If the focus is on the custom launchers box, the focus will go back to the categories box.
    - If the custom launchers box isn't part of the menu, the **Tab** key alone or **Ctrl**/**Shit** + **Tab** key are pressed, it will cycle through the favorites box, applications box and categories box.
- **Up Arrow** and **Down Arrow** keys:
    - If the favorites box, applications box or categories box are currently focused, these keys will cycle through the items in the currently highlighted box.
    - If the focus is on the custom launchers box, the focus will go back to the categories box.
- **Page Up** and **Page Down** keys: Jumps to the first and last item of the currently selected box. This doesn't affect the custom launchers.
- **Menu** or **Alt + Enter** keys: Opens and closes the context menu (if any) of the currently highlighted item.
- **Enter** key: Executes the currently highlighted item.
- **Escape** key: It closes the main menu. If a context menu is open, it will close the context menu instead and a second tap of this key will close the main menu.
- **Shift + Enter:** Executes application as root. This doesn't affect the custom launchers.
- **Ctrl + Enter:** Open a terminal and run application from there. This doesn't affect the custom launchers.
- **Ctrl + Shift + Enter:** Open a terminal and run application from there, but the application is executed as root. This doesn't affect the custom launchers.

***

### Applications left click extra actions
When left clicking an application on the menu, certain key modifiers can be pressed to execute an application in a special way.

- **Shift + Left click:** Executes application as root.
- **Ctrl + Left click:** Open a terminal and run application from there.
- **Ctrl + Shift + Left click:** Open a terminal and run application from there, but the application is executed as root.

***

### About "Run from terminal" options

These options are meant for debugging purposes (to see the console output after opening/closing a program to detect possible errors, for example). Instead of opening a terminal to launch a program of which one might not know its command, one can do it directly from the menu and in just one step. Options to run from a terminal an application listed on the menu can be found on the applications context menu and can be hidden/shown from this applet settings window.

By default, these options will use the system's default terminal emulator (**x-terminal-emulator** on Debian based distros). Any other terminal emulator can be specified inside the settings window of this applet, as long as said emulator has support for the **-e** argument. I did my tests with **gnome-terminal**, **xterm** and **terminator**. Additional arguments could be passed to the terminal emulator, but it's not supported by me.

***

### Favorites handling

- If the favorites box is **displayed**, favorites can be added/removed from the context menu for applications and by dragging and dropping applications to/from the favorites box.
    **Note:** To remove a favorite, drag a favorite outside the favorites box into any part of the menu.
- If the favorites box is **hidden** and the favorites category is enabled, favorites can be added/removed from the context menu for applications and by dragging and dropping applications to the favorites category. Its simple, if a favorite is dragged into the favorites category, the favorite will be removed. If what you drag into the favorites category is a non bookmarked application, then that application will be added to the favorites.
    **Note:** The favorites category will update its content after changing to another category and going back to the favorites category.

***

### Troubleshooting/extra information

1. Run from terminal.
    1. **For Debian based distros:** If the command **x-terminal-emulator** doesn't run the terminal emulator that one wants to be the default, run the following command to set a different default terminal emulator.
    - `sudo update-alternatives --config x-terminal-emulator`
    - Type in the number of the selection and hit enter.
    2. **For other distros:** Just set the terminal executable of your choice on this applet settings window.

2. There is a file inside this applet directory called **run_from_terminal.sh**. ***Do not remove, rename or edit this file***. Otherwise, all of the *Run from terminal* options will break.

3. There is a folder named **icons** inside this applet directory. It contains several symbolic icons (most of them are from the Faenza icon theme) and each icon can be used directly by name (on a custom launcher, for example).

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
