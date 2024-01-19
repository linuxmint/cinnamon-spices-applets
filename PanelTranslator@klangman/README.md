# Panel Translator
A translator applet for the Cinnamon desktop environment

Uses [Google](https://translate.google.com/), [Bing](https://www.bing.com/translator) and others (via [translate-shell](https://github.com/soimort/translate-shell)) to translate text into more then 150 languages (depending on the version of translate-shell you install).

## Features

1. Type text into a popup dialog from the Cinnamon panel and translate to the language of your choice
2. Optional automatically translate and playback (Text-to-Speech) from the current selection or clipboard
3. Middle mouse button can be configured to perform 8 different translation actions
4. Ctrl + Middle mouse button can be configured to perform 8 different translation actions
5. Smart language selection entry fields automatically finds language matches as you type, or use the up/down arrow keys to cycle through available languages

## Current Limitations

1. The text boxes are using St.Entry widgets without scroll bars so I have ***limited the text to 200 characters*** until I can find a way to have a type of widget that supports scroll bars. It also seems like translation-shell can not perform "Text-to-Speech" when the text is more than than 200 characters.
2. In my testing, only the Goggle translate engine works consistently (but Bing worked most of the time), and it's the only one that would perform Text-to-Speech for me. I allow other engines to be selected in case some future versions of translate-shell (or different OS setups) works better then what I have seen.

## Requirements

The [translate-shell](https://github.com/soimort/translate-shell) package must be installed for this applet to operate correctly.

```
sudo apt-get install translate-shell
```

It's best to install translate-shell 0.9.7.1 for more supported languages and other improvements, but the Mint 21.2 repositories only have version 0.9.6.12 currently. You might want to visit the translate-shell website below to learn how to install the most up to date version, but this is optional.

https://www.soimort.org/translate-shell/#installation

To enable Text-to-Speech one of these media players must be installed: mplayer, mpv, mpg123, or eSpeak. I tested with mplayer mostly.

```
sudo apt-get install mplayer
```

## Installation
1. Right click on the cinnamon panel that you wish to add PanelTranslator to and then click "Applets"
2. Click on the "Download" tab and select "Panel Translator" and then click the install button on the right
3. Click on the "Manage Tab"
4. Select the "Panel Translator" entry and then click the "+" button at the bottom of the Applet window
5. Right click on the cinnamon panel and use "Panel edit mode" to enable moving the applet within the panel
6. Click "Panel edit mode" again to disable edit mode once you have placed the applet icon where you like

## Feedback
You can leave a comment here on cinnamon-spices.linuxmint.com or you can create an issue on my development GitHub repository:

https://github.com/klangman/PanelTranslator

This is where I develop new features or test out any new ideas I have before pushing to cinnamon-spices.
Please, if you find any issues, feel free to create an issue on Github. Thanks!

If you use use this applet please let me know by liking it here and on my Github repository, that way I will be
encouraged to continue working on the project.
