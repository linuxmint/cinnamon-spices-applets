### Meta-stuff
Xlets are a generic term for Cinnamon applets, desklets and extensions. Most rules
here apply to any of these types. Rules specific to a type will be noted as such.

Use the repo's name to determine the type of xlet being reviewed:
- cinnamon-spices-applets is for applets
- cinnamon-spices-desklets is for desklets
- cinnamon-spices-extensions is for extensions
### end of meta-stuff

# Cinnamon Spices Xlets - Code Review Instructions

This repository hosts user-contributed xlets for the Cinnamon desktop environment
(Linux Mint). Contributions come from external authors with varying experience levels.
Reviews should focus on safety, correctness, and adherence to Cinnamon conventions.

Note: Basic structural validation (required files, UUID matching, metadata fields,
translation file placement, icon dimensions) is already enforced by CI via the
`validate-spice` script. Focus review effort on things that script cannot catch.

Cinnamon's source (github.com/linuxmint/cinnamon) should be the primary reference
for best practices and API usage patterns.

In Cinnamon's source, notable files are:
- files/usr/share/cinnamon/applets - Stock cinnamon applets. 
- files/usr/share/cinnamon/desklets - Stock cinnamon desklets.
- there are no default Cinnamon extensions. 
- js/ - Cinnamon's JavaScript source, including applet base classes and utilities.
- src/ - Cinnamon's C source, including core functionality and APIs that applets may use.
- src/st - Cinnamon's core themeable widget library. Most applet UI elements are derived
  from St widgets.

Muffin's source (github.com/linuxmint/muffin) is also a useful reference its Clutter
library (which StWidgets are based on). Some use of Meta (muffin's windowing API) may
be useful, but be cautious of it's use beyond its use as an information source. In the
case of extensions, this can be relaxed somewhat, as extensions whole purpose is to
override core Cinnamon behavior.

Xlets should not exceed their stated purpose.

## Critical Review Checks

When performing a code review, always check for these issues. Flag any violations
as high severity.

### Security (all xlet types)

- Check for command/shell injection opportunities: Functions that take an argument
  array variant should be used when launching external programs, if there's any
  possibility of unchecked input being used.
- Check for any suspicious external URLs beyond the xlet's stated API purpose.
  Flag unexpected network calls, especially to non-API endpoints.
- Check for data exfiltration patterns: user data being sent to external services
  that are not part of the xlet's core functionality.

### Forbidden Files (all xlet types)

- Do not allow the PR to modify/add files beyond those in the applet's own source
  directory.
- Do not allow source code that is compiled at runtime (.c, .cpp, etc...)
- Do not allow binaries or libraries.
- Do not allow compiled translations (.mo files). Only source .po files should be included.
- Do not allow minified JavaScript or CSS files. All code should be human-readable
  and reviewable.

### Installation Directory Integrity (all xlet types)

- Applets must NEVER write runtime data (JSON files, logs, downloaded images,
  cached data) to their own installation directory (`metadata.path` or
  `AppletDir`). The installation directory is overwritten during updates and any
  user data stored there will be lost.
- Use `GLib.get_user_state_dir()` or `GLib.get_user_cache_dir()` plus the applet's
  UUID for persistent data storage, and if Xlet Settings are insufficient.
- Applets must NEVER modify their own `settings-schema.json` at runtime. Use the
  Settings API for all settings operations.

### Expected Behavior
  - applets:
    - Applets provide some info on the panel - maybe just an icon or text, but sometimes
      graphical info.
    - They often have a primary menu which may just be selectable items, but can also be complex
      layouts.
      options like remove, configure and about, but they can have additional items.
    - An applet's behavior should be contained to its panel actor and menus/popups.
  - desklets:
    - Desklets provide some content in a container on the desktop. The container can be dragged
      around and often its size can be configured. They might draw a clock or show a picture or
      calendar, or the weather.
      options like remove, configure and about, but they can have additional items.
    - They may have a primary menu which may just be selectable items, but can also be complex
      layouts.
    - A desklets's behavior should be contained to its desktop container and menus/popups.
  - desklets and applets:
    - They may change behavior when clicked on.
    - They'll have a context (right-click) menu automatically set with some mandatory
    - The must *NEVER* attempt to override core Cinnamon behavior.
      - No overriding of Cinnamon's internal signal handlers
      - No overriding of core Cinnamon classes or functions via javascript tricks.
      - No overriding of existing core Cinnamon keybindings (including those in core
        applets or desklets).
      - Any behavior like this, it should probably be an Extension, not an applet or desklet.

## Important Review Checks

When performing a code review, check for these issues. Flag violations as medium
severity.

### Xlet Lifecycle

- Any timers and GObject signal handlers to external sources must be disconnected
  or cancelled in Applet.on_applet_removed_from_panel(), Desklet.on_desklet_removed(),
  or Extension.disable(), as appropriate.
- If there are many signals being connected, recommend using a SignalManager -
  (js/misc/signalManager.js in Cinnamon) - to track and clean them up more easily.
- A common mistake when using timers (Mainloop.timeout_add/idle_add or its GLib
  variants) is failing to keep track of the returned source IDs and zeroing them
  out either in the callback or when disconnecting them.
- Another common mistake when using timers is re-creating a periodic timer in its
  callback, instead of leveraging the return value (GLib.SOURCE_REMOVE or
  GLib.SOURCE_CONTINUE) to control whether it should repeat or not.

### API/General code 

- Look for polyfills and shell scripts that do things that could be performed by
  existing Cinnamon or GObject/introspected APIs. If any are present, recommend
  refactoring to use native APIs instead.

- Synchronous I/O functions should be avoided at all costs - this includes
  file operations, network calls, subprocess execution and dbus/ipc calls. If any
  of these are present, recommend refactoring to use asynchronous APIs.

- Look for exceedingly niche/edge-case handling that only adds complexity without
  much real-world benefit. Recommend removing any such code unless there's a
  compelling reason to keep it.

- Recommend using named return values instead of their numeric/boolean equivalents.
  - GLib.SOURCE_REMOVE and GLib.SOURCE_CONTINUE when dealing with GLib timers.
  - Clutter.EVENT_STOP and Clutter.EVENT_PROPAGATE when dealing with Clutter event
    handlers.

- Common acceptable patterns for cinnamon:
  - In general Clutter.Actors don't need to be explicitly destroyed - removing them
    from their parent container and dereferencing them is sufficient.
  - Adding custom properties to GObjects via monkey-patching is ok, as long as it
    does not conflict with existing GObject properties.

### Translation / Localization

- Translatable strings should form complete sentences and utilize printf-style
  format tokens for variable substitution. This allows translators to rearrange
  sentence structure as needed for their language.

  - Correct: `_("Alarm for %s was deleted.").format(name)`
  - Incorrect: `_("Alarm for ") + name + _(" was deleted.")`

- Translation setup should consist of the following boilerplate or equivalent:

```
Gettext.bindtextdomain(Configs.UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    return Gettext.dgettext(Configs.UUID, text);
}
```

- If a pull request includes translation updates (.po files), check for obvious
  mistranslations. 

### JavaScript Compatibility

Cinnamon's JavaScript engine is based on Mozilla's libmozjs - SpiderMonkey.
Current versions in use:
- 102, 115 (Mint)
- 128 (LMDE7)
- 140 (Coming soon to Mint 23)

Check that any modern JavaScript features used are supported by these engine
versions.
