# Contributing

## Prerequisites

### Global dependencies

- [pnpm](https://pnpm.io/installation#on-posix-systems) (tested v10.20.0).

### Local dependencies

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

## Development

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

## Testing

- Run all unit tests:
  ```bash
  pnpm test
  ```
  - The VS Code extension [Vitest](vscode:extension/vitest.explorer) can also be used.

## Committing

Before any commit:

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
