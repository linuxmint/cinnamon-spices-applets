This applet's main purpose is to integrate tray icons seamlessly into your desktop and allowing you to hide icons you rarely need.

**IMPORTANT**: Due to the way Cinnamon handles tray icons, you can only use *one* tray applet at a time. So if you want to use this applet, please be sure you arenm't using any other tray applets such as the default one. Otherwise Cinnamon might become unstable or even crash.


# Settings documentation

* **Behavior**
  * **Animation duration** – The duration of the expand/collapse animation. You can disable animationy by setting this value to 0.
  * **Expand on hover** – If checked, the tray will automatically expand if you move the mouse pointer over the applet
  * **Expand on hover delay** — The delay before the tray expands on hover
  * **Collapse on un-hover** – If checked, the tray will automatically collapse if you move the mouse pointer away from the applet
  * **Collapse on un-hover delay** — The delay before the tray collapses on un-hover
  * **Startup collapse delay** — The tray collapses automatically when it is loaded. You can define a delay here during which all icons are visible.
* **Appearance**
  * **Sort icons by name** — If disabled, the icons' order will be random
  * **Disable hover effect for tray icons** — If you have problems with the hover effect or it simply doesn't look good, you should enable this setting
  * **Horizontal expand icon** — The icon used for the expand/collapse button if the tray is collapsed (if used in a horizontal panel)
  * **Horizontal collapse icon** — The icon used for the expand/collapse button if the tray is expanded (if used in a horizontal panel)
  * **Vertical expand icon** — The icon used for the expand/collapse button if the tray is collapsed (if used in a vertical panel)
  * **Vertical collapse icon** — The icon used for the expand/collapse button if the tray is expanded (if used in a vertical panel)
  * **Padding of tray icons** — Depending on the theme used the spacing between applets is different from the default tray icon spacing. You can adjust the tray icon spacing here.


# Manual installation

To install the applet, execute the `install.sh` script. If the applet doesn't appear in the applet list, you should restart Cinnamon by pressing Alt+F2, typing 'r' (without ') and hitting enter.
To remove the applet, just run `install.sh -r`.
