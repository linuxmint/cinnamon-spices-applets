# Contributing

## Dependencies

### Global

- [pnpm](https://pnpm.io/installation#on-posix-systems) (tested v10.24.0).

### Local

- Install dependencies:
  ```bash
  pnpm i  # shortcut for `pnpm install`
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

### Optional

- [Visual Studio Code](https://code.visualstudio.com)
  - With the extensions in [`.vscode/extensions.json`](./.vscode/extensions.json).
- `poedit` for translation:
  - On Debian-based systems:
    ```bash
    sudo apt install poedit
    ```

## Conventions
### Files organization

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

### Style

- See [`.editorconfig`](./.editorconfig).
- Variables names uses `snake_case`.
- Classes names uses `Capitalized_snake_case`.
- Where both single and double quotes are possible:
  - single quotes means to reference to something existing,
  - double quotes means to create something new.
- Braces placement: [K&R](https://en.wikipedia.org/wiki/Indentation_style#K&R) but also for functions.
- Brackets the same as braces as soon as their content is too big for one line.
- When a list content or function arguments is too big for one line:
  - A new line under can have all arguments if they fit in one line,
  - As soon as they don't fit in one line: one argument per line.
- All instructions are terminated by semicolons: ASI is considered a fallback and not a feature.

## Development workflow

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

## Unit testing

### Core logic

- Run all core logic automatic unit tests:
  ```bash
  pnpm test
  ```
  - The VS Code extension [Vitest](vscode:extension/vitest.explorer) can also be used.

### System/OS interfacing

Check `test *.js` files in various `tests` folders and run them manually according to their instructions in their headers.

## Committing

Before any commit:

- All core logic automatic unit tests must pass.
- If any system/OS interfacing has been modified, related manual tests must be performed again carefully.
- It is advisable to build `applet.js` in a single run with:
  ```bash
  pnpm build
  ```
  - then E2E test again.
- The change has to be documented as an incremented version in `CHANGELOG.md` accordingly.
  - The version number has to be modified in `files/metadata.json` accordingly.
- If some call to gettext `_("…")` has been added or modified, the following command must be run from the root of the cinnamon spices repository to update the `.pot` translation template file:
  ```bash
  ./cinnamon-spices-makepot auto-dark-light@gihaume
  ```

## Documentation

Check [`doc/README.md`](./doc/README.md).

## Linting for Python widgets (experimental)

### Installation

- Create environment:
  ```sh
  python -m venv .venv --system-site-packages
  ```
- Install dependencies:
  ```sh
  ./.venv/bin/pip install -r requirements.txt
  ```

### Setting up in VS Code

- Install the `ms-python.python` extension.
- Select the Python interpreter from the `.venv` folder:
  - Launch the Command Palette with `Ctrl`+`Shift`+`P`
  - Select `Python: Select Interpreter`
  - Select the one from the `.venv` folder.
