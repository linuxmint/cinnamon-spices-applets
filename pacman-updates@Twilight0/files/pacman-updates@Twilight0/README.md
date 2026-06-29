# Pacman Update Checker

A lightweight, event-driven Cinnamon applet that checks for pending package updates on Arch-based Linux distributions or any system utilizing the Pacman package manager.

## Features
*   **Arch/Pacman Intended**: Designed specifically for Arch Linux and its derivatives. It relies on Pacman's standard userspace update-checking utility `checkupdates` (from the `pacman-contrib` package) to safely check for updates without locking the database.
*   **Automatic Live Lock Detection**: Monitors `/var/lib/pacman/db.lck` in real-time. When a system update is running, the applet automatically displays a locked padlock icon with a "Busy" status and disables manual checks to prevent transaction conflicts.
*   **Instant Post-Update Refresh**: As soon as the Pacman database lock is released (meaning the update process has finished), the applet automatically triggers a new check after a 1-second delay, updating your status to "System is up to date" immediately.
*   **Repo & AUR Support**: Checks for official repository updates and optional AUR updates (via `yay` or `paru`).
*   **Chronological Sorting**: Pending updates are sorted dynamically so that the most recently built packages (using `expac`) appear at the top of the menu list.
*   **Terminal Execution**: Quick-launch action button to trigger update commands directly in your favorite terminal (GNOME Terminal, Kitty, Konsole, Alacritty, or any custom emulator).

## Requirements
*   `pacman-contrib` (for the safe `checkupdates` userspace utility).
*   `expac` (optional, for sorting updates by release/build date).
*   An AUR helper (`yay` or `paru`) if AUR checks are enabled.
