# Desktop Drawer

Open everyday files from your Cinnamon panel. Choose a folder, then browse it
with a click or a short hover. Subfolders open inside the menu, and files open
with their usual desktop application.

![Desktop Drawer with a project folder open](screenshot.png)

## Start here

1. Add Desktop Drawer to your panel using Cinnamon's Applets settings.
2. Open the drawer and select **Choose folder**.
3. Select the folder you want nearby, such as your notes or current project.

If you leave the folder unset, the drawer uses `Organized Desktop` inside your
Desktop folder when it exists. Otherwise it uses your Desktop. The heading
shows the folder you are browsing. **Open folder** opens it in your file manager.

## Controls

Click the panel icon to open or close the drawer. Hover opens it after 300
milliseconds by default. In settings, turn **Open menus on hover** off for
click-only use, or adjust the delay for the panel icon.

Use the arrow keys to move through an open menu. Right opens a subfolder,
Left closes it, Enter activates the selected item, and Escape closes the menu.
Cinnamon follows the corresponding direction for languages written right to left.

## What appears in the drawer

The drawer refreshes when you reopen it. Subfolders load when you first open
them. It shows up to 30 visible entries per folder and browses three folder
levels. For larger or deeper folders, use **Open folder** or **Open this folder**
to see everything in your file manager.

Hidden files are omitted. Directory symlinks are not expanded. The scan stops
after 300 entries so a folder with many hidden files cannot keep it busy
indefinitely. Large folders show a notice when the scan limit is reached;
the menu is a short view of the folder, not a complete file listing.

Folders named `Private`, ignoring capitalisation, stay closed in the drawer.
**Open Private folder** opens them in your file manager instead. This also
applies inside subfolders and when Private is the selected root. It is a
convenience for keeping filenames out of the menu, not encryption or access control.

## Troubleshooting

**Cannot read this folder:** choose another folder or check that the selected
folder still exists and is readable. For a disconnected drive, reconnect it
and reopen the drawer.

**No files to show:** the folder is empty or contains only hidden files. Open
it in your file manager to check.

**Could not open this item:** check its default application in your file manager.
The applet reports the failure without recording the filename in the Cinnamon log.

## Privacy and requirements

Desktop Drawer uses Cinnamon's built-in libraries. It has no account, telemetry,
or extra runtime downloads. It does not move, rename, edit or delete files.
Cinnamon stores the selected folder and settings in your user profile. Browsing
a network-mounted folder can involve that filesystem's network connection.

The candidate has been tested on Cinnamon 6.0.5 with X11. Other Cinnamon versions,
Wayland, assistive technology and different display scales still need user testing.

## Remove it

Right-click the panel icon and select **Remove**. Your files stay where they are.
For a manual installation, remove its `desktop-drawer@linux-automations` directory
from `~/.local/share/cinnamon/applets/` after removing it from the panel.

## Report a problem

Include your Cinnamon version, Linux distribution, steps to reproduce, and what
you expected. Use demo filenames in screenshots. The source package includes
`BETA-CHECKLIST.md` for a short test session.

## Licence

Copyright (C) 2026 TitasDas. Desktop Drawer and its original artwork are licensed
under GPL-3.0-or-later. See `COPYING.md` for scope and `LICENSE` for the full text.
