A Cinnamon applet that adds window buttons to the panel. Based on the Window Buttons Gnome Shell extension by biox.

There are two main modes for the applet. The default behaviour is for the buttons to control the active window. The other 'onlymax' behaviour is for the buttons to control the uppermost maximized window.

There are a few other options. They can all be configured by running dconf-editor and navigating to /org/cinnamon/applets/windowButtons@lippy. Hopefully I'll be able to add a UI for this in a future release.

It's possible to use this with the titlebar disabled for maximized windows. This page gives a good explanation for how to do that.

---

Requirements:

You need to be able to run glib-compile-schemas.
On Ubuntu / Debian / Linux Mint: sudo apt-get install libglib2.0-dev

---

Installation:

1. Copy the windowButtons@lippy directory to ~/.local/cinnamon/applets or /usr/share/cinnamon/applets.
2. As root, copy the org.cinnamon.applets.windowButtons@lippy.gschema.xml file to /usr/share/glib-2.0/schemas.
3. As root, run glib-compile-schemas /usr/share/glib-2.0/schemas.
4. Open Cinnamon Settings, navigate to Applets and enable the Window Buttons applet.
5. Enjoy!

---

Uninstallation:

1. Open Cinnamon Settings, navigate to Applets and disable the Window Buttons applet.
2. Delete the windowButtons@lippy directory within ~/.local/cinnamon/applets or /usr/share/cinnamon/applets.
3. As root, delete the org.cinnamon.applets.windowButtons@lippy.gschema.xml file within /usr/share/glib-2.0/schemas.
4. As root, run glib-compile-schemas /usr/share/glib-2.0/schemas.

---

Known issues
------------
  - If you click and hold on a button then move the cursor away before
    releasing, it will not cancel the button event. In fact, it doesn't matter
    where on the panel you click on after that. It will still trigger the
    button event as if you had clicked on the button. I'm not sure how to fix
    this, and the problem doesn't appear to be exclusive to this applet either.
  - The maximize button can be stuck in the highlighted state occasionally.
    This happens when the button changes to the restore button or vice versa
    shortly after the cursor has been over it. Mousing over the button will fix
    the problem if it crops up.

---

Cinnamon Window Buttons changelog:

Version 1.0 - 2012/05/10
------------------------
  - Initial release.
  - Port to Cinnamon Shell and rewrite as an applet. This has advantages and
    disadvantages. The main advantage is that the buttons can now be moved
    anywhere; they can even be on the bottom panel. The disadvantage is that
    the buttons have to be together, so it's no longer possible to have buttons
    on both sides of the panel at the same time.
  - Make maximize button dynamic. It will now turn into a restore button when
    the active window is maximized if onlymax is disabled. If onlymax is
    enabled, it will be a restore button when any window in the workspace is
    maximized. Add icons for the restore button.
  - Add support for hotswapping of themes.
  - Improve hideonnomax functionality. It now hides the buttons when the active
    window is not maximized when onlymax is not set. Previously the option
    would have had no use in this configuration.
  - Ignore buttons to the left of the titlebar due to the buttons having to be
    together. I hope to restore this functionality as best as I can for a
    future version.
  - Remove functionality where the buttons can control windows that are not
    active. I felt this behaviour was inconsistent and didn't offer any real
    use so I don't see any negative impact on removing it. This also fixes a
    bug where windows from other workspaces can be controlled when onlymax is
    set and the current workspace has no active windows.
  - Add highlighted and pressed states for the default theme.
  - Update Ambiance and Radiance themes to match those of Ubuntu Precise.
  - Button events are triggered after the button is released, rather than
    clicked on.
  - Match button tooltips with those of Cinnamon.
  - Clean up code.

---

Unless otherwise indicated, these files are licensed under the GNU General
Public License v3 or any later version.

  - Cinnamon Window Buttons is based on the Window Buttons Gnome Shell
    extension, created by Josiah Messiah aka biox
    <https://github.com/biox/Gnome-Shell-Window-Buttons-Extension>.
  - The Zukitwo and Zukitwo-Dark icons are copyright (C) Mattias aka
    lassekongo83 <http://lassekongo83.deviantart.com/>.
  - The Ambiance and Radiance icons are created by the Light Themes project
    <https://launchpad.net/light-themes> and are licensed under the Creative
    Commons Attribution Share-Alike License v3.0 or any later version.
  - The default icons are derived from the GNOME Symbolic Icon Theme project
    <http://git.gnome.org/browse/gnome-icon-theme-symbolic/> and are licensed
    under the Creative Commons Attribution Share-Alike License v3.0 or any
    later version.
