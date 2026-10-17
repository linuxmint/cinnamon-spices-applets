# Desktop Drawer

Enjoy your wallpaper. Keep your files within reach.

My desktop fills up with downloads. A messy desktop makes it harder for me to
focus. I built this drawer to keep my files handy after tidying them into folders.

Browse a chosen folder from your Cinnamon panel. Open files in their usual apps.
You organise the files yourself. The drawer does not move or delete them.

![Desktop Drawer browsing a project folder](screenshot.png)

## Setup

1. Add Desktop Drawer from Cinnamon's Applets settings.
2. Open the drawer. Select **Choose folder**.
3. Pick the folder you want to browse.

Leave the setting empty to use your Desktop. If it contains an `Organized Desktop`
folder, the drawer uses that instead.

## Controls

Click or hover over the panel icon. Use the arrow keys to browse.
**Enter** opens an item. **Escape** closes the menu.
**Open folder** opens your file manager.

Use **Choose folder** to change folders or adjust hover settings.

## Limits

- Shows up to 30 entries per folder and three folder levels.
- Skips hidden files. Does not expand directory symlinks.
- Stops scanning after 300 entries. Use your file manager for the full listing.
- Folders named `Private` stay closed in the drawer, regardless of capitalisation.
  You can still open them in your file manager. This is not a lock or encryption.

## Troubleshooting

If a folder is unavailable, reconnect its drive or choose another folder.
If a file will not open, check its default app in your file manager.

To remove the drawer, right-click its panel icon and select **Remove**.
Your files stay where they are.

## Requirements and privacy

Uses Cinnamon's built-in libraries. No account, telemetry or runtime downloads.
Cinnamon saves settings locally. Network-mounted folders use their own connection.

Tested on Cinnamon 6.0.5 with X11. Other versions, Wayland and assistive technology
still need testing.

## Licence

Copyright (C) 2026 TitasDas. GPL-3.0-or-later.
Full terms and artwork attribution are included with the applet.
