# Contributing <!-- omit in toc -->

<!-- TOC -->

- [1. Dependencies](#1-dependencies)
  - [1.1. Optional](#11-optional)
- [2. Conventions used](#2-conventions-used)
  - [2.1. Source code files organization](#21-source-code-files-organization)
  - [2.2. Style](#22-style)
- [3. Development workflow](#3-development-workflow)
- [4. Unit testing](#4-unit-testing)
  - [4.1. Core logic](#41-core-logic)
  - [4.2. System/OS interfacing](#42-systemos-interfacing)
- [5. Committing](#5-committing)
- [6. Bumping dependencies](#6-bumping-dependencies)
  - [6.1. Dependencies versions](#61-dependencies-versions)
  - [6.2. Node.js version](#62-nodejs-version)
- [7. Documentation](#7-documentation)
- [8. Linting for Python GTK widgets (experimental)](#8-linting-for-python-gtk-widgets-experimental)
  - [8.1. Installation](#81-installation)
  - [8.2. Setting up in VS Code](#82-setting-up-in-vs-code)

<!-- /TOC -->

## 1. Dependencies

- [pnpm](https://pnpm.io/installation#on-posix-systems)

### 1.1. Optional

- [Visual Studio Code](https://code.visualstudio.com)
  - With the extensions in [`.vscode/extensions.json`](./.vscode/extensions.json).
- `poedit` for translation:
  - On Debian-based systems:
    ```shell
    sudo apt install poedit
    ```

## 2. Conventions used

### 2.1. Source code files organization

In `files/**/src`:
- `app`: application specifics
  - `handlers`: features handlers
  - `ui`: user interface bindings
- `core`: business logic
- `lib`: generic/reusable library
  - `cinnamon`: Cinnamon desktop environment specifics
  - `gnome`: GNOME desktop environment specifics

Hierarchy rule :
- `core` can not depend on `app`,
- `lib` can not depend on `app` and `core`.

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
  ```shell
  ln -s \
      <path_to_this_folder>/files/auto-dark-light@gihaume \
      ~/.local/share/cinnamon/applets/auto-dark-light@gihaume
  ```
  - Alternatively, it can be created via GUI with the handy Cinnamon Spices' Action [`create-desktop-shortcut@anaximeno`](https://cinnamon-spices.linuxmint.com/actions/view/11).
- Modify source files in `files/**/src` as wanted.
- Reload the applet or reset Cinnamon with `Ctrl`+`Alt`+`Esc` and test the new version.
  - Debug with:
    - Looking Glass logs (`Alt`+`F2`, type `lg`, `Enter`),
    - `~/.xsession-errors` logs file.

## 4. Unit testing

### 4.1. Core logic

- Run all core logic automatic unit tests:
  ```shell
  pnpm test
  ```
  - The VS Code extension [Vitest](vscode:extension/vitest.explorer) can also be used instead for more convenience.

### 4.2. System/OS interfacing

Check `test *.js` files in various `tests` folders and run them manually according to their instructions in their headers.

## 5. Committing

Before any commit:

- Every core logic automatic unit test must pass.
- If any system/OS interfacing has been modified, related manual tests must be performed again carefully.
- The change has to be documented as an incremented version in `CHANGELOG.md` accordingly.
  - The version number has to be modified in `files/metadata.json` accordingly.
- If some call to gettext `_("…")` has been added or modified, the following command must be run from the root of the cinnamon spices repository to update the `.pot` translation template file:
  ```shell
  ./cinnamon-spices-makepot auto-dark-light@gihaume
  ```

## 6. Bumping dependencies

### 6.1. Dependencies versions

The dependencies versions are defined in `package.json`. They are carefully updated manually using the Dependi extension.

### 6.2. Node.js version

The chosen version in `package.json` is the LTS stated on the [Node.js website](https://nodejs.org).

## 7. Documentation

Check [`doc/README.md`](./doc/README.md).

## 8. Linting for Python GTK widgets (experimental)

### 8.1. Installation

- Create environment:
  ```shell
  python -m venv .venv --system-site-packages
  ```
- Install dependencies:
  ```shell
  ./.venv/bin/pip install -r requirements.txt
  ```

### 8.2. Setting up in VS Code

- Install the `ms-python.python` extension.
- Select the Python interpreter from the `.venv` folder:
  - Launch the Command Palette with `Ctrl`+`Shift`+`P`
  - Select `Python: Select Interpreter`
  - Select the one from the `.venv` folder.
