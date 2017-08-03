Changelog

### 2.0.2

  * Fixed an error occurring when favorites change before the menu has been opened for the first time.
  * Improved signal management.

### 2.0.1

  * Changed the default column count to 4.
  * Improved the context menu positioning.

### 2.0.0

  * Reorganized the layout for more efficient use of space.
    * Search box has been moved to the bottom right corner.
    * Selected app box has been moved to bottom left column.
  * Added settings from the default menu that were missing.
    * Translations for these were added from CinnVIIStarkMenu's PO files.
  * Added an option to display the description on each app button.
  * Added a user account button showing the current user's avatar.
  * Added key navigation.
  * Added a "Clear List" button for recent files.
  * Renamed the Recent category to Recent Files.
  * Descriptions now scroll horizontally if they are truncated.
  * Faster fuzzy searching.
    * Searches now highlight the matching characters in item names and descriptions.
  * Added filesystem path entry autocompletion based on the Cinnamon menu's code.
  * Added highlighting for newly installed apps.
  * Formatted the settings using the layout API.
  * Removed a lot of stale/dead code from the Gno-menu project, and refactored a lot of the button handling.
  * Removed automatic icon scaling.
  *  Fixed Opera bookmarks.
  * Fixed the missing gda library error message.
  * Improved performance. (YMMV)

### 1.3.1

  * Removed extra tooling causing performance issues.
  * Fixed some Clutter errors occurring when adding/removing favorites.

### 1.3.0

  * Moved the Favorite Apps category to the bottom of the category list.
  * Added a feature allowing you to evaluate math expressions from the search field.
  * Fixed various CJS warnings.

### 1.2.1

  * Fixed the application list view having excessive width.
  * Refined the width for the grid at all column counts.
  * Fixed the search box height for some themes.
  * Made the applet compatible for Cinnamon Git.

### 1.2.0

  * Added ability to toggle bookmarks
  * Increased the resolution of the applet icon
  * Category buttons are now deactivated while searching
  * Translation file restructuring thanks to [NikoKrause](https://github.com/linuxmint/cinnamon-spices-applets/pull/247)
  * Test bug fix for users encountering the menu not displaying when clicked
  * Fixed the menu expanding in height and width when toggled open, and expanding beyond its allocated dimensions

### 1.1.0

  * Improved the applet's memory consumption.
  * Search results now appear in their order of relevance, not by their type.
  * Search functionality now uses fuzzy search via [Fusion-JS](https://github.com/bulicmatko/fusion-js).

### 1.0.0

  * Reimplemented the context menu.
  * Overhauled theme compatibility.
  * Added a (default) option to scale grid icons based on how many apps are in the list to make the best use of the screen space.
  * Porting from GNOME Shell is complete, and most of the functionality is restored from the original version.
  * Migrated most of the styling to Cinnamon's CSS.
  * Todo:
    * Add keyboard support.
    * Clean up and organize existing localization files, and add new translations.