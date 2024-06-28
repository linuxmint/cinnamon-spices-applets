QRedshift Cinnamon
===
A Cinnamon applet that makes the color of your computer's display adapt to the time of day, warm at night and like sunlight during the day.

Original Repository: [https://github.com/raphaelquintao/QRedshiftCinnamon](https://github.com/raphaelquintao/QRedshiftCinnamon)

## Translations

If you want to submit some translations please make it on the original repository. It's a lot easier to me keep it synced.

## Buy me a coffee

- [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=ZLHQD3GQ5YNR6&source=url)
- Bitcoin: `1PxRoGDq32FNdzk6jq8DGgaRY5uRVtLjHN`

## Features

* Powerfull Interface.
* Scroll actions on panel icon.
* Keyboard Shortcuts.
* Temperature from 1000k to 9000k.
* Gamma from 0.5 to 5.
* Smooth transition between day and night.
* Independent of redshift package.

## Manual Installation

1. Remove old Redshift:
    - Debian/Ubuntu/Linux Mint: `sudo apt-get remove redshift redshift-gtk`
    - Red Hat/Cent OS/Fedora: `sudo dnf remove redshift`
    - Arch/Manjaro: `yay -R redshift redshift-minimal`
2. Download zip from [this link](https://cinnamon-spices.linuxmint.com/files/applets/qredshift@quintao.zip) and extract .zip archive to `~/.local/share/cinnamon/applets`
    - Or automatically download it from Cinnamon Applets download tab.
3. Enable the applet in Cinnamon settings

## Changelog

* 2.0.0
    * Original repository renamed to [QRedshiftCinnamon](https://github.com/raphaelquintao/QRedshiftCinnamon).
    * Completely disabled on Wayland (wayland cinnamon compositor don't support gamma ramps yet).
    * Removed remote location option (I don't think anyone uses it. Can be implemented in the future if got enough requests).
    * Removed dependency of redshift package.
    * Extension now uses its own backend application: [QRedshift Terminal Application](https://github.com/raphaelquintao/QRedshift).

<details closed>
<summary>More</summary>

* 1.7.7
    - Added smooth transition to brightness.
* 1.7.6
    - Added option to activate as soon as Cinnamon starts up.
* 1.7.5
    - Update messages on Arch.
    - Add icons for Cinnamon 5.8
* 1.7.4
    - Added new translations.
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

</details>

## Translations

|                                                             Flag                                                             | Language              | Code    | Translator                                                                                                        |
|:----------------------------------------------------------------------------------------------------------------------------:|-----------------------|---------|-------------------------------------------------------------------------------------------------------------------|
|             <img src="https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Bulgaria.svg" height="16px"/>              | Bulgarian             | `bg`    | <a href="https://github.com/spacy01" target="_blank" title="@spacy01 on Github">@spacy01</a>                      |
|              <img src="https://upload.wikimedia.org/wikipedia/commons/9/9c/Flag_of_Denmark.svg" height="16px"/>              | Danish                | `da`    | <a href="https://github.com/Alan01" target="_blank" title="@Alan01 on Github">@Alan01</a>                         |
|                <img src="https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg" height="16px"/>                 | German                | `de`    | <a href="https://github.com/OzzieIsaacs" target="_blank" title="@OzzieIsaacs on Github">@OzzieIsaacs</a>          |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/9/9a/Flag_of_Spain.svg" height="16px"/>                  | Spanish (Spain)       | `es`    | <a href="https://github.com/haggen88" target="_blank" title="@haggen88 on Github">@haggen88</a>                   |
|              <img src="https://upload.wikimedia.org/wikipedia/commons/f/fc/Flag_of_Mexico.svg" height="16px"/>               | Spanish (Mexico)      | `es_MX` | <a href="https://github.com/RichLuna" target="_blank" title="@RichLuna on Github">@RichLuna</a>                   |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg" height="16px"/>                 | French                | `fr`    | <a href="https://github.com/claudiux" target="_blank" title="@claudiux on Github">@claudiux</a>                   |
|              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Flag_of_Hungary.svg" height="16px"/>              | Hungarian             | `hu`    | <a href="https://github.com/kami911" target="_blank" title="@kami911 on Github">@kami911</a>                      |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/0/03/Flag_of_Italy.svg" height="16px"/>                  | Italian               | `it`    | <a href="https://github.com/eperulli" target="_blank" title="@eperulli on Github">@eperulli</a>                   |
|          <img src="https://upload.wikimedia.org/wikipedia/commons/2/20/Flag_of_the_Netherlands.svg" height="16px"/>          | Dutch                 | `nl`    | <a href="https://github.com/Vistaus" target="_blank" title="@Vistaus on Github">@Vistaus</a>                      |
|             <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Occitania.svg" height="16px"/>             | Occitan               | `oc`    | <a href="https://github.com/Mejans" target="_blank" title="@Mejans on Github">@Mejans</a>                         |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/1/12/Flag_of_Poland.svg" height="16px"/>                 | Polish                | `pl`    | <a href="https://github.com/szedar14" target="_blank" title="@szedar14 on Github">@szedar14</a>                   |
|             <img src="https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg" height="16px"/>              | Portuguese (Portugal) | `pt`    | <a href="https://github.com/hugok79" target="_blank" title="@hugok79 on Github">@hugok79</a>                      |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/0/05/Flag_of_Brazil.svg" height="16px"/>                 | Portuguese (Brazil)   | `pt_BR` | <a href="https://github.com/raphaelquintao" target="_blank" title="@raphaelquintao on Github">@raphaelquintao</a> |
|              <img src="https://upload.wikimedia.org/wikipedia/commons/7/73/Flag_of_Romania.svg" height="16px"/>              | Romanian              | `ro`    | <a href="https://github.com/AndreiMiculita" target="_blank" title="@AndreiMiculita on Github">@AndreiMiculita</a> |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/f/f3/Flag_of_Russia.svg" height="16px"/>                 | Russian               | `ru`    | <a href="https://github.com/aivazoff" target="_blank" title="@aivazoff on Github">@aivazoff</a>                   |
|             <img src="https://upload.wikimedia.org/wikipedia/commons/e/e6/Flag_of_Slovakia.svg" height="16px"/>              | Slovak                | `sk`    | <a href="https://github.com/prescott66" target="_blank" title="@prescott66 on Github">@prescott66</a>             |
|                 <img src="https://upload.wikimedia.org/wikipedia/en/4/4c/Flag_of_Sweden.svg" height="16px"/>                 | Swedish               | `sv`    | <a href="https://github.com/eson57" target="_blank" title="@eson57 on Github">@eson57</a>                         |
|              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b4/Flag_of_Turkey.svg" height="16px"/>               | Turkish               | `tr`    | <a href="https://github.com/kelebek333" target="_blank" title="@kelebek333 on Github">@kelebek333</a>             |
| <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Flag_of_the_People%27s_Republic_of_China.svg" height="16px"/>  | Chinese               | `zh_CN` | <a href="https://github.com/Slinet6056" target="_blank" title="@Slinet6056 on Github">@Slinet6056</a>             |

## Screenshots

<span style="display:block; text-align:center">

![](https://raw.githubusercontent.com/raphaelquintao/QRedshiftCinnamon/master/screenshot.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshiftCinnamon/master/screenshots/screenshot1.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshiftCinnamon/master/screenshots/screenshot2.png)

![](https://raw.githubusercontent.com/raphaelquintao/QRedshiftCinnamon/master/screenshots/screenshot3.png)

</span>
