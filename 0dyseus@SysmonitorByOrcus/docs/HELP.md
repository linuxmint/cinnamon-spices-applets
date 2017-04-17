
<!--
Notes to translators:
- Do not modify this file directly. Create a copy of it with a different name that contains the language code and always use the .md extension for the file. Example: HELP-es.md file will contain the content of the HELP.md file translated into Spanish.
- This file is written in [markdown](https://guides.github.com/features/mastering-markdown/) and some "touches" of HTML.
- Familiarize yourself with markdown and HTML languages before attempting to translate the content of this file.
- These notes doesn't need to be translated and can be deleted from the translated file.
-->

# Help for System Monitor (Fork By Odyseus) applet

### IMPORTANT!!!
Never delete any of the files found inside this xlet folder. It might break this xlet functionality.

***

<h2 style="color:red;">Bug reports, feature requests and contributions</h2>
<span style="color:red;">
If anyone has bugs to report, a feature request or a contribution, do so on <a href="https://github.com/Odyseus/CinnamonTools">this xlet GitHub page</a>.
</span>

***

### Dependencies

- **gir1.2-gtop-2.0**: The gtop library reads information about processes and the state of the
system.
    - Debian based distributions: The package is called **gir1.2-gtop-2.0**.
    - Archlinux based distributions: The package is called **libgtop**.
    - Fedora based distributions: The package is called **libgtop2-devel**.
- **NetworkManager**: NetworkManager is a system network service that manages your network devices and connections, attempting to keep active network connectivity when available.
    - Debian based distributions: The package is called **gir1.2-networkmanager-1.0**.
    - Archlinux based distributions: The package is called **networkmanager**.
    - Fedora based distributions: The package is called **NetworkManager**.

**Important note:** NetworkManager is only used if the **GTop** library version installed on a system is < **2.32** and doesn't support certain library calls. So, basically, if the network graph on this applet works without having installed NetworkManager, then you don't need to install it.

**Restart Cinnamon after installing the packages for the applet to recognize them.**

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
