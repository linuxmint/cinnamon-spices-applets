Panel Separator (Icon) applet is a version of the Panel Separator applet for the Cinnamon desktop. The implementation is made by using Gnome 2's gnome-panel-separator icon. This version of Panel Separator is for people who prefer to use their icon theme's panel separator icon. Some icon themes, such as Aw0ken and NoirCrystal, have some funky separators.

While creating the Icon Applet is very quick and easy, there are some downsides.

1. Icons are square. Cinnamon's Icon Applet api uses 22x22 icons. That means that there will always be some space around the applets. If anyone knows how to change the width of Cinnamon's Icon Applet, that would be the best solution that would be superb. To date, I don't know how a user can easily do that.

2. Some icon themes don't specify the gnome-panel-separator icon. As gnome 2 fades into history, I expect fewer icon theme authors will include the icon. If your're someone who likes to change icon themes a lot, copying the gnome-panel-separator icon into the appropriate folder for a bazillion icon themes can be annoying.

HOW TO INSTALL
==============
In the future there will be nice automated installations, but for now use the amazing power of extraction to copy this folder to the applet directory.

For an individual install, extract to:

~/.local/share/cinnamon/applets

For a system wide install, extract to:

/usr/share/cinnamon/applets


Remember: DON'T FORGET TO 'ALT+F2' 'r' to refresh the icons.

HOW TO INSTALL MULTIPLE SEPARATORS ON THE CINNAMON PANEL
=================================================
As of Cinnamon 1.3.1, you can only have one instance of each applet on the panel. But you want to have a lot of separators to make sense of your crowded panel? DO NOT FEAR.

Just copy and paste this applet multiple times in the applet directory and make the following changes:

1.Give each copy of the applet a unique name. A really easy way to do that is to rename them 'panel-separator-icon1@mordant23", 'panel-separator-icon2@mordant23', ..., 'panel-separator-iconN@mordant23 where N is the number of separators you want on your panels.

2. For each copy of the applet, change the "uuid" field in the metadata.json file so that it's the same name as the folder. For example, change:

"uuid": "panel-separator-icon@mordant23"

to

"uuid": "panel-separator-iconN@mordant23"

MAKE SURE YOU HAVE THE GNOME-PANEL-SEPARATOR ICON
=================================================
IMPORTANT: Some icon themes do not have a gnome-panel-separator icon nor do they specify a backup theme in case of missing icons. As gnome 2 recedes into history, I would expect that fewer icon themes will have a gnome-panel-separator icon.

How can you tell if you don't have a gnome-panel-separator icon? Well, either you won't see any separators or you'll see a tiny picture of the gnome desktop. Sometimes the picture will even have the nice gnome logo on it.

If you do not have a gnome-panel-separator icon DO NOT PANIC! Grab your trusty towel and perform the following, simple step:

Take the gnome-panel-separator.svg that comes with this applet and copy it to the appropriate folder in your icon theme.

What's the appropriate folder? Each icon theme is set up slightly differently. It will usually be one of the following forms:

path_to_icon_folder/apps/scalable
path_to_icon_folder/apps/22
path_to_icon_folder/apps/22x22
path_to_icon_folder/22/apps
path_to_icon_folder/22x22/apps
path_to_icon_folder/scalable/apps
etc., etc.

And of course the path_to_icon_folder is usually something along the lines of

/usr/share/icons/icon_folder
or
~/.icons/icon_folder

