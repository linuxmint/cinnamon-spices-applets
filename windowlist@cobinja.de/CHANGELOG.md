Changelog

2.7
==
- Add support for launching desktop file actions
- Show places in nemo's context menu

2.6.1
==
- Don't show "Visible on all workspaces" if there is only one workspace

2.6
==
- Switch styling to the one also used by the builtin grouped window list
- Add flashing effect for windows that demand attention

2.5.2
==
- Fix: the number badge grew when showing after being hidden

2.5.1
==
- Fix: the last window on an applet instance left the number label on the icon

2.5
==
- Allow Drag'n'Drop operations from one window to another
- Better monitor naming for moving windows around
- Adjust thumbnail position so that the title/name is at the top of the menu

2.4
==
- Switch to Cinnamon 4.0 as main supported version

2.3.1
==
Bugfix
--
- Fix preview sizes for HighDPI mode

2.3
==
New Feature
--
- add setting to enable/disable opening of the preview menu

Bugfixes
--
- Fix grouping/ungrouping not taking effect
- Fix for the setting "Only on this monitor"
- Fix non-showing borders at certain panel heights

2.2
==

New Features
--
- improve preview size management
- add option for click-opening the preview menu

Bugfixes
--
- Fix for height of preview menu in vertical panels
- Fix size issues in HiDPI-mode

2.1
==

New Feature
--
- add ability to receive launchers from the menu via their context menu

2.0
==

New Features
--
- Added pinning per workspace
- Add ability to only show windows that are present on the same monitor as the applet
- Shrink thumbnails when too many windows are open

Bugfixes
--
- Fix after StBoxLayout was switched to ClutterBoxLayout (Necessary on future versions of Cinnamon, won't break on Cinnamon 3.2)
- Fix some windows like Spotify not showing (Fixes #1230)

Various
--
- Update pot-file and German translation
- Added tooltips to some settings
- Use the new handleDragOut method to delete the drag placeholder (Will only work on future versions of Cinnamon, won't break on Cinnamon 3.2)
