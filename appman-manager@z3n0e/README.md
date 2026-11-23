# AppMan Manager

A panel applet for [AppMan / AM](https://github.com/ivan-hc/AM), the command-line manager for
AppImages and portable apps. It checks for updates without applying them, and lets you update,
install, reinstall, lock and remove your apps from the panel.

## Requirements

- [AppMan](https://github.com/ivan-hc/AM) installed and set up (`appman` in `~/.local/bin` or in
  your `PATH`). The applet manages the apps in the folder set in `~/.config/appman/appman-config`.
- `bash`, `curl` and coreutils, which AppMan needs anyway.

## Features

- **Check for updates without installing them.** Each AppMan app has an `AM-updater` script that
  looks up the latest version online, compares it with the installed one, then downloads. The
  applet runs only the lookup part, in a temporary folder, so nothing is downloaded or changed.
  Versions are parsed like `appman -f` parses them.
- **Update** all apps that have updates, or a single app. The 🔒 button keeps an app at its
  current version (`appman lock`).
- **Installed apps** list: click to launch. Each row has buttons to update, reinstall
  (`appman reinstall`), lock/unlock and remove (`appman -R`, after confirmation).
- **Install** new apps by searching the AppMan database from the menu (`appman -i`).
- **AppMan tools**: full update (`appman -u`), reinstall apps whose install script changed,
  update AppMan itself (`appman -s`), clean up (`appman -c`), open the apps folder.
- **Terminal or background**: actions can open in your terminal so you see progress, or run
  silently in background (`appman -y`). In background mode the panel icon shows progress, a
  "last operation" row in the menu shows the result with the full log, and a red dot on the
  icon flags failures. You don't depend on desktop notifications, which Do Not Disturb drops.

## Update schedule

Right-click → Configure:

- Check **manually only**, **every N hours**, **daily at a set time**, or **weekly** on a day
  and time.
- Optionally catch up once after login or resume if a scheduled check was missed.
- When updates are found: show them in the panel only, send a notification with an
  "Update now" button, or install them automatically in background.

## Battery and performance

- No polling. Between checks the applet only waits on a single timer.
- Automatic checks and updates are postponed on battery, on metered connections and when
  offline. They resume on UPower or network events, not by polling.
- The app list is read directly from the app folders (about 80 ms), not with `appman -f`,
  which measures every app with `du`.
- Update checks run at low CPU and I/O priority (`nice`, `ionice`), a few apps at a time, with
  a timeout per app.
- The search database is loaded only while you type in the menu and freed when it closes.
- All file I/O is asynchronous.

If you have a GitHub token set with `appman apikey`, update checks use it, as AppMan does.

## Translations

Translations are welcome: the template is in `files/appman-manager@z3n0e/po/`. Italian is included.
