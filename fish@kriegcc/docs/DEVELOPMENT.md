# Development Guide

Would you like to join the development of this applet? Awesome! Code contributions are very much welcomed. This guide should help you get started. I am looking forward to your first pull request!

## Cinnamon Applet Development

Are you new to Cinnamon applet development? Cinnamon applets are written in JavaScript. If you have experience in web development with JavaScript, writing Cinnamon applets should feel quite familiar. However, there is not much documentation available about the Cinnamon extension system. You will need to gather information from various sources and often figure things out on your own. This can feel quite disorienting in the beginning. I faced a steep learning curve myself. I found it most useful to look at the work of other applet developers.

Fortunately, [Gr3q](https://github.com/Gr3q) and [jonath92](https://github.com/jonath92) contributed TypeScript declarations for Cinnamon libraries. This makes the entry for starters much less painful and frustrating. Many thanks to them! Check out their applets [weather@mockturtl](https://cinnamon-spices.linuxmint.com/applets/view/17) and [radio@driglu4it](https://cinnamon-spices.linuxmint.com/applets/view/297), which are written in TypeScript.

Please refer to the [Resources](#resources) section below for some links to tutorials and further documentation.

### TypeScript and Webpack

Unlike most Cinnamon extensions, the Fish applet is being developed in TypeScript. In my opinion, this drastically improves the developer experience and can help to improve code quality overall. The source code is compiled from TypeScript to pure JavaScript and bundled with the help of [Webpack](https://webpack.js.org).

Please refer to [this instruction](../../.typescript-declarations/README.md) on how to bootstrap an applet with TypeScript.

## Tech Stack

- TypeScript
- Node
- NPM
- Webpack
- CSS
- Python

## Prerequisites

- **Node**
- **NPM**
- **Git**

I recommend using [Volta](https://volta.sh/) for managing the JavaScript tools.

## Setting Up the Development Environment

### Checkout and IDE

Clone the Repository:

```sh
  git clone https://github.com/linuxmint/cinnamon-spices-applets.git
  cd cinnamon-spices-applets
```

Open the repository in the IDE of your choice.
I recommend using an editor with robust TypeScript support, including linting and auto-formatting features, for example [VSCodium](https://vscodium.com/).

Go to the Fish applet folder `fish@kriegcc`. This is the Fish applet's root directory.
Please do not modify any files outside the Fish applet's folder.

### Folder Structure

```sh
fish@kriegcc/
├── docs
│   ├── [..]
├── files
│   └── fish@kriegcc
│       ├── animations
│       │   ├── [..]
│       ├── po
│       │   ├── [..]
│       ├── applet.js
│       ├── fish-applet.js
│       ├── icon.png
│       ├── ImageChooser.py
│       ├── metadata.json
│       ├── settings-schema.json
│       └── stylesheet.css
├── node_modules
│   ├── [..]
├── src
│   ├── applet.ts
│   ├── FishApplet.ts
│   └── [..]
├── eslint.config.mjs
├── info.json
├── package.json
├── screenshot.png
├── test.sh
├── tsconfig.json
├── webpack.config.ts
└── [..]
```

The structure is mostly identical to a regular applet written in JavaScript. However, the `src` folder contains the TypeScript files, and this is where development happens. The `files` folder functions similarly to a `dist` folder you may know from JavaScript-based web development projects.

The TypeScript source files are compiled to JavaScript (configured in `tsconfig.json`). Webpack bundles all the compiled individual files into a single JavaScript file (`fish-applet.js`) and copies it to the `files` folder, which is then distributed.

`applet.js` is the entry point for the applet and simply imports the compiled and bundled output from Webpack. The bundling process is configured in `webpack.config.ts`. A [build](#build-applet-and-test-changes) should only update `fish-applet.js`.

## Build Applet and Test Changes

### Install Dependencies

The project has some Node _devDependencies_ which are required for the development and build process. They are listed in the `package.json` file.

Make sure you are in the applet's root folder (where the `package.json` is located) and run:

```sh
npm i
```

### Build the Applet

Run:

```sh
npm run build
```

This executes the `build` script command which is defined in the `package.json`. It triggers Webpack, which will in turn invoke the TypeScript compiler to compile the source files. Webpack then bundles the compiled files together and copies the result into the `files` folder. The applet should then be ready for testing.

### Test the Applet

To run the applet, you need to copy the entire content of the `files` folder to your local Cinnamon applet folder `~/.local/share/cinnamon/applets/fish@kriegcc/`. Make sure that the Fish applet is added to a panel.

For the changes to take effect, Cinnamon needs to be restarted. Don't worry! This is not like a reboot and is relatively painless. Just the windows are moved around a bit.

Restart Cinnamon:

```sh
ALT+F2, type "r" and press Enter
```

### Test Script

The manual steps above of copying files during the development process to test each change can be really tedious over time. Luckily, there is a shell script `test.sh` in the applet's root folder.

Run:

```sh
./test.sh
```

The script executes `npm run build`, copies the build result into the local Cinnamon applet folder, and restarts Cinnamon. This is quite handy for quickly testing changes while coding. Alternatively, you can use the official `test-spice` Python script in the repository's root directory. For further details, please refer to the respective [README](../../README.md) file.

### Debugging

Debugging options are quite limited, unfortunately. Only the tool `Looking Glass` (Melange) is available. This can be used to view console output and errors of the applets.

Open Looking Glass:

```sh
Win+L (or ALT+F2), type “lg” and hit Enter
```

## Style Guidelines

This applet adheres to [Cinnamon's coding guidelines](https://linuxmint-developer-guide.readthedocs.io/en/latest/guidelines.html). A good orientation are also [GNOME's Guidelines](https://developer.gnome.org/documentation/guidelines.html).

To maintain a high coding standard, this project uses [ESLint](https://eslint.org) and [Prettier](https://prettier.io).

There are two script commands to help ensure that your code adheres to the project's coding standards. Run the following commands to check for style violations:

**ESLint:**

```sh
npm run lint
npm run lint-fix
```

**Prettier:**

```sh
npm run format-check
npm run format
```

Ideally, your IDE should automatically read the ESLint and Prettier configurations and provide direct feedback while writing code.

Before pushing your code changes, please run the scripts to check for violations. In the future, this could run automatically with [husky](https://github.com/typicode/husky) and [lint-staged](https://github.com/lint-staged/lint-staged).

The coding guidelines are not definitive. Feel free to suggest changes or additions.

### Additional Notes:

- For indentation, currently 2 white space characters are used instead of 4 as recommended.
  - This is just my personal preference.
  - We can change it.
- Make full use of TypeScript's power.
- Try to keep things simple and readable.
  - Split up large portions of code.
  - Don't hesitate to outsource and extract code to keep individual files lucid.
  - Try to avoid complicated or convoluted code.
  - Ideally, code should be self-explanatory and easy to follow.
  - Things can always get quickly complicated, though.
    - Leave short comments with a bit of explanation in that case.
- Consider using JSDoc on interfaces.
- Follow the [Boy Scout Rule](https://deviq.com/principles/boy-scout-rule): "Leave your code better than you found it."
- If you copy code from another applet, add a comment and give credit.
- Ensure that no copyright is violated and the applet's license is retained (GPL-3.0-or-later).

## Developer Options

There is a hidden **Developer Options** section in the **Advanced Settings** tab of the Preferences dialog. This section contains options intended for debugging and development purposes. For example, it includes an option to trigger the Fool's Day easter egg without changing the system date. You can also add additional options here that should remain hidden from normal users.

![Developer Options][advanced-settings-developer-options]

### Enable Display of Developer Options

The visibility of the **Developer Options** section is controlled by the `keyDeveloperOptionsEnabled` setting, which is of type `generic`. To enable it:

1. Locate the Fish applet's configuration JSON file under: `~/.config/cinnamon/spices/fish@kriegcc`
2. Modify the `keyDeveloperOptionsEnabled` value to `true`. The updated JSON entry should look like this:

```json
"keyDeveloperOptionsEnabled": {
  "type": "generic",
  "default": false,
  "value": true
}
```

3. Close the Preferences dialog (if it is open) and reopen it.

The next time you open the applet preferences, the **Developer Options** section will be visible in the Advanced Settings tab.

## Troubleshooting

Unhandled errors can easily lead to a crash of the Cinnamon desktop. When this happens, window decorations may disappear, and nothing may be clickable.

### Recover and Restore Cinnamon After a Crash

**Restart Cinnamon:**

```sh
CTRL+ALT+Return, to restart Cinnamon
```

Normally, Cinnamon detects issues with applets and prompts you to disable all applets. Restoring applets afterward can be tedious. If you choose not to disable them, the faulty applet code will be reloaded, likely causing another crash.

Instead, you can manually delete the faulty applet code and then restart Cinnamon:

1. **Open a Virtual Terminal:**

```sh
CTRL+ALT+F1, to start a virtual terminal
```

2. **Navigate to the Applet Directory:**

```sh
cd ~/.local/share/cinnamon/applets/fish@kriegcc/
```

3. **Remove the Faulty Applet Code:**

```sh
rm fish-applet.js
```

4. **Go back to GUI:**

```sh
CTRL+ALT+F7, to bring back broken Cinnamon session again
```

5. **Restart Cinnamon:**

```sh
CTRL+ALT+Return, to restart Cinnamon
```

This process should help you recover from a crash without disabling all applets.

## Resources

Developer Guides:

- [Linux Mint Developer Guide](https://linuxmint-developer-guide.readthedocs.io/en/latest/index.html)
- [GNOME Developer Documentation](https://developer.gnome.org/documentation/index.html)

Applet tutorials:

- https://projects.linuxmint.com/reference/git/cinnamon-tutorials/write-applet.html
- https://nickdurante.github.io/development/Writing-a-Cinnamon-Applet
- https://billauer.co.il/blog/2018/12/writing-cinnamon-applet

API References:

- [Cinnamon Documentation](https://projects.linuxmint.com/reference/git/index.html)
- [GNOME JavaScript Docs](https://gjs-docs.gnome.org)
- [GJS Architecture](https://gjs.guide/extensions/overview/architecture.html)
- [GTK 3 classes](https://docs.gtk.org/gtk3/#classes)
- [Gjsify project - TypeScript declarations for GNOME libraries](https://github.com/gjsify)

Source code of the original Fish applet:

- [GNOME](https://gitlab.gnome.org/GNOME/gnome-panel/-/tree/master/modules/fish)
- [MATE](https://github.com/mate-desktop/mate-panel/tree/master/applets/fish)

[advanced-settings-developer-options]: ./images/applet/advanced-settings-developer-options.png
