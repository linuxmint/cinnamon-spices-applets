#!/usr/bin/env python
#-*-indent-tabs-mode: nil-*-

import sys
import os.path

import gi
from gi.repository import Gtk, Gio

SCHEMAS = "org.cinnamon.applets.classicMenu"
KEY = "favorites-list"
HOME_DIR = os.path.expanduser("~")+"/"
SEPARATOR_ITEM = ["","-------------", ""]

file_list=[]

CURRDIR = ""

try:
    CURRDIR = sys.argv[1]
except IndexError:
    pass

MAIN_UI_PATH = CURRDIR+"favoritesEditor.ui"
EDITOR_DIALOG_UI_PATH = CURRDIR+"editorDialog.ui"

class EditorDialog:

    def __init__(self, parent_model, pos, add=True, favorite_type="Application", name=""):
        self.settings = Gio.Settings.new(SCHEMAS)
        self.parent_model = parent_model
        self.pos = pos
        self.add = add
        self.favorite_type = favorite_type
        self.name = name
        self.title = ""
        self.description = ""
        self.command = ""
        self.icon_name = ""

        if favorite_type[:30]=="Custom Application" and name != "":
            self.name = self.name[30:]
        self.tree = Gtk.Builder()
        self.tree.add_from_file(EDITOR_DIALOG_UI_PATH)

        self.dialog = self.tree.get_object("dialog")
        self.favorite_type_combo_box = self.tree.get_object("favorite_type_combo_box")
        self.name_entry = self.tree.get_object("name_entry")
        self.title_entry = self.tree.get_object("title_entry")
        self.description_entry = self.tree.get_object("description_entry")
        self.command_entry = self.tree.get_object("command_entry")
        self.icon_name_entry = self.tree.get_object("icon_name_entry")
        self.favorite_icon = self.tree.get_object("favorite_icon")

        self.name_entry.set_text(self.name)

        self.model = self.favorite_type_combo_box.get_model()
        self.citer = [self.model.get_iter_from_string("0"),self.model.get_iter_from_string("1")]

        self.favorite_type_combo_box.set_active_iter(self.citer[self.fav_type_to_index(self.favorite_type)])
        self.update_edibility()
        self.set_fields_by_name()
        self.on_icon_changed(self.icon_name_entry.get_text())

        self.tree.connect_signals(self)

        self.dialog.show_all()

    def fav_type_to_index(self,favorite_type):
        if favorite_type == "Application":
            return 0
        elif favorite_type == "Custom Application":
            return 1

    def update_edibility(self):
        sensitive = True
        if (self.favorite_type == "Application"):
            sensitive = False

        self.title_entry.set_sensitive(sensitive)
        self.description_entry.set_sensitive(sensitive)
        self.command_entry.set_sensitive(sensitive)
        self.icon_name_entry.set_sensitive(sensitive)

    def on_favorite_type_combo_box_changed(self, widget):
        self.favorite_type = self.favorite_type_combo_box.get_active_text()
        self.update_edibility()
        self.on_name_changed(self.name_entry)

    def on_icon_changed(self, widget):
        self.favorite_icon.set_from_icon_name(self.icon_name_entry.get_text(), 48)

    def on_name_changed(self, widget):
        if (self.favorite_type == "Application"):
            self.set_fields_by_name()

    def set_fields_by_name(self):
        if (self.favorite_type == "Application"):
            application = Application(self.name_entry.get_text() + ".desktop")
        else:
            application = Application("cinnamon-menu-custom-favorite-" + self.name_entry.get_text() + ".desktop")
        if application.title:
            self.title_entry.set_text(application.title)
            self.description_entry.set_text(application.description)
            self.command_entry.set_text(application.command)
            self.icon_name_entry.set_text(application.icon_name)

    def on_edit_close_clicked(self, widget):
        self.dialog.destroy()

    def on_edit_ok_clicked(self, widget):
        if (self.favorite_type == "Application"):
            self.ok_application()
        elif (self.favorite_type == "Custom Application"):
            self.ok_custom_application()
        self.dialog.destroy()

    def ok_application(self):
        favorite_name = self.name_entry.get_text() + ".desktop"
        favorite_application = Application(favorite_name)
        row = [favorite_application.icon_name, favorite_application.title, favorite_name]
        if not row[0]:
            return
        self.parent_model.insert_after(self.pos, row)
        if not self.add:
            self.parent_model.remove(self.pos)

    def ok_custom_application(self):
        global file_list
        file_name = "cinnamon-menu-custom-favorite-" + self.name_entry.get_text() + ".desktop"
        file_path=HOME_DIR + ".local/share/applications/" + file_name

        title = self.title_entry.get_text()
        description = self.description_entry.get_text()
        command = self.command_entry.get_text()
        icon_name = self.icon_name_entry.get_text()
        _file = open(file_path,"w+")

        write_list=["[Desktop Entry]\n","Type=Application\n", "Name=" + title + "\n","Comment=" + description + "\n","Exec=" + command + "\n","Icon=" + icon_name + "\n"]

        _file.writelines(write_list)
        file_list.append(_file)
        row = [icon_name, title, file_name]
        self.parent_model.insert_after(self.pos, row)
        if not self.add:
            self.parent_model.remove(self.pos)
        self.settings.create_action(KEY)

