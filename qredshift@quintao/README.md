QRedshift
===
A Cinnamon applet that sets brightness, gamma levels and color temperature with Redshift.

Original Repository: [https://github.com/raphaelquintao/QRedshift](https://github.com/raphaelquintao/QRedshift)

## Translations
If you want to submit some translations please make it on the original repository. It's a lot easier to me keep it synced.

## Buy me a coffee
 - [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=ZLHQD3GQ5YNR6&source=url)
 - Bitcoin: `1NaiaFcVGrrMs9amjyb4aVV1dJoLfdKe3Q`

## Features
* Powerfull Interface.
* Scroll actions on panel icon.
* Keyboard Shortcuts.
* Temperature from 1000k to 9000k.
* Gamma from 0.5 to 5.
* Custom location option.
* Ready to Redshift 1.12

## Installation
1. Install Redshift:
    - Debian/Ubuntu/Linux Mint: `sudo apt-get install redshift`
    - Red Hat/Cent OS/Fedora: `sudo dnf install redshift`
2. Download zip from [this link](https://cinnamon-spices.linuxmint.com/files/applets/qredshift@quintao.zip) and extract .zip archive to `~/.local/share/cinnamon/applets`
    - Or automatically download it from Cinnamon Applets download tab.
3. Enable the applet in Cinnamon settings
4. Make sure you remove redshift-gtk `sudo apt-get remove redshift-gtk`
5. `~/.config/redshift.conf` may conflict with this applet, it is highly recommended removing it.
    - Applet will show a warning to remove it.
6. Make sure you disable redshift service `systemctl mask --user redshift.service`
    - Applet will automatically attempt to disable the default redshift service.
    - If you want to enable it again, run `systemctl unmask --user redshift.service`

## Changelog
* 1.7.1
    - Auto update is only used when night is enabled.
    - Added translations:
      - Polish by [szedar14](https://github.com/szedar14 "@szedar14 on Github")
* 1.7.0
    - Fixed issues with asynchronous command calls.
        - Main redshift call reverted to synchronous, so the cinnamon will show the annoying message again: ***This applet contains function calls that could potentially cause Cinnamon to crash or freeze***.
        - I noticed that on some (slow?) computers many asynchronous calls cause the application to freeze.
    - Added translations:
        - Spanish by [RichLuna](https://github.com/RichLuna "@RichLuna on Github")
* 1.6.0
    - Added manual night-time option.
    - Fixed some issues with Debian.
* 1.5.5
    - Fixed icon blinking when using symbolic icon.
* 1.5.4
    - ~~Fixed: "This applet contains function calls that could potentially cause Cinnamon to crash or freeze."~~
* 1.5.3
    - Fixed some issues with Debian.
        - Automatically disable redshift default service.
    - Removed default keyboard shortcuts.
    - Added translations:
        - Hungarian by [KAMI911](https://github.com/KAMI911 "@KAMI911 on Github")
        - Danish by [Alan01](https://github.com/Alan01 "@Alan01 on Github")
* 1.5.2
    - Added keyboard shortcut to increase brightness `<Control>Page_Up`
    - Added keyboard shortcut to decrease brightness `<Control>Page_Down`
    - Added keyboard shortcut to increase temperature `<Control><Shift>Page_Up`
    - Added keyboard shortcut to decrease temperature `<Control><Shift>Page_Down`
    - Added support to lower gamma.
    - Added option to use a symbolic icon.
* 1.5.1
    - Update night brightness on scrolling.
    - Added support to version 4.6.
    - Added translations:
        - Bulgarian by [@spacy01](https://github.com/spacy01 "@spacy01 on Github")
        - German by [@OzzieIsaacs](https://github.com/OzzieIsaacs "@OzzieIsaacs on Github")
        - Romanian by [@AndreiMiculita](https://github.com/AndreiMiculita "@AndreiMiculita on Github")
* 1.5
    - Added keyboard shortcut to toggle On/Off `<Control>End`
    - Added localization support.
        - Turkish by [@kelebek333](https://github.com/kelebek333 "@kelebek333 on Github")
        - French by [@claudiux](https://github.com/claudiux "@claudiux on Github")
        - Swedish by [@eson57](https://github.com/eson57 "@eson57 on Github")
        - Portuguese by [@raphaelquintao](https://github.com/raphaelquintao "@raphaelquintao on Github")
* 1.4
    - Fixed icon scale.
    - Added support to version 4.3 and 4.4
    

## Screenshots
<span style="display:block; text-align:center">

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshot.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshots/screenshot1.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshots/screenshot2.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshots/screenshot3.png)

</span>


