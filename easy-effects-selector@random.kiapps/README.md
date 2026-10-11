# EasyEffects Preset Selector

Select locally saved **EasyEffects 7.2.3 output presets** from the Cinnamon panel.
Publisher: **random.kiapps**. Interface languages: English and German.
Version: **1.5.2**.

## Requirements

- Cinnamon. The applet uses the Cinnamon 6.4 API and has been developed for LMDE 7.
- The distribution's native EasyEffects **7.2.3** package, with its GSettings schemas and `easyeffects` command.
- Local output presets saved in EasyEffects.

This applet is specifically for that EasyEffects version. Flatpak and Libportal
builds use a different autostart mechanism and are not supported. Compatibility
with EasyEffects 8 or later has not been established.

## Manual installation and translations

Copy the complete `files/easy-effects-selector@random.kiapps` directory to
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

Left-click the EasyEffects icon to select an output preset. The list refreshes
each time the menu opens. Names remain unchanged. Unassigned presets are sorted
alphabetically; presets assigned to quick selection follow at the bottom in
Top, Middle, Bottom order. A separator divides the groups when both contain
available presets.

### Quick selection

Right-click the icon and choose **Configure**. Under **Quick selection**, assign
up to three presets with **Preset at top**, **Preset at middle** and **Preset at
bottom**. Any position can remain empty. Assigning presets does not load them or
change audio settings, including at applet startup. A previous default-preset
setting is retained as the bottom assignment when upgrading.

The **single blue dot confirms a matching preset**. It appears at the right edge
of the icon, at the assigned top, middle or bottom position. Agreement requires
the loaded preset name and its saved output configuration to match: ordered
effect instances, stored effect parameters and the output application blocklist.
Parameters of disabled effects are included; extra disabled or neutral effects
still prevent agreement. Missing individual values use EasyEffects' defaults.
The comparison stops at the first difference.

The dot disappears after a relevant edit and returns after exact restoration.
An unassigned preset has no dot, even if its settings are identical to an assigned
preset. There is no separate deviation indicator. The optional tooltip details
show the current preset and, when it matches, its assigned position. The position
detail starts disabled.

With **Switch quick-selection presets with mouse wheel** enabled under **Controls**, the mouse
wheel over the panel icon cycles through the available assigned presets. This
option starts disabled. Down advances Top → Middle → Bottom → Top; up reverses the
order. Empty positions and missing files are skipped. From an unassigned preset,
down starts at the first available position and up starts at the last. Preset
loading uses the same native output-loading path as the menu. Rapid wheel events
retain the last requested choice while the current load finishes. The menu is
not opened or closed by scrolling. The dot is hidden while loading and reappears
only after the resulting preset has been verified.
Disabling wheel selection cancels a queued destination while the current load
finishes. Re-enabling the option does not load anything. Menu selection remains
available with wheel selection disabled.

The three dropdowns keep names already chosen in another position visible but
disabled. Reassigning or clearing a position makes its previous preset available
again. The current position's own choice remains available.
Unavailable saved names remain visible in settings so they can be reassigned.
If imported settings contain duplicate assignments, the first position takes
precedence. Without assignments, scrolling does nothing and the additional
effect observation is disabled.

### Menu and bypass

Under **Controls**, the **Launch Easy Effects from the menu** switch makes the **Easy Effects** menu
title clickable: clicking it runs `easyeffects`. With the switch off, the title
is only a heading.

**Toggle bypass in menu** is available with menu launch enabled. Its saved choice
is retained while the control is disabled.

A new installation disables title launch and menu bypass control. Upgrades
preserve existing preferences. Changing these controls does not launch
EasyEffects or change its bypass state.

**Toggle bypass with middle click** is independent and on by default. When
enabled, middle-clicking the panel icon toggles global bypass with menu controls
enabled or disabled, without opening or closing the preset menu.

The independent **Keep menu open after preset selection when bypass is active**
option is on by default. When enabled, selecting a preset with active bypass
leaves the menu open, for mouse and keyboard selection. It works with title launch,
menu bypass control and middle-click control enabled or disabled. With bypass off,
preset selection closes the menu normally.

The five compact controls follow this order: title launch, menu bypass,
middle-click bypass, keep menu open, and mouse-wheel preset selection. Only menu
bypass depends on title launch.

**Global bypass is visible directly in the panel.** Bypass dims the base icon to
30% opacity, following Blueman's bundled disabled symbolic icon. Bypass off
restores full opacity. The applet remains clickable and any blue point keeps
its full color and opacity. Bypass does not affect the point position or either
preset marker. The optional bypass tooltip detail reports active bypass, also
without any assignments.
The base icon updates immediately with the menu closed or during preset loading.

The optional menu bypass button appears only with title launch and menu bypass
control enabled. Its highlighted state means bypass is on; clicking it toggles
bypass and keeps the menu open. The title separator is always present.

The white menu marker follows an unchanged preset selection. Every exactly
matching assigned preset regains its marker after restoration. Editing an
unassigned preset removes its marker; manually restoring it does not bring that
marker back. Selecting it again in this applet does. With no assignments, the
menu retains name-based selection without additional effect observation.

