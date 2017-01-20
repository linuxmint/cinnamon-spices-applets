# Help for Popup Translator applet

### IMPORTANT!!!
Never delete any of the files found inside this applet folder. It might break this applet functionality.

***

### Dependencies
**If one or more of these dependencies are missing in your system, you will not be able to use this applet.**

- **xsel** command: XSel is a command-line program for getting and setting the contents of the X selection.
    - Debian and Arch Linux based distributions: The package is called **xsel**.
- **xdg-open** command: Open a URI in the user's preferred application that handles the respective URI or file type.
    - Debian and Arch Linux based distributions: This command is installed with the package called **xdg-utils**. Installed by default in modern versions of Linux Mint.
- **Python 3**: It should come already installed in all Linux distributions.
- **requests** Python 3 module: Requests allow you to send HTTP/1.1 requests. You can add headers, form data, multi-part files, and parameters with simple Python dictionaries, and access the response data in the same way. It's powered by httplib and urllib3, but it does all the hard work and crazy hacks for you.
    - Debian based distributions: The package is called **python3-requests**. Installed by default in modern versions of Linux Mint.
    - Arch Linux based distributions: The package is called **python-requests**.

**After installing any of the missing dependencies, Cinnamon needs to be restarted**

**Note:** I don't use any other type of Linux distribution (Gentoo based, Slackware based, etc.). If any of the previous packages/modules are named differently, please, let me know and I will specify them in this help file.

***


### How to get Yandex translator API keys

- Visit one of the following links and register a Yandex account (or use one of the available social services).
    - **English:** https://tech.yandex.com/keys/get/?service=trnsl
    - **Russian:** https://tech.yandex.ru/keys/get/?service=trnsl
- Once you successfully finish creating your Yandex account, you can visit the link provided several times to create several API keys. **DO NOT ABUSE!!!**
- Once you have several API keys, you can add them to Popup Translator's settings window (one API key per line).

#### Important notes about Yandex API keys
- The API keys will be stored into a preference. Keep your API keys backed up in case you reset Popup Translator's preferences.
- **NEVER make your API keys public!!!** The whole purpose of going to the trouble of getting your own API keys is that the only one *consuming their limits* is you and nobody else.
- With each Yandex translator API key you can translate **UP TO** 1.000.000 (1 million) characters per day **BUT NOT MORE** than 10.000.000 (10 millions) per month.

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

