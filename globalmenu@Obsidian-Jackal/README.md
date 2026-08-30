# Global Application Menu

Cinnamon panel applet for global application menus (GTK, Qt, Electron) via AppMenu.

**Project, install, and backend setup:**  
https://gitlab.com/Obsidian_Jackal/cinnamon-global-menu

This Spices package is the applet only. You still need a current AppMenu stack
(`appmenu-gtk-module` + registrar from [vala-panel-appmenu](https://gitlab.com/vala-panel-project/vala-panel-appmenu)
~25.04). Do not rely on distro `0.7.6` apt packages.

Configure backends and session integration with the project’s
`setup-cinnamon-appmenu.sh` (or the distro package). The applet itself does not
rewrite GTK modules, xsettings, or kill other panel helpers.
