# Fish

## Preface

This is an adaptation of the charming, classic Fish applet from [GNOME](https://www.gnome.org) and [MATE](https://mate-desktop.org) for Cinnamon desktop.

For more details, please refer to the [Credits](#credits) section below.

## Description

The Fish applet displays a small fish, called Wanda, in the panel. Wanda does nothing useful.
The applet has really no use what-so-ever. It only takes up disk space and compilation time, and if loaded it also takes up precious panel space and memory.
Anybody found using it should be promptly sent for a psychiatric evaluation.

## Requirements

By default, the Fish's wisdom is derived from [`fortune`](https://github.com/shlomif/fortune-mod).

Malicious tongues claim that the fish applet is just a wrapper for it. Wanda, however, firmly rejects these accusations.

Anyways, this little command-line utility should be available for most distributions and can be installed via the package manager of your choice.

Debian and derivatives (e.g: Ubuntu, Linux Mint):

```sh
sudo apt install fortune-mod
```

Arch Linux and derivatives:

```sh
sudo pacman -S fortune-mod
```

If you prefer not to install any additional packages, you can change the command in the applet's settings.
However, be careful that the applet does not become accidentally "practical" or useful.

See: [Customization](#customization)

## Installation

The applet can directly downloaded and added via Cinnamon's applets setting window:

1. Right-click on a panel that you wish to add the Fish applet.
2. Go to the "Downloads" tab and search for "Fish", then select applets to open the applet settings.
3. Download and add the Fish applet.
4. Install `fortune-mod` package (optional) (see: [requirements](#requirements)).

### Manual Installation

1. Download the zip file from Cinnamon's [Spices Applet Website](https://cinnamon-spices.linuxmint.com/applets).
2. Extract the folder `fish@kriegcc` from the zip file to `~/.local/share/cinnamon/applets/`.
3. Install `fortune-mod` package (optional) (see: [requirements](#requirements)).
4. Add the fish applet to your panel (right-click on a panel -> Applets -> search "Fish" and add).

## Usage

Unlike most fishes, this fish requires little care and no fishbowl cleaning. It swims happily about in its water. If you ask it, it will tell you interesting thoughts.

Left-clicking on the applet shows a popup with the fish's message. Clicking somewhere outside the popup or on **Close** button closes the popup.

![Popup message][applet-gif]

Right-clicking on the applet brings up a menu containing the following items:

- **About...** shows basic information about Fish Applet, including the applet's version.
- **Configure...** opens the Properties dialog.
- **Remove 'Fish'** deletes the applet from the panel.

![Context menu][applet-context-menu]

## Customization

You can customize Fish applet by right-clicking on it and choosing 'Configure...'. This will open the Properties dialog, which allows you to change various settings.

![Properties dialog][applet-preferences-main]

The properties are:

### General

- **Name of fish**: You can rename your fish's name here. The default name is Wanda.
- **Command**: Command to run when clicked. By default, Fish runs the `fortune` command when you click on the applet. You can specify an alternative command to run here.

### Animation

- **File**: You can change the animation here. You can select an image that is supplied with the applet or a personal image.
- **Total frames in animation**: You need to specify here the number of frames of the selected image.
- **Pause between frames**: You can specify here the pause in seconds between each frame in the animation. The default is 0.3 seconds, but the range is from 0.1 to 10 seconds.
- **Flip sideways on vertical panels**: This checkbox is used for vertical panels, and when checked, the fish will appear swimming upwards on a vertical panel. If it is not checked, it will appear the same way as on a horizontal panel.

### Advanced Settings

The **Advanced Settings** tab in the Preferences dialog allows further customization of the animation, such as adjusting its size and configuring margins around it within the panel.

## Known Bugs and Limitations

This Cinnamon port of the Fish applet is currently under development.
For a more stable and polished experience, consider using the original applet available for GNOME and MATE desktops.

### Known Issues

- style issues:
  - message in popup might be cut or overlapped by scroll bars

Please feel free to provide feedback, report problems, or support the development of this applet.

See: [Contributing](#contributing)

## Version and Changelog

Fish applet uses [Semantic Versioning](http://semver.org/).
For the current version number, see `metadata.json`.

A changelog is available here: [Changelog][changelog]

## Contributing

Contributions to the Fish applet are welcome and much appreciated.

You can participate in many ways, including:

- Providing feedback
- Reporting issues
- Translating
- Code reviews and coding

See: [Contributing][contributing]

For active development, please refer to the [Development][development] guide.

## Credits

This project is an adaption of the `Fish` applet from GNOME and MATE desktops for Cinnamon desktop.
The original Fish applet is licensed under the GNU General Public License (GPL).

### Original Authors

The original Fish applet was created by George Lebl and further developed by:

- George Lebl
- Mark McLoughlin
- Vincent Untz
- Stefano Karapetsas

**Copyright:**

- (C) 1998-2002 Free Software Foundation, Inc.
- (C) 2002-2005 Vincent Untz
- (C) 2012-2021 MATE developers

### Original Source Code

The original source code of the Fish applet can be found at:

- [GNOME](https://gitlab.gnome.org/GNOME/gnome-panel/-/tree/master/modules/fish)
- [MATE](https://github.com/mate-desktop/mate-panel/tree/master/applets/fish)

### Attributions

The Cinnamon applet "Fish" uses and adapts the following elements from the original GNOME and MATE applets:

- **Idea**: The concept of a fish applet providing whimsical wisdom.
- **Functionality**: Core features and behavior of the original applet.
- **Designs**: Visual and UI design elements.
- **Original Graphics**: Fish images and other graphical assets.
- **Texts**: Original text content and messages.
- **Code Parts**: Portions of the original code, adapted from C to TypeScript.

### Additional Attributions

- **Animation**: In the initial version, the animation functionality was adapted from the [GNOME Shell](https://gitlab.gnome.org/GNOME/gnome-shell) project. Specific adjustments were made to fit the requirements of this applet. In later development, the animation implementation was revised with a different approach. However, the initial animation code remains in the codebase.
  - Source: [GNOME Shell Animation](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/animation.js)

### Special Thanks

I would like to extend my gratitude to the developers of other applets whose code I reviewed and learned from during the development of this project. Their work provided valuable insights and inspiration.

Special thanks to:

- Gr3q ([Weather](https://cinnamon-spices.linuxmint.com/applets/view/17))
- jonath92 ([Radio++](https://cinnamon-spices.linuxmint.com/applets/view/297))

for providing TypeScript declarations and enabling the developing of applets in TypeScript.

Thank you to all contributors and the open-source community for their support and collaboration.

## Maintainers and Contributors

### Maintainers

- kriegcc

### Contributors

- You?

## License

[GPL-3.0-or-later](https://spdx.org/licenses/GPL-3.0-or-later.html)

See: [License][license]

## Resources

### Miscellaneous

- Wanda The Fish fan page (by ePsiLoN, last update 2013): http://wandathefish.com/blog/wanda-fan-site/

<!-- adjust URLs so they work on the Cinnamon Applet Spices website -->

[applet-gif]: https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/fish@kriegcc/docs/images/applet/applet.gif
[applet-context-menu]: https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/fish%40kriegcc/docs/images/applet/context-menu.png
[applet-preferences-main]: https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/fish%40kriegcc/docs/images/applet/settings-window.png
[changelog]: https://github.com/linuxmint/cinnamon-spices-applets/blob/master/fish%40kriegcc/CHANGELOG.md
[contributing]: https://github.com/linuxmint/cinnamon-spices-applets/blob/master/fish%40kriegcc/docs/CONTRIBUTING.md
[development]: https://github.com/linuxmint/cinnamon-spices-applets/blob/master/fish%40kriegcc/docs/DEVELOPMENT.md
[license]: https://raw.githubusercontent.com/linuxmint/cinnamon-spices-applets/master/fish%40kriegcc/COPYING
