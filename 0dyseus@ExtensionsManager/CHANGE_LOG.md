## Extensions Manager changelog

#### This change log is only valid for the version of the xlet hosted on [its original repository](https://github.com/Odyseus/CinnamonTools)

***

- **Date:** Mon, 29 May 2017 02:48:21 -0300
- **Commit:** [748458d](https://github.com/Odyseus/CinnamonTools/commit/748458d)
- **Author:** Odyseus

```
Extensions Manager applet
- Added missing Help item on applet context menu.
- Updated localization template.
- Updated help file due to updated localizations.

```

***

- **Date:** Sun, 28 May 2017 02:00:26 -0300
- **Commit:** [2dc253e](https://github.com/Odyseus/CinnamonTools/commit/2dc253e)
- **Author:** Odyseus

```
Extensions Manager applet
- Updated README, metadata.json file and help file due to new localization.
- Updated localization template and Spanish localization.

```

***

- **Date:** Sun, 28 May 2017 06:49:19 +0200
- **Commit:** [1da2735](https://github.com/Odyseus/CinnamonTools/commit/1da2735)
- **Author:** Åke Engelbrektson

```
ExtensionsManager: add sv.po
Add Swedish translation
```

***

- **Date:** Sat, 27 May 2017 22:34:14 -0300
- **Commit:** [1ff48f8](https://github.com/Odyseus/CinnamonTools/commit/1ff48f8)
- **Author:** Odyseus

```
Extensions Manager applet
- Updated help file due to updated localization.

```

***

- **Date:** Sat, 27 May 2017 22:02:38 +0800
- **Commit:** [028baa6](https://github.com/Odyseus/CinnamonTools/commit/028baa6)
- **Author:** giwhub

```
Update zh_CN.po

```

***

- **Date:** Sat, 27 May 2017 19:51:09 +0800
- **Commit:** [4ed17ec](https://github.com/Odyseus/CinnamonTools/commit/4ed17ec)
- **Author:** giwhub

```
Update zh_CN.po

```

***

- **Date:** Mon, 15 May 2017 00:01:52 -0300
- **Commit:** [f2c8069](https://github.com/Odyseus/CinnamonTools/commit/f2c8069)
- **Author:** Odyseus

```
Extensions Manager applet
- Ported the appletHelper.py script to Python 3.
- Better general handling of errors.
- Added a **Debug** context menu item that will help to discover why an extension is not being
loaded by this applet menu.

Closes #75

LANGUAGE  UNTRANSLATED
zh_CN.po  0
es.po     0
cs.po     17
hr.po     11

```

***

- **Date:** Sun, 14 May 2017 18:55:32 +0800
- **Commit:** [fe1cfdf](https://github.com/Odyseus/CinnamonTools/commit/fe1cfdf)
- **Author:** giwhub

```
Update zh_CN.po

```

***

- **Date:** Sat, 13 May 2017 20:54:28 -0300
- **Commit:** [d2eade3](https://github.com/Odyseus/CinnamonTools/commit/d2eade3)
- **Author:** Odyseus

```
Extensions Manager applet
- Redesigned help file generation. Now the help file is created from a python script
(create_localized_help.py) from which strings can be extracted by xgettext to be added to the xlet
localization template to be able to localize the content of the help file.

LANGUAGE  UNTRANSLATED
zh_CN.po  14
es.po     0
cs.po     17
hr.po     11

```

***

- **Date:** Mon, 8 May 2017 19:52:37 +0200
- **Commit:** [7737fec](https://github.com/Odyseus/CinnamonTools/commit/7737fec)
- **Author:** muzena

```
0dyseus@ExtensionsManager.hr: update hr.po

```

***

- **Date:** Mon, 8 May 2017 12:19:55 -0300
- **Commit:** [b61e2c0](https://github.com/Odyseus/CinnamonTools/commit/b61e2c0)
- **Author:** Odyseus

```
Extensions Manager applet
- Updated localization template.

```

***

- **Date:** Sun, 7 May 2017 05:59:11 -0300
- **Commit:** [1bc5323](https://github.com/Odyseus/CinnamonTools/commit/1bc5323)
- **Author:** Odyseus

```
Extensions Manager applet
- Corrected execution permission for appletHelper.py file.

```

***

- **Date:** Sat, 6 May 2017 08:26:38 -0300
- **Commit:** [d00c620](https://github.com/Odyseus/CinnamonTools/commit/d00c620)
- **Author:** Odyseus

```
Extensions Manager applet
- Cleaned up metadata.json file.

```

***

- **Date:** Fri, 5 May 2017 13:26:59 -0300
- **Commit:** [025e340](https://github.com/Odyseus/CinnamonTools/commit/025e340)
- **Author:** Odyseus

```
Extensions Manager applet
- Minor code tweaks.

```

***

- **Date:** Thu, 4 May 2017 02:45:35 -0300
- **Commit:** [5de8980](https://github.com/Odyseus/CinnamonTools/commit/5de8980)
- **Author:** Odyseus

```
Extensions Manager applet
- Added option to set a custom icon size for the extension option buttons. This serves to avoid the
enabling/disabling of extensions when one clicks accidentally (because of too small icons) an option
button.
- Changed the name of all custom icons to avoid possible conflicts with icons imported by other
xlets.
- Some code clean up.
- Updated changelog

```

***

- **Date:** Thu, 4 May 2017 00:10:48 -0300
- **Commit:** [0399b94](https://github.com/Odyseus/CinnamonTools/commit/0399b94)
- **Author:** Odyseus

```
Extensions Manager applet
- Updated localization template.
- Updated metadata.json file.

```

***

- **Date:** Sun, 30 Apr 2017 15:00:13 +0200
- **Commit:** [931b372](https://github.com/Odyseus/CinnamonTools/commit/931b372)
- **Author:** muzena

```
Update hr.po

```

***

- **Date:** Sun, 30 Apr 2017 02:05:02 -0300
- **Commit:** [b8e8b1d](https://github.com/Odyseus/CinnamonTools/commit/b8e8b1d)
- **Author:** Odyseus

```
Extensions Manager applet
- Removed *multiversion* because it is not worth the trouble.
- Moved some prototypes into a separate "modules file".
- Removed the use of *get_file_contents_utf8_sync* in favor of an asynchronous function to avoid the
*dangerous* flag.
- Fixed a warning logged into the *.xsession-errors* file on initial applet load.

```

***

- **Date:** Thu, 13 Apr 2017 13:43:04 -0300
- **Commit:** [365d224](https://github.com/Odyseus/CinnamonTools/commit/365d224)
- **Author:** Odyseus

```
Extensions Manager applet - Added localized help.

```

***

- **Date:** Sat, 18 Mar 2017 04:09:21 -0300
- **Commit:** [642da65](https://github.com/Odyseus/CinnamonTools/commit/642da65)
- **Author:** Odyseus

```
Merge pull request #31 from giwhub/giwhub-patch-2
Add Chinese for Extensions Manager
```

***

- **Date:** Wed, 15 Mar 2017 22:46:50 +0800
- **Commit:** [91eef8e](https://github.com/Odyseus/CinnamonTools/commit/91eef8e)
- **Author:** giwhub

```
Create zh_CN.po

```

***

- **Date:** Sat, 11 Mar 2017 00:39:05 -0300
- **Commit:** [b17b258](https://github.com/Odyseus/CinnamonTools/commit/b17b258)
- **Author:** Odyseus

```
Extensions Manager applet - Fixed incorrect setting name that prevented the correct update of the
enabled/disabled extensions on this applet menu.

```

***
- **Date:** Fri, 27 Jan 2017 11:40:53 -0300
- **Commit:** [554371e](https://github.com/Odyseus/CinnamonTools/commit/554371e)
- **Author:** Odyseus

```
Applet - Cleaned some irrelevant files
- Updated READMEs
- Updated metadata.json
- Updated some applet icons.

```

***

- **Date:** Sun, 22 Jan 2017 23:50:00 -0300
- **Commit:** [26e2e87](https://github.com/Odyseus/CinnamonTools/commit/26e2e87)
- **Author:** Odyseus

```
Applets - Fixed some broken links.

```

***

- **Date:** Sun, 22 Jan 2017 20:29:22 -0300
- **Commit:** [c2a6759](https://github.com/Odyseus/CinnamonTools/commit/c2a6759)
- **Author:** Odyseus

```
Applets - Formatted repository to conform Spices repository.

```

***

- **Date:** Mon, 2 Jan 2017 07:25:00 -0300
- **Commit:** [70a4083](https://github.com/Odyseus/CinnamonTools/commit/70a4083)
- **Author:** Odyseus

```
[Extensions Manager applet] - Added Czech localization. Thanks to
[Radek71](https://github.com/Radek71). Closes #14 - Added some missing strings that needed to be
translated.

```

***

- **Date:** Fri, 9 Dec 2016 09:35:58 -0300
- **Commit:** [824aa56](https://github.com/Odyseus/CinnamonTools/commit/824aa56)
- **Author:** Odyseus

```
[Extensions Manager applet] - Some fixes/improvements for Cinnamon 3.2.x.

```

***

- **Date:** Sat, 26 Nov 2016 05:15:47 -0300
- **Commit:** [95a464c](https://github.com/Odyseus/CinnamonTools/commit/95a464c)
- **Author:** Odyseus

```
[Extensions Manager applet] - Reverted back to use Python 2 on the helper script and force to use
Python 2 to execute it.

```

***

- **Date:** Mon, 14 Nov 2016 08:40:23 -0300
- **Commit:** [88b9c05](https://github.com/Odyseus/CinnamonTools/commit/88b9c05)
- **Author:** Odyseus

```
[Extensions Manager applet] - Fixed initial detection of extensions with multi version enabled
- Removed unnecessary directory.

```

***

- **Date:** Sun, 13 Nov 2016 16:21:36 -0300
- **Commit:** [09133a2](https://github.com/Odyseus/CinnamonTools/commit/09133a2)
- **Author:** Odyseus

```
[Extensions Manager applet] Initial release.

```

***
