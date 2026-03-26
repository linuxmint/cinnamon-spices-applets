# Fish Applet TODOs

### Feature Development

- [ ] Improve popup styles

  - [ ] make messages selectable
  - [ ] fix reserved space for scroll bars when they are hidden
  - [ ] don't cut message text sometimes
  - [ ] make message popup look like a speech bubble (if feasible)

- [ ] Add custom icons for errors and warnings

- [ ] Show error messages in preferences window

  - [ ] Display error messages directly for invalid input

- [] Advanced settings

  - [ ] Add option to allow change of message popup size (max-width, max-height)

- [ ] Improve notifications

  - [ ] Adjust icon for different notification types
  - [ ] Format message with markdown (Pango)

- [ ] Add button to install missing dependencies (fortune-mod)

### Bug Fixes

### Code Quality

- [ ] Reconsider project structure (folders, files)
- [ ] Run linter and prettier automatically on commit using husky
- [ ] Use [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import) plugin (proper import ordering) when it supports eslint v9
- [ ] Split the main class (FishApplet.ts) as the file has grown too large
- [ ] Add unit tests for core functionality
- [ ] Address TODOs

### Completed Tasks ✓

- [x] Scale animation image to fit in panel
- [x] Advanced settings in preferences window
  - [x] Add options for animation width and height
  - [x] Include toggle for original size display