EasyEffects 7.2.3 has no separate preset-load completion event. Reloading the same
unassigned preset externally after editing can leave its menu marker absent:
unchanged preset-name writes do not emit a cross-process dconf event. Selecting
it in the applet restores its marker; assigned-preset comparison is unaffected.

### Tooltips

The separate **Tooltips** category contains **Show tooltips**, which enables hints
for the panel icon and the menu bypass button.
Under this switch, choose which panel details to show: **Preset name**,
**Quick-selection position**, **Changed settings**, **Bypass status** and
**Comparison errors**. The main switch, preset name, changed settings and
comparison errors start enabled; quick-selection position and bypass status
start disabled. Upgrades retain the saved choices. Disabling tooltips dims the
detail controls and retains their saved choices.

The first line uses the short **Preset:** prefix. Other enabled details appear
only when relevant. With every panel detail disabled, the panel has no tooltip.
Loading status belongs to the preset-name detail and also respects the main
switch. These preferences change only the hints.

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

### Keep bypass on output-device changes

**Keep bypass when changing output devices** starts **disabled**. Installing,
adding or starting the applet does not install a route or change device preferences.
Enabling this option sets up a fixed stereo output for native EasyEffects 7.2.3,
based on the route tested with PipeWire 1.4.2 and WirePlumber 0.5.8.
It prevents output-device changes from making EasyEffects turn global bypass off.
The current input device is kept fixed as in the tested setup: following default
input changes could otherwise also reset global bypass, for example when a
Bluetooth headset connects. The previous input preferences are saved as well.

Switching the option briefly restarts the audio services and a running
EasyEffects service; playback may be interrupted and the EasyEffects window
closes. A stopped EasyEffects service remains stopped. The previous bypass state
is retained. This option does not prevent EasyEffects from clearing bypass for
other reasons, such as changing its effect list or input device.

The virtual **Preset Selector – Fixed output** stays selected in EasyEffects.
**Preset Selector – Forwarding** follows the system's selected output device.
The forwarding stream uses the same readable name in the application list and
in the exclusions; the German name is **Preset Selector – Weiterleitung**.
Its actual saved identity is retained across session and language changes.
The applet keeps exactly one forwarding entry in EasyEffects' output application
blocklist, including after preset loads made in EasyEffects itself. Old entries
for `ee_route_playback` are replaced on explicit activation. Manual exclusion is
not required. Only the managed forwarding identities are ignored by preset
comparison while the route is installed; other exclusions and effect settings
still count. Preset files are not modified.

The switch reflects the current managed configuration and the actual EasyEffects
device preferences, rather than only the last successful setup. It is updated
when those preferences or routing files change and when EasyEffects restarts.
An unchanged reinstall of the supported native package retains the setup.
Resetting EasyEffects to automatic device selection, deleting the managed route
or installing an unsupported version is detected and shown as inactive. Status
checks do not recreate files, change device preferences or restart audio.
The forwarding stream remains excluded while an owned route still exists.
Explicitly enabling the option again repairs a reset setup while retaining the
original preferences needed for removal.

Disabling restores the earlier EasyEffects output and input preferences unless
a different device was selected in the meantime, removes the managed route,
and removes the forwarding identities from the blocklist. Unrelated exclusions
are retained. The exact previously tested manual `90-ee-route.conf` can be
adopted; its original contents are saved for recovery. If EasyEffects already
used that manual route, disabling returns it to the system's default output.
Other configurations and externally edited route files are left unchanged,
and a failed setup attempts to restore the previous state.

Both enabling and disabling retain the bypass state immediately before the
operation. Restoration waits for device discovery and checks for delayed bypass
resets during EasyEffects startup. This bounded operation finishes with setup
or removal; it does not continually override later bypass changes.

The configuration lives in
`$XDG_CONFIG_HOME/pipewire/pipewire.conf.d/90-ee-route.conf`. Recovery information
is kept in `$XDG_CONFIG_HOME/easy-effects-selector@random.kiapps/`.
The route persists across Cinnamon reloads and login sessions. When upgrading
from the 1.5.1 test version, an active route is read without restarting audio. Switch the option
off and on once to apply its new readable name. Disable this option before
removing the applet if the route should also be removed.
Select physical output devices through the desktop's sound controls while it
is active; choosing another output directly in EasyEffects leaves the fixed
route and is reflected in the option's status. Device-specific EasyEffects
preset autoload rules for physical outputs do not apply to the fixed output.

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
a file** in its settings menu. After importing older settings, assign the desired
presets under **Quick selection**. EasyEffects' presets and application settings
are independent of the applet identifier.

## License and support

GNU General Public License, version 3 or later. See the bundled `LICENSE` and
`NOTICE.md` for the EasyEffects icon and parameter-map attribution.

Report problems in the Cinnamon Spices applets repository with a title starting
with `EasyEffects Preset Selector:`. Include your Cinnamon and EasyEffects
versions, distribution, reproduction steps, and the expected result.

This applet is maintained independently of the EasyEffects project.
