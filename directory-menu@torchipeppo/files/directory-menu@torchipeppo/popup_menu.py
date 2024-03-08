"""
KNOWN ISSUES

- This version is not as fast to load as the GJS-only version.
  I have no quantitative data, but since the code is essentially the same,
  I'd say that the extra delay is due exclusively to starting a new Python process.
  Especially because submenus load as fast as always.

- This script is triggered on mouse release. If you double-click on the applet, the mouse will have been released twice.
  The second trigger will still work as expected, but the first release event will trigger a process that never terminates,
  because it seems that popup_at_rect never shows the menu if the mouse is held at the time it's called.
  So, just don't double-click on the applet. None of the built-in ones requires double-clicking, after all.

- If this applet is on a panel set to automatically hide, the panel will hide as soon as any submenu opens.
  This is otherwise completely harmless.
  I don't think there is an easy solution here; attempting to "grab" the same way Cinnamon's PopupMenuManager does
  just ends up freezing the whole desktop environment.
  And even the XApp Status Icons have the same issue (I tried the client for Zoom, the video conference app, which puts a status icon there).
"""

#!/usr/bin/python3

import subprocess
import sys
import json
import os

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gio, Gtk, Gdk, GLib

import gettext
UUID = "directory-menu@torchipeppo"
HOME = os.path.expanduser("~")
gettext.bindtextdomain(UUID, os.path.join(HOME, ".local/share/locale"))
gettext.textdomain(UUID)

def _(message: str) -> str:
    return gettext.gettext(message)

def log(message):
    with open("/tmp/DM-remake-log.txt", "a") as f:
        f.write(str(message) + "\n")
    print(message, file=sys.stderr)




