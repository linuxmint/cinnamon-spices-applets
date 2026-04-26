# Contributing <!-- omit in toc -->

<!-- TOC -->

- [1. Dependencies](#1-dependencies)
  - [1.1. Global](#11-global)
  - [1.2. Local](#12-local)
  - [1.3. Optional](#13-optional)
- [2. Conventions used](#2-conventions-used)
  - [2.1. Files organization](#21-files-organization)
  - [2.2. Style](#22-style)
- [3. Development workflow](#3-development-workflow)
- [4. Unit testing](#4-unit-testing)
  - [4.1. Core logic](#41-core-logic)
  - [4.2. System/OS interfacing](#42-systemos-interfacing)
- [5. Committing](#5-committing)
- [6. Documentation](#6-documentation)
- [7. Linting for Python widgets (experimental)](#7-linting-for-python-widgets-experimental)
  - [7.1. Installation](#71-installation)
  - [7.2. Setting up in VS Code](#72-setting-up-in-vs-code)

<!-- /TOC -->

## 1. Dependencies

### 1.1. Global

- [pnpm](https://pnpm.io/installation#on-posix-systems) (tested v10.26.2).

### 1.2. Local

- Install dependencies:
  ```bash
  pnpm i # shortcut for `pnpm install`
  ```
  - It needs to be done after each `git pull` that changes `pnpm-lock.yaml`.
  - It creates a `node_modules` folder with symlinks to a global store, so:
    - The global store can be pruned after the local `node_modules` folder has been deleted:
      ```bash
      pnpm store prune
      ```
    - Or to have the files installed in this folder instead of the global store, use exclusively:
      ```bash
      pnpm i --store-dir=.pnpm-store
      ```

### 1.3. Optional

- [Visual Studio Code](https://code.visualstudio.com)
  - With the extensions in [`.vscode/extensions.json`](./.vscode/extensions.json).
- `poedit` for translation:
  - On Debian-based systems:
    ```bash
    sudo apt install poedit
    ```

## 2. Conventions used

### 2.1. Files organization

- `doc`: applet development documentation
- `src`: source files
  - `app`: application specifics
    - `core`: business logic
    - `ui`: user interface bindings
  - `lib`: reusable generic library
    - `core`: business logic
    - `sys`: system/OS interfacing
      - `cinnamon`: Cinnamon desktop environment specifics
      - `gnome`: GNOME desktop environment specifics

Notes :
- Nothing in `lib` depends on anything in `app`.
- Some files in `sys` are not in TypeScript so they are more reusable and directly launchable by GnomeJS in order to test them.

### 2.2. Style

- See [`.editorconfig`](./.editorconfig).
- Classes:
  - [SRP](https://en.wikipedia.org/wiki/Single-responsibility_principle) and [KISS](https://en.wikipedia.org/wiki/KISS_principle).
  - Only [ES6](https://en.wikipedia.org/wiki/ECMAScript_version_history#ES6).
  - Named as an actor (`-or`/`-er` suffix) or an object, in `Capitalized_snake_case`.
  - 1 exported class per file.
    - The file name is strictly the class name.
  - If a class would be invariant (static methods only), a module may be considered instead.
    - A module file name is as its single exported fonction or the general concept if it exports various.
- Variables and functions names are explicit, mostly never abreviated and uses `snake_case`.
- Functions are named as an action (imperative verb).
- Where both single and double quotes are available to define strings:
  - single quotes means to reference to something existing,
  - double quotes means to create something new.
- Braces placement: [K&R](https://en.wikipedia.org/wiki/Indentation_style#K&R) but also for functions scopes.
- Brackets placement the same as braces as soon as their content is too big for one line.
- When a list content or function arguments make too big for one line:
  - A new line under can have all arguments if they fit in one line,
  - As soon as they don't fit in one line: one argument per line.
- All instructions are terminated by semicolons: ASI is considered a fallback and not a feature.

## 3. Development workflow

- Create a symbolic link pointing to this folder and add it in your user applets folder:
  ```bash
  ln -s \
      <path_to_this_folder>/files/auto-dark-light@gihaume \
      ~/.local/share/cinnamon/applets/auto-dark-light@gihaume
  ```
  - Alternatively, it can be created via GUI with the handy Cinnamon Spices' Action [`create-desktop-shortcut@anaximeno`](https://cinnamon-spices.linuxmint.com/actions/view/11).
- Launch the continuous and incremental build of `applet.js` triggered on each source file save:
  ```bash
  pnpm dev
  ```
  - Modify source files in `src/` as wanted.
  - Reset Cinnamon with `Ctrl`+`Alt`+`Esc` for loading and testing the applet's new version.
    - Debug with:
      - Looking Glass logs (`Alt`+`F2`, type `lg`, `Enter`),
      - `~/.xsession-errors` logs file.
  - Press `Ctrl`+`C` (`SIGINT`) to stop the continuous build.

## 4. Unit testing

### 4.1. Core logic

- Run all core logic automatic unit tests:
  ```bash
  pnpm test
  ```
  - The VS Code extension [Vitest](vscode:extension/vitest.explorer) can also be used.

### 4.2. System/OS interfacing

Check `test *.js` files in various `tests` folders and run them manually according to their instructions in their headers.

## 5. Committing

Before any commit:

- All core logic automatic unit tests must pass.
- If any system/OS interfacing has been modified, related manual tests must be performed again carefully.
- It is advisable to build `applet.js` again in a single run with:
  ```bash
  pnpm build
  ```
  - then E2E test again if it made a diff.
- The change has to be documented as an incremented version in `CHANGELOG.md` accordingly.
  - The version number has to be modified in `files/metadata.json` accordingly.
- If some call to gettext `_("…")` has been added or modified, the following command must be run from the root of the cinnamon spices repository to update the `.pot` translation template file:
  ```bash
  ./cinnamon-spices-makepot auto-dark-light@gihaume
  ```

## 6. Documentation

Check [`doc/README.md`](./doc/README.md).

## 7. Linting for Python widgets (experimental)

### 7.1. Installation

- Create environment:
  ```sh
  python -m venv .venv --system-site-packages
  ```
- Install dependencies:
  ```sh
  ./.venv/bin/pip install -r requirements.txt
  ```

### 7.2. Setting up in VS Code

- Install the `ms-python.python` extension.
- Select the Python interpreter from the `.venv` folder:
  - Launch the Command Palette with `Ctrl`+`Shift`+`P`
  - Select `Python: Select Interpreter`
  - Select the one from the `.venv` folder.
