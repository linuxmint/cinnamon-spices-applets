# Pacman Update Checker

A lightweight Cinnamon applet that checks for pending packages in the Pacman package manager database.

## Features
*   **Repo & AUR support**: Checks for standard official repository updates and optional AUR updates (via `yay` or `paru`).
*   **Most Recently Updated First**: Updates are sorted dynamically so that the most recently built packages (using `expac`) appear at the top of the menu list.
*   **Responsive updates**: Monitors clipboard/process state and queries databases efficiently.
*   **Terminal execution**: Quick-launch action button to trigger update commands directly in your favorite terminal (GNOME Terminal, Kitty, Konsole, Alacritty).

## Requirements
c*   `expac` (for sorting updates by release/build date).
*   An AUR helper (`yay` or `paru`) if AUR checks are enabled.
