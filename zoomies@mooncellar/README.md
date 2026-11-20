# Zoomies 🐈

**A cat monitor that runs faster the harder your system works.**

Zoomies is a panel applet for the Cinnamon desktop (Linux Mint). A little pixel-art cat runs on your panel, and the busier your computer gets, the faster it runs. Keep an eye on CPU, RAM, network or disk activity without looking at a single number (unless you want to).

## Features

- **An animated pixel-art cat** that speeds up with the load: a lazy trot when idle, full zoomies at 100%.
- **Four sensors:** CPU usage, RAM usage, network traffic, or disk write speed.
- **Multiple cats to choose from**, with a picker that shows a preview of each one.
- **Details popup** (left click): a history graph plus the top 5 apps using the CPU, RAM or disk, or your network traffic by interface (Wi-Fi, Ethernet, VPN).
  > **Note:** This feature is not perfect. I struggled with it a bit but got it to a state where I thought it was good enough. I'll rework and improve it in future versions.
- **High load alert:** the cat glows red when the CPU or RAM stays high for a while. The glow can be turned off, or you can change the threshold for when the kitties glow.
- **Several cats at once:** add Zoomies to the panel more than once, each with its own sensor and cat.
- **Light on resources:** it stops drawing while the panel is hidden.

## The cats

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/black.gif" alt="Black" width="96"><br>Black</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/blacktabby.gif" alt="Black Tabby" width="96"><br>Black Tabby</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/blue.gif" alt="Blue" width="96"><br>Blue</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/chocolate.gif" alt="Chocolate" width="96"><br>Chocolate</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/cream.gif" alt="Cream" width="96"><br>Cream</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/ginger.gif" alt="Ginger" width="96"><br>Ginger</td>
  </tr>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/gray.gif" alt="Gray" width="96"><br>Gray</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/lilac.gif" alt="Lilac" width="96"><br>Lilac</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/nebula.gif" alt="Nebula" width="96"><br>Nebula</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/orangetabby.gif" alt="Orange Tabby" width="96"><br>Orange Tabby</td>
    <td align="center"><img src="https://raw.githubusercontent.com/mooncellar/zoomies-cinnamon-applet/HEAD/screenshots/white.gif" alt="White" width="96"><br>White</td>
    <td></td>
  </tr>
</table>

## Installation

1. Right-click your panel and choose **Applets**.
2. Open the **Download** tab, search for **Zoomies** and install it.
3. Back on the **Manage** tab, find **Zoomies** and add it.
4. Right-click the cat and choose **Configure** to pick a sensor and a cat.

## About

Overall this is a pretty simple project, and just something I was inspired to do after seeing something similar for KDE. I used it as an opportunity to learn how Cinnamon applets work and to practise pixel art, something I need for a game dev project of mine. The cats are pretty simple, really just palette swaps, but they're still cute!

Anyway, hope you like it.

Thanks to the Linux Mint team for Cinnamon!

## Future

- **More cats:** I plan to add more cats that aren't pixel art. The current ones are pretty basic.
- **New features and fixes:** I'll add a few new features and fix the left-click process monitor, which isn't working as well as I'd like. I want to move on to other things for now, so I'm uploading this as it is and will come back to make improvements later.

Source code, releases and issues: [github.com/mooncellar/zoomies-cinnamon-applet](https://github.com/mooncellar/zoomies-cinnamon-applet)

Until then, enjoy!