class Cassettone:

    # https://lazka.github.io/pgi-docs/index.html#Gtk-3.0/classes/ImageMenuItem.html
    def new_image_menu_item(self, label_text, icon):
        box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 6)
        label = Gtk.Label.new(label_text)
        menu_item = Gtk.MenuItem.new()

        box.add(icon)
        box.add(label)

        menu_item.add(box)

        return menu_item

    def populate_menu_with_directory(self, menu, directory_uri):
        directory = Gio.File.new_for_uri(directory_uri)
        # // First, the two directory actions: Open Folder and Open In Terminal

        open_image = Gtk.Image.new_from_icon_name("folder", Gtk.IconSize.MENU)
        open_item = self.new_image_menu_item(_("Open Folder"), open_image)
        open_item.connect("activate", lambda _: self.launch(directory.get_uri(), Gtk.get_current_event_time()))
        menu.append(open_item)

        term_image = Gtk.Image.new_from_icon_name("terminal", Gtk.IconSize.MENU)
        term_item = self.new_image_menu_item(_("Open in Terminal"), term_image)
        term_item.connect("activate", lambda _: self.open_terminal_at_path(directory.get_path()))
        menu.append(term_item)

        menu.append(Gtk.SeparatorMenuItem.new())

        # log(directory_uri)

        iter = directory.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, None)

        dirs = []
        nondirs = []

        info = iter.next_file(None)
        while info != None:
            if (not info.get_is_hidden() or self.show_hidden):     # // <-- skip hidden files
                info.display_name = info.get_display_name()
                info.content_type = info.get_content_type()
                info.file = directory.get_child_for_display_name(info.display_name)
                info.is_directory = (info.get_content_type() == "inode/directory")

                if (info.is_directory):
                    dirs.append(info)
                else:
                    nondirs.append(info)

            info = iter.next_file(None)

        dirs.sort(key = lambda info: info.display_name.lower())
        nondirs.sort(key = lambda info: info.display_name.lower())

        for info in dirs:
            self.add_to_menu_from_gioinfo(menu, info)
        for info in nondirs:
            self.add_to_menu_from_gioinfo(menu, info)

    def add_to_menu_from_gioinfo(self, menu, info):
        display_text = info.display_name
        if self.character_limit > -1 and len(display_text) > self.character_limit:
            display_text = display_text[:self.character_limit] + "..."

        icon = Gio.content_type_get_icon(info.content_type)
        image = Gtk.Image.new_from_gicon(icon, Gtk.IconSize.MENU)

        uri = info.file.get_uri()

        item = self.new_image_menu_item(display_text, image)

        if info.is_directory:
            subMenu = self.create_subdirectory_submenu(uri)
            item.set_submenu(subMenu)
        else:
            item.connect("activate", lambda _: self.launch(uri, Gtk.get_current_event_time()))

        menu.append(item)

    def create_subdirectory_submenu(self, uri):
        subMenu = Gtk.Menu.new()
        subMenu.set_reserve_toggle_size(False)

        def f(_):
            self.populate_menu_with_directory(subMenu, uri)
            subMenu.show_all()

        subMenu.connect("show", f)

        subMenu.connect("hide", lambda _: self.destroy_all_children_later(subMenu))

        return subMenu

    def launch(self, uri, timestamp):
        print(json.dumps({
            "action": "launch_default_for_uri",
            "uri": uri,
            "timestamp": timestamp,
        }))
        subprocess.run(['/usr/bin/xdg-open', uri], check=False)

    def open_terminal_at_path(self, path):
        print(json.dumps({
            "action": "open_terminal_at_path",
            "path": path,
        }))
        terminal_preferences = Gio.Settings.new("org.cinnamon.desktop.default-applications.terminal")
        argv = terminal_preferences.get_string("exec").split()
        spawn_flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL | GLib.SpawnFlags.STDERR_TO_DEV_NULL
        GLib.spawn_async(working_directory=path, argv=argv, flags=spawn_flags)

    def destroy_subitem_later(self, subItem):
        def g2():
            subItem.destroy()
            return False
        # // destroy at some future instant, but not right now so we have time for the activate event
        GLib.idle_add(priority=GLib.PRIORITY_HIGH_IDLE, function=g2)

    def destroy_all_children_later(self, menu):
        menu.foreach(self.destroy_subitem_later)


    # https://github.com/linuxmint/xapp/blob/master/libxapp/xapp-status-icon.c#L197
    def synthesize_event(self):
        display = Gdk.Display.get_default()
        seat = display.get_default_seat()
        pointer = seat.get_pointer()

        if self.orientation == int(Gtk.PositionType.TOP):
            posx = self.x
            posy = self.y - self.PRIV_ICON_SIZE
            rect_anchor = Gdk.Gravity.SOUTH_WEST
            menu_anchor = Gdk.Gravity.NORTH_WEST
        elif self.orientation == int(Gtk.PositionType.LEFT):
            posx = self.x - self.PRIV_ICON_SIZE
            posy = self.y
            rect_anchor = Gdk.Gravity.NORTH_EAST
            menu_anchor = Gdk.Gravity.NORTH_WEST
        elif self.orientation == int(Gtk.PositionType.RIGHT):
            posx = self.x
            posy = self.y
            rect_anchor = Gdk.Gravity.NORTH_WEST
            menu_anchor = Gdk.Gravity.NORTH_EAST
        else: # int(Gtk.PositionType.BOTTOM) is default
            posx = self.x
            posy = self.y
            rect_anchor = Gdk.Gravity.NORTH_WEST
            menu_anchor = Gdk.Gravity.SOUTH_WEST

        attributes = Gdk.WindowAttr()
        attributes.window_type = Gdk.WindowType.CHILD
        attributes.x = posx
        attributes.y = posy
        attributes.width = self.PRIV_ICON_SIZE
        attributes.height = self.PRIV_ICON_SIZE

        attributes_mask = Gdk.WindowAttributesType.X | Gdk.WindowAttributesType.Y

        window = Gdk.Window.new(None, attributes, attributes_mask)

        win_rect = Gdk.Rectangle()
        win_rect.x = 0
        win_rect.y = 0
        win_rect.width = self.PRIV_ICON_SIZE
        win_rect.height = self.PRIV_ICON_SIZE

        event = Gdk.Event.new(Gdk.EventType.BUTTON_RELEASE)
        event.any.window = window
        event.button.device = pointer

        return event, window, win_rect, rect_anchor, menu_anchor


    # this is the main entry point
    def build_and_show(self, args):

        self.main_menu = Gtk.Menu.new()
        self.main_menu.set_reserve_toggle_size(False)

        def on_main_menu_hidden(_):
            self.destroy_all_children_later(self.main_menu)
            Gtk.main_quit()

        self.main_menu.connect("hide", on_main_menu_hidden)

        self.starting_uri = args["starting_uri"]
        self.show_hidden = args["show_hidden"]
        self.x = args["x"]
        self.y = args["y"]
        self.orientation = args["orientation"]
        self.character_limit = args["character_limit"]

        # https://github.com/linuxmint/xapp/blob/master/libxapp/xapp-status-icon.c#L222
        # would be nice to determine it somehow, but it might not be so important right now
        self.PRIV_ICON_SIZE = 16

        self.populate_menu_with_directory(self.main_menu, self.starting_uri)

        self.main_menu.show_all()

        if not Gtk.Widget.get_realized(self.main_menu):
            self.main_menu.realize()
            # toplevel = self.main_menu.get_toplevel()
            # context = toplevel.get_style_context()

            # context.remove_class("csd")
            # context.add_class("xapp-status-icon-menu-window")


        event, window, win_rect, rect_anchor, menu_anchor = self.synthesize_event()


        self.main_menu.rect_window = window   # invece di set_data, facciamo direttamente così nel binding Python
        self.main_menu.window = window
        self.main_menu.anchor_hints = Gdk.AnchorHints.SLIDE_X | Gdk.AnchorHints.SLIDE_Y | Gdk.AnchorHints.RESIZE_X | Gdk.AnchorHints.RESIZE_Y

        self.main_menu.popup_at_rect(
            window,
            win_rect,
            rect_anchor,
            menu_anchor,
            event
        )

        Gtk.main()
        # this is a blocking call

        window.destroy()
        event.free()


# main
args = json.loads(sys.argv[1])
Cassettone().build_and_show(args)
