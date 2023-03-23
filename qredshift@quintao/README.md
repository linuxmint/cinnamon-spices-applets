QRedshift
===
A Cinnamon applet that makes the color of your computer's display adapt to the time of day, warm at night and like sunlight during the day.

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
* Smooth transition between day and night.
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
* 1.7.3
    - Fixed small bug on smooth transition.
    - Fixed messages when not using manual night time.
* 1.7.2
    - Fixed sliders on Cinnamon 5.4
    - Automatically check for redshift-gtk and notify to remove it.
    - Smooth transition between day and night.
* 1.7.1
    - Auto update is only used when night is enabled.
* 1.7.0
    - Fixed issues with asynchronous command calls.
        - Main redshift call reverted to synchronous, so the cinnamon will show the annoying message again: ***This applet contains function calls that could potentially cause Cinnamon to crash or freeze***.
        - I noticed that on some (slow?) computers many asynchronous calls cause the application to freeze.
* 1.6.0
    - Added manual night time option.
    - Fixed some issues with Debian.
* 1.5.5
    - Fixed icon blinking when using symbolic icon.
* 1.5.4
    - ~~Fixed: "This applet contains function calls that could potentially cause Cinnamon to crash or freeze."~~
* 1.5.3
    - Fixed some issues with Debian.
        - Automatically disable redshift default service.
    - Removed default keyboard shortcuts.
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
* 1.5
    - Added keyboard shortcut to toggle On/Off `<Control>End`
    - Added localization support.
* 1.4
    - Fixed icon scale.
    - Added support to version 4.3 and 4.4

## Translations
| Language              | Translator                                                                                                        |
|-----------------------|-------------------------------------------------------------------------------------------------------------------|
| Bulgarian             | <a href="https://github.com/spacy01" target="_blank" title="@spacy01 on Github">@spacy01</a>                      |
| Danish                | <a href="https://github.com/Alan01" target="_blank" title="@Alan01 on Github">@Alan01</a>                         |
| Dutch                 | <a href="https://github.com/Vistaus" target="_blank" title="@Vistaus on Github">@Vistaus</a>                      |
| French                | <a href="https://github.com/claudiux" target="_blank" title="@claudiux on Github">@claudiux</a>                   |
| German                | <a href="https://github.com/OzzieIsaacs" target="_blank" title="@OzzieIsaacs on Github">@OzzieIsaacs</a>          |
| Hungarian             | <a href="https://github.com/kami911" target="_blank" title="@kami911 on Github">@kami911</a>                      |
| Italian               | <a href="https://github.com/eperulli" target="_blank" title="@eperulli on Github">@eperulli</a>                   |
| Polish                | <a href="https://github.com/szedar14" target="_blank" title="@szedar14 on Github">@szedar14</a>                   |
| Portuguese (Brazil)   | <a href="https://github.com/raphaelquintao" target="_blank" title="@raphaelquintao on Github">@raphaelquintao</a> |
| Portuguese (Portugal) | <a href="https://github.com/hugok79" target="_blank" title="@hugok79 on Github">@hugok79</a>                      |
| Romanian              | <a href="https://github.com/AndreiMiculita" target="_blank" title="@AndreiMiculita on Github">@AndreiMiculita</a> |
| Spanish (Mexico)      | <a href="https://github.com/RichLuna" target="_blank" title="@RichLuna on Github">@RichLuna</a>                   |
| Spanish (Spain)       | <a href="https://github.com/haggen88" target="_blank" title="@haggen88 on Github">@haggen88</a>                   |
| Swedish               | <a href="https://github.com/eson57" target="_blank" title="@eson57 on Github">@eson57</a>                         |
| Turkish               | <a href="https://github.com/kelebek333" target="_blank" title="@kelebek333 on Github">@kelebek333</a>             |

## Screenshots
<span style="display:block; text-align:center">

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshot.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshots/screenshot1.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshots/screenshot2.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshift/master/screenshots/screenshot3.png)

</span>
