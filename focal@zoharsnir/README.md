# Focal - Cinnamon applet

- [Focal - Cinnamon applet](#focal---cinnamon-applet)
  - [Screenshots](#screenshots)
  - [Why this exists](#why-this-exists)
    - [What this is not](#what-this-is-not)
    - [Privacy](#privacy)
  - [How to use it](#how-to-use-it)
    - [What should the text be?](#what-should-the-text-be)
    - [In Direct mode](#in-direct-mode)
    - [In Calendar mode](#in-calendar-mode)
    - [Integration (reference only)](#integration-reference-only)
  - [Layout](#layout)
  - [Contributing translations](#contributing-translations)
  - [Install (for local testing)](#install-for-local-testing)
    - [Clone and install](#clone-and-install)
    - [Update and reload after code changes](#update-and-reload-after-code-changes)
  - [License](#license)

A simple panel text label you set yourself (optionally with a color) or point at your system calendar to show whatever event you're currently in.

## Screenshots

Panel, Direct mode and Calendar mode:

![Panel - Direct mode](screenshots/Panel-Direct-Mode.png)
![Panel - Calendar mode](screenshots/Panel-Calendar-Mode.png)

Popup, Direct mode and Calendar mode:

![Popup - Direct mode](screenshots/Popup-Direct-Mode.png)
![Popup - Calendar mode](screenshots/Popup-Calendar-Mode.png)

Context menu:

![Context menu](screenshots/Context-Menu.png)

Settings:

![Settings](screenshots/Settings.png)

## Why this exists

Most focus tools try to block distraction. This one just asks you to deliberately name what you're going to do now, and displays it in an always-visible location on your screen.

The idea, borrowed from Deep Work (A great book by Cal Newport): the moment you have to write down "what I'm doing right now" somewhere visible, it gets harder to drift without noticing. Not because the text is hard to change - it's actually deliberately easy to change, one hotkey away - but because changing it is a small, conscious act. You're not sneaking off task, you're deciding to change your stated focus. That tiny bit of low-friction honesty is the whole feature.

You can set (or change) your current focus two ways:

- **Directly**, on the fly (default mode):
  - Hit the hotkey (or click the panel text)
  - Type what you're doing
  - Optionally pick a color
  - Hit Enter
- **From your calendar** - point it at a personal, low-detail calendar where blocks are just named "writing X", "deep work", "read e-mails", etc. The applet shows whatever block you're in right now, and says "No active event" the moment you're not in one (or "No active or upcoming events" if you've also enabled the upcoming-event preview and there's nothing left today either).
  Ideally it's not your main, external/corporate/detailed calendar - it needs to be really "yours". You need to feel completely free to change it as soon as you decide to change your focus.

  One thing worth keeping in mind: if two or more events on that calendar overlap, only one of them will show, and it's not defined which - so for predictable behavior, keep this particular calendar overlap-free.

Either way, the panel only ever shows your current focus - not your whole day, not what's coming up (unless you turn that on explicitly as a dimmed "upcoming" preview) - **just an honest, always-visible answer to "what should I be doing right now?"**

### What this is not

- This is not a todo / task management app
- It doesn't change your calendar in any way

### Privacy

No data collection, no telemetry, no external network calls of any kind. In Calendar mode, the only (local) network communication is `calendar_helper.py` querying your system calendar (EDS) locally on your machine. The only things saved to disk are your applet settings and your current focus line/color, via Cinnamon's standard local settings storage - so it survives a restart, and nothing else is persisted or sent anywhere.

## How to use it

The steps below describe one way to use Focal - the suggested one - but the applet itself is generic: it just shows text, however you decide to set it.

### What should the text be?

The same guidance applies in both modes - in Calendar mode, this is what your event titles should look like. Keep it **short and about the goal, not the steps**: "monthly report" is shorter and less daunting than "type the numbers into a spreadsheet, verify them, add formulas...". If you need to show a subset of a bigger goal, something like "monthly report - information collection" works fine. This isn't about granularity - you have other systems for that. It's about deciding what you're focusing on right now, and staying honest with yourself about it.

### In Direct mode

The default, and probably the better starting point for most people.

- **Decide** what you want to focus on.
- **Click** the panel text (or hit the hotkey).
- **Just start typing** - the box is already focused and preselected, no need to click into it or clear the old text first.
- (Optionally change the text and/or background color too.)
- **Hit Enter.**

Then go focus on the thing you just said you're focusing on. If you stray, either get back to it or make a conscious decision to shift focus - and update the text to match. It's your time. You decide what you do with it. You're also free to change your mind. The only ask is that the text stays true so you're honest with yourself.

### In Calendar mode

Plan your day (or whatever cycle you work in) ahead of time in your system calendar, naming the blocks the way described above. This calendar is yours alone - not a list of commitments to anyone, not even to yourself - just a plan for how you intend to spend your time, one you're free to revise later. (If you already use the system calendar for other things, it's worth creating a separate calendar just for this and pointing Focal at it in Preferences.)

Your events then show up on the applet as you move through them. If you stray, or plans just change, same principle as Direct mode: resist and get back on track, or make a conscious decision to change your plan and drag the blocks around in the calendar to reflect it.

### Integration (reference only)

It is possible to integrate with Focal and update its Focal text (or other settings) when in Direct mode.

While this is outside the scope of Focal's features, the example below is added for reference in case in case someone finds it useful. One use case is running some arbitrary command that outputs a single line (i.e. external IP, service status) on an interval and have it update Focal to have it always displayed on your panel.

The below command updates the Focal text to 'YOUR TEXT HERE' and refreshes the extension so the updated text is reflected immediately:

```bash
dbus-send --session --dest=org.Cinnamon --type=method_call /org/Cinnamon org.Cinnamon.Eval string:"let a = imports.ui.appletManager.getRunningInstancesForUuid('focal@zoharsnir')[0]; a.settings.setValue('custom-text', 'YOUR TEXT HERE'); a._refresh();"
```

## Layout

- [`metadata.json`](metadata.json) - applet identity/version info Cinnamon reads.
- [`applet.js`](applet.js) - panel label, popup (text entry + color swatches),
  hotkey registration, and calendar polling loop.
- [`settings-schema.json`](settings-schema.json) - backs the applet's
  Settings screen (mode switch, colors, calendar selection, poll interval, hotkey).
- [`helper/calendar_helper.py`](helper/calendar_helper.py) - standalone
  script that talks to Evolution Data Server (EDS) directly via
  gobject-introspection and prints JSON. Called by `applet.js` as a
  subprocess rather than wiring up DBus calls inline, so it's independently
  testable from a terminal.
- [`stylesheet.css`](stylesheet.css) - popup entry/swatch styling.
- `icon.png` - applet icon shown in Cinnamon's Applets list.

## Contributing translations

User-facing strings are wrapped for translation via gettext (`po/` holds the translation files). To generate/update the translation template or test a translation locally, you need the upstream [`cinnamon-spices-makepot`](https://github.com/linuxmint/cinnamon-spices-applets) tool, which requires the `polib` Python package:

```bash
sudo apt install python3-polib
```

Not required for installing, using, or non-translation touching development. Only for working on translations.

## Install (for local testing)

❗ Don't copy paste blindly. Read the comments and edit as needed ❗

### Clone and install

```bash
# Clone (only needed once)
git clone https://github.com/zoharsnir/cinnamon-focal-applet.git
cd cinnamon-focal-applet

# Install
mkdir -p ~/.local/share/cinnamon/applets/focal@zoharsnir
cp -r * ~/.local/share/cinnamon/applets/focal@zoharsnir/

# Add to panel
# 👉 GUI: Right-click panel -> Applets -> enable "Focal"
```

### Update and reload after code changes

```bash
# Optional:  uncomment next line to delete user setting
# rm -rf ~/.local/share/cinnamon/applets/focal@zoharsnir

# Delete, recopy
rm -rf ~/.local/share/cinnamon/applets/focal@zoharsnir
mkdir -p ~/.local/share/cinnamon/applets/focal@zoharsnir
cp -r * ~/.local/share/cinnamon/applets/focal@zoharsnir/

# Reload - use only one by uncommenting it
## Reload applet (fastest)
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'focal@zoharsnir' string:'APPLET'
## Reload cinnamon (a bit more extreme but needed. Equivalent to Alt+F2, r, Enter)
#gdbus call --session --dest org.Cinnamon --object-path /org/Cinnamon --method org.Cinnamon.Eval "global.reexec_self();"
```

## License

[GPL-3.0-or-later](LICENSE).