class Application:
    def __init__(self, file_name):
        self.file_name = file_name
        self._path = None
        self.icon_name = None
        self.title = None
        self.description = None
        self.command = None

        if (os.path.exists(HOME_DIR + ".local/share/applications/" + file_name)):
            self._path = HOME_DIR + ".local/share/applications/" + file_name
        elif (os.path.exists("/usr/share/applications/" + file_name)):
            self._path = "/usr/share/applications/" + file_name

        if self._path:
            self._file = open(self._path, "r")
            while self._file:
                line = self._file.readline()
                if len(line)==0:
                    break

                if (line.find("Name") == 0 and (not "[" in line)):
                    self.title = line.replace("Name","").replace("=","").replace("\n","")

                if (line.find("Icon") == 0):
                    self.icon_name = line.replace("Icon","").replace(" ","").replace("=","").replace("\n","")

                if (line.find("Comment") == 0 and (not "[" in line)):
                    self.description = line.replace("Comment","").replace("=","").replace("\n","")

                if (line.find("Exec") == 0):
                    self.command = line.replace("Exec","").replace("=","").replace("\n","")
                if self.icon_name and self.title and self.description and self.command:
                    break

            if not self.icon_name:
                self.icon_name = "application-x-executable"
            if not self.title:
                self.title = "Application"
            if not self.description:
                self.description = ""
            if not self.command:
                self.command = ""
            self._file.close()

class MainWindow:
    def __init__(self):
        self.tree = Gtk.Builder()
        self.tree.add_from_file(MAIN_UI_PATH)

        self.window = self.tree.get_object("window")
        self.list_store = self.tree.get_object("favorites_list")
        self.scroll_box = self.tree.get_object("scroll_box")

        self.tree.connect_signals(self)

        self.settings = Gio.Settings.new(SCHEMAS)
        self.settings.connect("changed::"+KEY, self.on_settings_changed)

# Initialize
        self.list_store = Gtk.ListStore(str, str, str)
        self.load_favorites()

        self.tree_view = Gtk.TreeView(self.list_store)
        self.tree_column = Gtk.TreeViewColumn("Favorites")
        self.selection = self.tree_view.get_selection()

        icon = Gtk.CellRendererPixbuf()
        name = Gtk.CellRendererText()

        self.tree_column.pack_start(icon, False)
        self.tree_column.pack_start(name, True)

        self.tree_column.add_attribute(icon, "icon-name", 0)
        self.tree_column.add_attribute(name, "text", 1)
        self.tree_view.append_column(self.tree_column)
        self.scroll_box.add(self.tree_view)

        self.window.show_all()
        self.window.connect("destroy", Gtk.main_quit)
        Gtk.main()

    def load_favorites(self): # Loads favorites to tree view
        self.list_store.clear();
        self.list_string = self.settings.get_string(KEY)
        sublists = self.list_string.split("::")
        for sub in sublists:
            subsublist = sub.split(":")
            for subsub in subsublist:
                application = Application(subsub)
                self.list_store.append([application.icon_name, application.title, subsub])
            treeiter = self.list_store.append(SEPARATOR_ITEM)

        self.list_store.remove(treeiter)

    def on_settings_changed(self, settings, key): # Call load_favorites when settings is changed
        self.load_favorites()

    def write(self): # Writes settings to GSettings
        global file_list
        for fileitem in file_list:
            fileitem.close()
        file_list = []
        self.list_string = ""
        for row in self.list_store:
            self.list_string += row[2] + ":"
        if (self.list_string[-2:] != "::"):
            self.list_string = self.list_string[:-1]
        self.settings.set_string(KEY, self.list_string)

# Signals from Glade

    def on_up_clicked(self, widget):
        model, titer = self.selection.get_selected()
        pos = int(model.get_string_from_iter(titer)) - 1
        previter = model.get_iter_from_string(str(pos))
        model.swap(titer, previter)

    def on_down_clicked(self, widget):
        model, titer = self.selection.get_selected()
        nextiter = model.iter_next(titer)
        model.swap(titer, nextiter)

    def on_add_favorite_clicked(self, widget):
        model, titer = self.selection.get_selected()
        editor = EditorDialog(model, titer)

    def on_add_separator_clicked(self, widget):
        model, titer = self.selection.get_selected()
        model.insert_after(titer, SEPARATOR_ITEM)

    def on_edit_clicked(self, widget):
        model, titer = self.selection.get_selected()
        if model[titer] != SEPARATOR_ITEM:
            application_name = model[titer][2][:-8]
            if "cinnamon-menu-custom-favorite" in application_name:
                application_type = "Custom Application"
            else:
                application_type = "Application"
            editor = EditorDialog(model, titer, False, application_type, model[titer][2][:-8])

    def on_remove_clicked(self, widget):
        model, titer = self.selection.get_selected()
        model.remove(titer)

    def on_cancel_clicked(self, widget):
        Gtk.main_quit()

    def on_ok_clicked(self, widget):
        self.write()
        Gtk.main_quit()

    def on_apply_clicked(self, widget):
        self.write()

if __name__ == "__main__":
    window = MainWindow()
