# Settings

To open the control panel, right-click the WMM icon in the panel and select **WMM Settings**.

## Options

Here you will find WMM's general options. Change the wallpaper at startup, choose the aspect mode, image effects, background color and control the slideshow. Each change is reflected in real time on the virtual monitors in the **Displays** section.

### Restart Icon
Completely restarts the engine and the control panel. Useful if the engine becomes unresponsive.

### Log Viewer Icon
Opens the debug log viewer in a separate window. Shows all engine and control panel activity in real time.

### Change wallpaper at startup
If **enabled**, the engine selects new images and regenerates the background from scratch when the computer starts.
If **disabled**, the last saved composition is preserved (ideal if you like how you left it and don't want unexpected changes).

### Distribution
Enables or disables **Spanned Mode**. When enabled, a single panoramic image is used and spread across all monitors at once.
Only available if more than one monitor is active.

### Picture aspect
Controls how the image fits inside each monitor:

- **Scaled**: The image is reduced or enlarged to fill the monitor completely **without deforming it**. If the image does not fill the whole monitor, the remaining space is filled with the selected background color or effect.
- **Zoom**: The image is scaled to cover the entire monitor. If the image and monitor have different proportions, the overflowing parts are cropped.
- **Stretched**: The image is stretched to fit exactly the monitor size, even if it becomes distorted.

### Image effect
Applies a visual effect on the image of each monitor:

- **None**: No effect.
- **Sepia**: Applies an aged, brownish tone to the image.
- **Black and White**: Converts the image to grayscale, removing colors.

### Background effect
Fills the remaining space when the image does not completely cover the monitor (only visible in Scaled mode). You have two options:

- **Blur**: Takes the image itself, blurs it and uses it as a background, creating a continuity effect.
- **Color**: Uses the solid or gradient color you have selected in the "Background color" option.

### Background color
Defines the color of the remaining space when Scaled mode is used or when a monitor has no assigned image. You have three options:

- **Solid color**: A single flat color. You can choose it with the color picker.
- **Horizontal Gradient**: A two-color gradient from left to right.
- **Vertical Gradient**: A two-color gradient from top to bottom.

### Slideshow
Enables or disables automatic image changing. When enabled, the engine changes background images according to the frequency and mode settings.

### Maximum frequency
Sets the maximum limit (in minutes) for the rotation interval. The slider control in the applet menu adjusts to this value.

### Slideshow every
Defines how many minutes the engine will wait between background image changes.

### Slideshow mode
Controls how monitors change images during the slideshow:

- **Sync**: All monitors change at once, taking an image from the same *preset* or from the general library.
- **Async**: Each monitor changes independently, on its own.

**Behavior with Favorites enabled:**
- If **"Favorites Only"** is enabled in the applet menu or in the **Favorites** section, the slideshow will exclusively use images from your **Favorites**.
- If **Sync** mode is active, rotation will only use saved presets, ignoring the rest of the library.
- If **Async** mode is active, rotation will only use saved favorites, ignoring the rest of the library.

## Favorites

Manage your favorite wallpaper combinations. You can create, load and delete presets. A *preset* is a saved wallpaper composition that you can load at any time.

### "Favorites Only" Switch
If enabled, the slideshow exclusively uses images from your saved presets, ignoring the rest of the library. If the slideshow is in sync mode, it selects a random preset on each change. In async mode, it selects individual images from the flat favorites list.

### Presets Box (left)

- **Load a preset to monitors**: right-click on the preset name and select *"Load on screens"*. The preset will be loaded in edit mode so you can view and modify it before applying.
- **Rename a preset**: slow-click on the preset name (without double-clicking). The text becomes editable. Type the new name and press Enter.
- **Delete a preset**: right-click on the preset and select *"Delete preset"*. You can also select it and press the trash button.
- **Delete an image from a preset**: right-click on the image inside the preset and select *"Delete image"*. The monitor will keep its position in the preset but without an image.
- **Open a preset image**: double-click on the image. It will open with the system's default image viewer.

### Favorites Box (right)

- **Add an image to favorites**: from the thumbnail gallery, right-click on an image and select *"Add to favorites"*. You can also add it from the Nemo file manager with the *"WMM: Add to favorites"* action.
- **Select multiple images**: you can select several images at once using **Ctrl+click** (discontinuous selection) or **Shift+click** (continuous range selection).
- **Remove an image from favorites**: right-click on the image in the list and select *"Remove from favorites"*.
- **Open an image**: double-click on the image to open it with the system's default image viewer.

### Delete buttons

Both the Presets and Favorites boxes have a trash icon button at the bottom right. This button deletes the currently selected element (a preset, an image from a preset, or an image from the favorites list). If you have multiple elements selected in the favorites list, the button will delete them all at once.

## Image Sources

From here you can add, remove and manage the folders that WMM uses to search for images. Each folder is displayed with its subfolders (if recursion is enabled) and you can control which ones are active.
In the processes and functionalities of this section **original folders or images are never deleted from disk.** Only their references in the library and their **thumbnails** are removed from the cache.

### "Add Source" Button
Opens a dialog to select a system folder. Upon selecting it:

- **Folder with subfolders**: check the *"Include subfolders (Recursive)"* box if you want WMM to also search for images inside all subfolders.
- **Folder without subfolders**: leave the box unchecked to index only the images in the root folder.
- Upon clicking **"Add"**, the folder is registered in the source list, but it is **not scanned immediately**. It is prepared to be processed.
- Thumbnails will be generated and the folder will be indexed during the **next synchronization**, which can be:
  - When you click the **"Resync"** button.
  - When you open the control panel in a new session.
  - When you force a **"Sync Library"** from the applet menu.
  - When the engine starts.
- Until one of these actions occurs, the folder will appear in the list but you will not see its images in the gallery.

### "Remove Source" Button
Removes the selected folder **from the image library.** A confirmation dialog is shown before removal. If you accept:

- The folder disappears from the source list.
- **Thumbnails are not deleted immediately.** They remain in the cache until a cleanup is performed. You can delete them in three ways:
  - Manually: by right-clicking on the folder (or subfolder) and selecting **"Delete cache"**.
  - Automatically: by clicking the **"Resync"** button (the engine detects that the source no longer exists and cleans its cache).
  - Automatically: during a maintenance cycle (library synchronization from the applet or at engine startup).

### "Resync" Button
Scans all image sources again and updates the library. You should use this button when:

- You **add or remove images** manually inside WMM's folders.
- You **change the name or structure** of subfolders.
- You want to **regenerate thumbnails** after moving or modifying images.

During synchronization, WMM traverses all active folders, detects new images, **removes thumbnails** of those that no longer exist, and updates the thumbnail gallery. Upon completion, you will receive a notification with a summary of the changes.

### Folder tree navigation

#### Double-click on a folder
Opens the folder with the system file manager so you can view its contents directly.

#### Right-click on a parent folder
Shows a context menu with these options:

- **Activate/Deactivate folder**: if deactivated, the folder and all its subfolders will stop appearing in the thumbnail gallery. Images will not be included in the slideshow. Useful for temporarily hiding a folder without deleting it.
- **Activate/Deactivate all subfolders**: applies the same state (active or inactive) to all subfolders of the selected folder. Ideal for managing folders with many subfolders at once.
- **Delete folder cache**: this option **only appears if the folder has been previously deactivated**. Deletes associated **thumbnails** to free up space.

#### Right-click on a subfolder
Shows a context menu with these options:

- **Activate/Deactivate subfolder**: controls whether images from this specific subfolder are shown in the gallery and included in the slideshow.
- **Delete subfolder cache**: deletes the **thumbnails** of this specific subfolder.

### Enable/Disable recursion
The *"Recursive"* column in the folder tree shows a switch for each parent folder. When **enabled**, WMM indexes all subfolders inside this source. When **disabled**, it only indexes the images in the root folder, ignoring subfolders.

If you enable recursion, the folder tree automatically expands to show active subfolders. If you disable it, subfolders will not disappear immediately. The change will take effect on the next synchronization (by clicking "Resync", reopening the panel, forcing a library synchronization, or at the next engine start). Until then, subfolders will remain in the gallery and slideshow.

## Displays

Your monitors are shown here as thumbnails. The section updates in real time with any change: background rotation, geometry changes, monitor power on/off, etc.

### Alignment buttons

In the section header you will find three buttons: `[` , `•` and `]`. They are used to change the horizontal alignment of the monitor block within the window:

- **`[`** : left alignment.
- **`•`** : center alignment.
- **`]`** : right alignment.

Useful when you have monitors with very different geometries and want to visually adjust the preview.

### Normal mode

In normal mode, the section shows a thumbnail of each monitor with its assigned image and a switch at the top to enable or disable it.

#### Monitor switches

Each switch has two functions:
- **Enabled**: the monitor displays its assigned image. If it has none, one will be automatically assigned based on its orientation.
- **Disabled**: the monitor is painted with the selected background color (solid or gradient) and does not participate in the slideshow rotation.

If **Spanned Mode** is enabled, the switches are locked (cannot be changed) because a single image spans across all monitors.

#### Action buttons

- **"Favorite" checkbox**: if checked, clicking **OK** will save the current composition as a new preset.
- **OK**: saves the current composition as a preset (if the checkbox is checked) or simply applies the changes to your screens. If the checkbox is not checked, no preset is saved.
- **Refresh**: refreshes the monitor view from the engine. Useful if you detect that the preview does not match reality.

### Edit mode

To activate it, press the **Edit mode** button (pencil icon). The section changes to allow you to manually assign images to each monitor.

#### Drag & Drop

You can drag any image from the thumbnail gallery and drop it onto the virtual monitor where you want to assign it. The monitor updates instantly with the new image.

#### Edit options panel

When edit mode is active, a panel appears with specific options for the composition you are creating:

- **Distribution (Spanned)**: enables or disables spanned mode for this composition.
- **Aspect ratio**: choose the adjustment mode for the images in this composition.
- **Effects**: applies an image effect (sepia, black and white) to the composition.

You can see the effect by manipulating these options in real time.
These values are saved together with the preset and take priority over the global configuration.

#### Action buttons in edit mode

- **"Favorite" checkbox**: if checked, clicking **OK** will save the edited composition as a preset (creating a new one or updating the one you loaded).
- **OK**: applies changes to the engine and exits edit mode. If the favorite checkbox is checked, it also saves the preset.
- **Refresh**: clears all monitor images, leaving them blank so you can start from scratch.

## Thumbnails

The gallery of available images. Here all images that WMM has indexed in your sources are displayed. Thumbnails are automatically generated and saved in cache for fast browsing.

### Refresh Button

To the right of the H/V buttons you will find a button with a refresh icon. By clicking it, all thumbnails in the gallery are regenerated. Useful if you have modified images outside WMM (for example, if you edited them with an external program) and want to see the reflected changes without doing a full library synchronization.

### H / V Buttons

In the section header you will find two buttons: **Horizontal** and **Vertical**. By clicking them, the gallery automatically scrolls to the first image of the selected orientation. They are a quick help to navigate the gallery without manual scrolling.

### Layout and order

Thumbnails are displayed in a mosaic that adapts to the window width. The order is fixed:

- First, all **horizontal** images.
- Then, all **vertical** images.

Within each group, images are ordered by folder (according to the order of image sources) and alphabetically within each folder.

### Interaction with thumbnails

You can interact with any thumbnail in three ways:

- **Double-click**: opens the original image with the system's default image viewer.
- **Right-click**: shows a context menu with two options:
  - *"Add to favorites"*: adds the image to the flat favorites list.
  - *"Remove from favorites"*: removes the image from the favorites list (only appears if the image is already a favorite).
- **Drag & Drop**: you can drag any thumbnail and drop it onto a virtual monitor in the **Displays** section (only in edit mode). The image will be assigned to that monitor.

### Favorite frame

Images you have added to the favorites list are visually highlighted with a green border around the thumbnail. This way you can quickly identify them while browsing the gallery.

# Favorites

The Favorites menu in the applet provides quick access to saved presets and allows you to create new ones with the current wallpaper composition.

### "Favorites Only" Switch

If enabled, the slideshow exclusively uses images from your saved presets, ignoring the rest of the library. When activated, the slideshow mode changes its behavior:

- **Sync mode**: selects a random preset on each change and applies it to all monitors simultaneously.
- **Async mode**: selects individual images from the flat favorites list and assigns them to monitors in turns.

If you activate this switch while the timer is off, the engine will automatically start it so that rotation can work.

### Add a preset

By clicking **"Add Preset Favorite"**, a small dialog opens where you can name the current wallpaper composition. WMM suggests an automatic name (e.g., *"Bookmark 01"*), but you can type whatever you want.

- **Blank name**: if you leave the field empty and press **OK**, the dialog warns you and nothing is saved.
- **Duplicate name**: if you type a name that already exists, the dialog warns you and you must choose a different one.
- **Saving the preset**: upon pressing **OK** with a valid name, the preset is automatically saved with the current configuration of all monitors, including images, aspect mode, image effect and spanned mode.

### Preset list

Below the switch and the add button, a list appears with all your saved presets. If the list is long, a scrollbar is shown for navigation.

- **Load a preset**: click on the preset name. WMM will stop the timer (if active) and apply the saved composition to the monitors immediately.
- **Delete a preset**: click on the trash icon to the right of each preset. A confirmation dialog will appear. If you delete it, the preset disappears from the list and from the flat favorites list.

# Slideshow

From this menu you can control the automatic wallpaper changing. When the slideshow is active, the engine changes images according to the interval and mode configured in the control panel.

### "Enabled / Disabled" Switch

The main switch completely turns the rotation timer on or off.

- **Enabled**: the engine starts the countdown immediately. The first image change will occur once the configured interval has elapsed (default: 15 minutes). If the interval is very short, the change can be almost instantaneous.
- **Disabled**: the timer stops. The current background is maintained without changes until you reactivate it or perform a manual rotation.

When you activate the timer from here, the control panel automatically synchronizes to reflect the change.

### Slider Control

Just below the switch you will find a slider control that allows you to adjust the change interval without opening the control panel.

- **Drag** the control to choose the minutes you want between each image change.
- While dragging, you will see the value in minutes next to the control.
- Upon **releasing** the control, the value is automatically saved and the engine updates the timer instantly.

The minimum value is 1 minute. The maximum value is defined by the **"Max Freq."** option in the control panel (default: 60 minutes).

# Displays (Rotation Mode)

This switch controls the wallpaper change mode between monitors.

- **ASYNC (One)**: each monitor changes in turns. In each rotation cycle, only one monitor receives a new image, while the others keep their current one.
- **SYNC (All)**: all monitors change simultaneously, applying a complete composition at once.

Switching between modes is immediate and does not restart the timer.

# Spanned Mode

Enables or disables the spanned wallpaper mode. When enabled, a single panoramic image spans across all monitors, covering the entire canvas. This option only takes effect if more than one monitor is active.
The application of spanned mode is immediate.

When enabled, individual monitor switches in the Control Center are locked (cannot be changed), as the image is common to all.

# Sync Library

This option forces a complete scan of all configured image sources. WMM traverses active folders, detects new images, removes references to images that no longer exist, and updates the thumbnail gallery.

Upon completion, you will receive a notification summarizing the changes (number of new and deleted images). Useful after manually adding or removing images from WMM's folders.

# Keyboard shortcuts

You can to force wallpaper rotation without using the mouse, you can set up a custom keyboard shortcut on your desktop. WMM includes a small script ready for this purpose.

## On Cinnamon

1.  Open **System Settings → Keyboard → Keyboard shortcuts**.
2.  Click **Add custom shortcut**.
3.  Name it **"WMM - Change Wallpaper"**.
4.  In the **Command** field, enter:

    `bash -c "bash $HOME/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh"`

5.  Assign your preferred key combination (for example, `Ctrl+Alt+N`).
6.  Click **Accept** and test the shortcut.

## On GNOME

1.  Open **Settings → Keyboard → Custom shortcuts**.
2.  Click **"+"** to add a new one.
3.  Name it **"WMM - Change Wallpaper"**.
4.  In the **Command** field, enter:

    `bash -c "bash $HOME/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh"`

5.  Assign your preferred key combination (for example, `Ctrl+Alt+N`).
6.  Close the window and test the shortcut.

**Note:** The `wmm-next.sh` script is installed automatically with WMM and should have the correct execution permissions. If the shortcut does not work, make sure the script is executable:

    **On Gnome**

    `chmod +x ~/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh   # for GNOME`

    **On Cinnamon**

    `chmod +x ~/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh # for Cinnamon`

# Help

Opens the WMM help window, where you will find detailed information about all program features. The window has a navigation index on the left and formatted content on the right.
