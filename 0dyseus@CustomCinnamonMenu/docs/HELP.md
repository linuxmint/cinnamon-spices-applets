
<!--
Notes to translators:
- Do not modify this file directly. Create a copy of it with a different name that contains the language code and always use the .md extension for the file. Example: HELP-es.md file will contain the content of the HELP.md file translated into Spanish.
- This file is written in [markdown](https://guides.github.com/features/mastering-markdown/) and some "touches" of HTML.
- Familiarize yourself with markdown and HTML languages before attempting to translate the content of this file.
- These notes doesn't need to be translated and can be deleted from the translated file.
-->

# Help for Custom Cinnamon Menu applet

### IMPORTANT!!!
Never delete any of the files found inside this xlet folder. It might break this xlet functionality.

***

<h2 style="color:red;">Bug reports, feature requests and contributions</h2>
<span style="color:red;">
If anyone has bugs to report, a feature request or a contribution, do so on <a href="https://github.com/Odyseus/CinnamonTools">this xlet GitHub page</a>.
</span>

***

### Keyboard navigation
**Note:** Almost all keyboard shortcuts on this menu are the same as the original menu. There are just a couple of differences that I was forced to add to my menu to make some of its features to work.

- <kbd>Left Arrow</kbd> and <kbd>Right Arrow</kbd> keys:
    - Cycles through the favorites box, applications box and categories box if the focus is in one of these boxes.
    - If the focus is on the custom launchers box, these keys will cycle through this box buttons.
- <kbd>Tab</kbd> key :
    - If the favorites box, applications box or categories box are currently focused, the <kbd>Tab</kbd> key will switch the focus to the custom launchers box.
    - If the focus is on the custom launchers box, the focus will go back to the categories box.
    - If the custom launchers box isn't part of the menu, the <kbd>Tab</kbd> key alone or <kbd>Ctrl</kbd>/<kbd>Shift</kbd> + <kbd>Tab</kbd> key are pressed, it will cycle through the favorites box, applications box and categories box.
- <kbd>Up Arrow</kbd> and <kbd>Down Arrow</kbd> keys:
    - If the favorites box, applications box or categories box are currently focused, these keys will cycle through the items in the currently highlighted box.
    - If the focus is on the custom launchers box, the focus will go back to the categories box.
- <kbd>Page Up</kbd> and <kbd>Page Down</kbd> keys: Jumps to the first and last item of the currently selected box. This doesn't affect the custom launchers.
- <kbd>Menu</kbd> or <kbd>Alt</kbd> + <kbd>Enter</kbd> keys: Opens and closes the context menu (if any) of the currently highlighted item.
- <kbd>Enter</kbd>key: Executes the currently highlighted item.
- <kbd>Escape</kbd> key: It closes the main menu. If a context menu is open, it will close the context menu instead and a second tap of this key will close the main menu.
- <kbd>Shift</kbd> + <kbd>Enter</kbd>: Executes the application as root. This doesn't affect the custom launchers.
- <kbd>Ctrl</kbd> + <kbd>Enter</kbd>: Open a terminal and run application from there. This doesn't affect the custom launchers.
- <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>: Open a terminal and run application from there, but the application is executed as root. This doesn't affect the custom launchers.

***

### Applications left click extra actions
When left clicking an application on the menu, certain key modifiers can be pressed to execute an application in a special way.

- <kbd>Shift</kbd> + **Left click**: Executes application as root.
- <kbd>Ctrl</kbd> + **Left click**: Open a terminal and run application from there.
- <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + **Left click**: Open a terminal and run application from there, but the application is executed as root.

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

### Applets/Desklets/Extensions (a.k.a. xlets) localization

- If this xlet was installed from Cinnamon Settings, all of this xlet's localizations were automatically installed.
- If this xlet was installed manually and not trough Cinnamon Settings, localizations can be installed by executing the script called **localizations.sh** from a terminal opened inside the xlet's folder.
- If this xlet has no locale available for your language, you could create it by following [these instructions](https://github.com/Odyseus/CinnamonTools/wiki/Xlet-localization) and send the .po file to me.
    - If you have a GitHub account:
        - You could send a pull request with the new locale file.
        - If you don't want to clone the repository, just create a [Gist](https://gist.github.com/) and send me the link.
    - If you don't have/want a GitHub account:
        - You can send me a [Pastebin](http://pastebin.com/) (or similar service) to my [Mint Forums account](https://forums.linuxmint.com/memberlist.php?mode=viewprofile&u=164858).
- If the source text (in English) and/or my translation to Spanish has errors/inconsistencies, feel free to report them.
