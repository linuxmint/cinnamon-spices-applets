# EasyEffects Preset Selector

Select locally saved **EasyEffects 7.2.3 output presets** from the Cinnamon panel.
Publisher: **random.kiapps**. Interface languages: English and German.

## Requirements

- Cinnamon. The applet uses the Cinnamon 6.4 API and has been developed for LMDE 7.
- The distribution's native EasyEffects **7.2.3** package, with its GSettings schemas and `easyeffects` command.
- Local output presets saved in EasyEffects.

This applet is specifically for that EasyEffects version. Flatpak and Libportal
builds use a different autostart mechanism and are not supported. Compatibility
with EasyEffects 8 or later has not been established.

## Manual installation and translations

Copy the complete `easy-effects-selector@random.kiapps` directory to
`~/.local/share/cinnamon/applets/`. For a manual installation, compile and install
the translation catalogs as well:

```bash
cinnamon-xlet-makepot --install "$HOME/.local/share/cinnamon/applets/easy-effects-selector@random.kiapps"
```

Close the applet settings window and restart Cinnamon after installing the
catalog. In an X11 session, press `Alt+F2`, type `r`, and press Enter; otherwise
log out and back in. German sessions then show the translated settings and
tooltip. English is the fallback when a translation catalog is not installed.

## Using the applet

Left-click the EasyEffects icon to select an output preset. The list is refreshed
each time the menu opens. Preset names are kept unchanged and sorted
alphabetically. A configured default preset is placed at the bottom.

Right-click the icon and choose **Configure** to select a default preset.
Selecting a default only sets a reference: it does not load anything, including
at applet startup. To return to the default, select it in the left-click menu.

The optional **Launch EasyEffects from the menu title** switch makes the
**Easy Effects** title at the top of that menu clickable. Clicking it runs
`easyeffects`, using the application's normal startup behavior. This switch
is off by default.

With a default selected, the **blue dot** appears if the loaded output preset
name is different, the stored output configuration differs, or global bypass is
enabled. Agreement requires the same name, ordered effect list and instances,
stored effect parameters, and output application blocklist. Parameters of
bypassed effects are included. The comparison describes the preset configuration,
not whether two configurations sound alike. Missing individual values use the
EasyEffects settings defaults. The comparison stops at the first difference.

The menu marker follows these rules when a default is configured:

- Blue dot off: the default preset is marked, including after an exact manual restoration.
- Blue dot on: the default is not marked. An unchanged selection of another preset can be marked.
- Editing another selected preset removes its marker. Manually restoring its values does not restore that marker; selecting it again in the applet does.
- Global bypass removes all menu markers.

EasyEffects 7.2.3 has no separate preset-load completion event. Reloading the same
other preset in the EasyEffects window after editing it can leave its menu marker
absent. Selecting it again in this applet restores the marker. Default comparison
works independently of this limitation.

Without a configured default, the blue dot is disabled and the menu marks the
last loaded preset name. The additional effect observation is disabled.

## EasyEffects options

The settings window also provides **Launch Service at System Startup** and
**Shutdown on Window Closing**, using EasyEffects' existing settings. Neither
option is changed just by adding or starting the applet.

Autostart uses `$XDG_CONFIG_HOME/autostart/easyeffects-service.desktop`, normally
`~/.config/autostart/easyeffects-service.desktop`. EasyEffects only refreshes its
own autostart switch when its settings window is reopened. Shutdown on window
closing synchronizes in both directions immediately.

## Local presets and input protection

The menu reads `$XDG_CONFIG_HOME/easyeffects/output`, normally
`~/.config/easyeffects/output`. Import community presets into EasyEffects first.
Only JSON files directly inside the local output directory appear.

The applet uses EasyEffects' native preset-loading command and checks the active
output preset afterward. When an input preset has the same name, a temporary
unique output copy prevents the EasyEffects 7.2.3 command from loading the input
preset instead. The temporary copy is removed afterward. Original presets are
not rewritten.

## Upgrading the earlier local applet

The earlier test version used `easy-effects-selector@local`. The published
identifier is `easy-effects-selector@random.kiapps`, so Cinnamon treats it as a
separate applet.

Before switching, use Cinnamon's **Export to a file** in the old applet's settings
menu. Remove the old applet from the panel, add the new one, and use **Import from
a file** in its settings menu. Keep the settings keys unchanged when importing.
Alternatively, choose the default preset again in the new applet. EasyEffects'
presets and application settings are independent of the applet identifier.

## License and support

GNU General Public License, version 3 or later. See the bundled `LICENSE` and
`NOTICE.md` for the EasyEffects icon and parameter-map attribution.

Report problems in the Cinnamon Spices applets repository with a title starting
with `EasyEffects Preset Selector:`. Include your Cinnamon and EasyEffects
versions, distribution, reproduction steps, and the expected result.

This applet is maintained independently of the EasyEffects project.
