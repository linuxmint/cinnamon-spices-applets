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

The default-preset explanation uses the same dimmed style as the title controls'
help text. There is no separator between the default selector and its explanation;
the separator before the menu controls remains visible.

The **Launch Easy Effects from the menu** switch makes the **Easy Effects** menu
title clickable: clicking it runs `easyeffects`. With the switch off, the title
is only a heading.

The **Toggle bypass in menu** switch below it is available only with application
launch enabled. It remains visible and dimmed when launch is disabled; its saved
choice is retained, including across restarts. The native switches align with
the switches in the EasyEffects section. The shared explanation follows them.

The dependent **Keep menu open after preset selection when bypass is active**
switch is available only when menu bypass control is enabled. It is off by
default. When enabled, selecting a preset leaves the menu open if global bypass
is active at the time of selection, so the bypass button remains accessible.
This works with mouse and keyboard selection. Otherwise the menu closes as
usual. The choice remains saved when either parent switch is disabled.

A new installation enables application launch and menu bypass control. An upgrade
preserves existing preferences, including the three choices from version 1.4.5.
Changing these controls does not launch EasyEffects or change its bypass state.

The **global bypass button** uses EasyEffects' normal global bypass. Its
highlighted state means bypass is enabled. With menu control enabled, clicking
it toggles bypass and keeps the menu open. Without menu control, active bypass
still appears as a highlighted, insensitive status button; when bypass is off,
that status button is absent. This also applies to a title without application
launch. A status button cannot toggle bypass, launch EasyEffects, or close the
menu. The button updates immediately when bypass changes in the EasyEffects
window, with or without a default preset. The title separator appears in all
title configurations.

With a default selected, the **blue dot** appears if the loaded output preset
name is different, the stored output configuration differs, or global bypass is
enabled. Agreement requires the same name, ordered effect list and instances,
stored effect parameters, and output application blocklist. Parameters of
bypassed effects are included. The comparison describes the preset configuration,
not whether two configurations sound alike. Missing individual values use the
EasyEffects settings defaults. The comparison stops at the first difference.

The menu marker follows these rules when a default is configured:

- An exact default preset is marked, including after a manual restoration.
- An unchanged selection of another preset can be marked, while the blue dot indicates deviation from the default.
- Editing another selected preset removes its marker. Manually restoring its values does not restore that marker; selecting it again in the applet does.
- Global bypass does not change preset markers or count as a preset edit. Its status updates independently of preset comparison and selection. It still lights the blue dot; an exact default can therefore show both dots at once.

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

The hints recommend enabling service autostart and disabling shutdown on window
closing, so the service remains available in the background. The action words
are bold in the theme's normal text color; the explanations are dimmed.

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
