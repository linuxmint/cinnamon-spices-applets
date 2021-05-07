#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
import sys, os, threading, re, gettext
from gi.repository import Gio, Gtk, GLib, GObject, Pango, GdkPixbuf

gettext.install("placesCenter@scollins", os.environ['HOME'] + "/.local/share/locale")

def launch(path):
    fileObj = Gio.File.new_for_path(path)
    Gio.app_info_launch_default_for_uri(fileObj.get_uri(), Gio.AppLaunchContext())


class SearchBox(Gtk.Entry):
    def __init__(self, searchCommand):
        Gtk.Entry.__init__(self)
        self.searchCommand = searchCommand

        self.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, "edit-find-symbolic")
        self.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, "edit-clear-symbolic")

        self.connect("icon-press", self.onClick)

        self.connect("activate", self.searchCommand)

    def onClick(self, target, pos, event):
        if pos == Gtk.EntryIconPosition.PRIMARY and not self.get_text == "":
            self.searchCommand()
        if pos == Gtk.EntryIconPosition.SECONDARY:
            self.set_text("")


class Context(Gtk.Menu):
    def __init__(self, parent):
        Gtk.Menu.__init__(self)

        self.parent = parent

        self.attach_to_widget(parent, None)

        launch = Gtk.MenuItem()
        launch.set_label(_("Open..."))
        launch.connect("activate", self.launchItem)
        self.append(launch)

        openFolder = Gtk.MenuItem()
        openFolder.set_label(_("Open Containing Folder..."))
        openFolder.connect("activate", self.openFolder)
        self.append(openFolder)

        parent.connect("button-press-event", self.onButtonPress)
        parent.connect("popup-menu", self.openContext)

        self.show_all()

    def onButtonPress(self, target, event):
        if event.button == 3:
            selection = target.get_selection()
            info = target.get_path_at_pos(int(event.x), int(event.y))
            if info is None:
                return True
            selection.select_path(info[0])
            self.openContext()
            return True

        return False

    def openContext(self):
        self.popup(None, None, None, None, 0, Gtk.get_current_event_time())

    def launchItem(self, a):
        model, iter = self.parent.get_selection().get_selected()
        launch(os.path.join(model[iter][2], model[iter][1]))

    def openFolder(self, a):
        model, iter = self.parent.get_selection().get_selected()
        launch(model[iter][2])


class SearchWindow(Gtk.Window):
    searching = False

    def __init__(self, basePath):
        Gtk.Window.__init__(self, title=(_("Search")), icon_name="edit-find", default_height=400, default_width=650)
        self.connect("destroy", self.quit)

        self.search = None
        self.results = Gtk.ListStore(str, str, str)

        mainBox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, border_width = 10)
        self.add(mainBox)

        contentBox = Gtk.Box(border_width=0)
        mainBox.pack_start(contentBox, True, True, 0)

        ## left pane
        leftPane = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, border_width = 10)
        contentBox.pack_start(leftPane, False, False, 0)

        # search box
        self.searchBox = SearchBox(self.startSearch)
        leftPane.pack_start(self.searchBox, False, False, 5)

        # location selector
        leftPane.pack_start(Gtk.Label(_("Start in"), halign=Gtk.Align.START), False, False, 5)
        self.location = Gtk.FileChooserButton.new(_("Select a folder"), Gtk.FileChooserAction.SELECT_FOLDER)
        leftPane.add(self.location)
        if not basePath is None:
            self.location.set_filename(basePath)

        # follow symlinks
        self.symlinks = Gtk.CheckButton.new_with_label(_("Follow symlinks"))
        leftPane.add(self.symlinks)

        # display hidden files/folders
        self.hidden = Gtk.CheckButton.new_with_label(_("Search hidden"))
        leftPane.add(self.hidden)

        # use regex
        self.regex = Gtk.CheckButton.new_with_label(_("Use regular expressions"))
        leftPane.add(self.regex)

        # stop button
        self.stopButton = Gtk.Button(label = (_("Stop")), sensitive=False)
        leftPane.pack_end(self.stopButton, False, False, 5)
        self.stopButton.connect("clicked", self.stopSearch)

        ## right pane
        rightPane = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, border_width = 10)
        contentBox.pack_start(rightPane, True, True, 0)

        # results display tree
        scrollBox = Gtk.ScrolledWindow()
        rightPane.pack_start(scrollBox, True, True, 5)
        tree = Gtk.TreeView(self.results)
        scrollBox.add(tree)

        fileNameColumn = Gtk.TreeViewColumn()
        fileNameColumn.set_title(_("File"))
        fileNameColumn.set_resizable(True)
        fileNameColumn.set_sizing(Gtk.TreeViewColumnSizing.FIXED)
        fileNameColumn.set_fixed_width(200)
        fileNameColumn.set_min_width(200)
        tree.append_column(fileNameColumn)

        iconRenderer = Gtk.CellRendererPixbuf()
        fileNameColumn.pack_start(iconRenderer, expand=False)
        fileNameColumn.add_attribute(iconRenderer, "icon-name", 0)

        fileNameRenderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.END)
        fileNameColumn.pack_start(fileNameRenderer, expand=False)
        fileNameColumn.add_attribute(fileNameRenderer, "text", 1)

        pathRenderer = Gtk.CellRendererText()
        pathColumn = Gtk.TreeViewColumn(_("Path"), pathRenderer, text=2)
        pathColumn.set_resizable(True)
        tree.append_column(pathColumn)

        # context menu
        Context(tree)
        tree.connect("row-activated", self.launchItem)

        # status text
        hbox = Gtk.Box()
        mainBox.pack_start(hbox, False, False, 0)
        self.currentLabel = Gtk.Label()
        self.currentLabel.set_ellipsize(Pango.EllipsizeMode.END)
        hbox.pack_start(self.currentLabel, False, False, 5)

        self.show_all()

    def quit(self, widget):
        self.stopSearch()
        Gtk.main_quit()

    def startSearch(self, a=None):
        if self.searching:
            self.stopSearch()
            GObject.idle_add(self.startSearch)
            return

        self.results.clear()
        self.setStatusText(_("Searching..."))

        self.searching = True
        self.dirs = []

        self.search = threading.Thread(target=self.searchDirectory, args=[self.location.get_filename(), self.searchBox.get_text(), True])
        self.stopButton.set_sensitive(True)
        self.search.start()

    def stopSearch(self, a=None):
        self.searching = False
        if not self.search is None:
            self.search.join();
            self.search = None
        GObject.idle_add(self.setStatusText, (_("Search Stopped")))
        self.setStatusText(_("Search Stopped"))
        self.stopButton.set_sensitive(False)

    def launchItem(self, event, path, column):
        row = self.results[path]
        launch(os.path.join(row[2], row[1]))

    def addResult(self, fileName, path, icon):
        self.results.append([icon, fileName, path])

    def setStatusText(self, text):
        self.currentLabel.set_text(text)

    def searchDirectory(self, directory, key, firstRun=False):
        if not self.searching:
            return
        GObject.idle_add(self.setStatusText, (_("Searching: ") + directory))

        try:
            children = os.listdir(directory)
        except:
            GObject.idle_add(self.setStatusText, (_("Error: insufficient permissions to read folder ") + directory))
            return

        subdirs = []
        for child in children:
            if child[0] != "." or self.hidden.get_active():
                path = os.path.join(directory, child)
                if self.isMatch(key, child):
                    fileObj = Gio.File.new_for_path(path)
                    info = fileObj.query_info("standard::icon", 0, None)
                    iconNames = info.get_icon().get_names()
                    for icon in iconNames:
                        if Gtk.IconTheme.get_default().has_icon(icon):
                            break
                    if not self.searching:
                        return
                    GObject.idle_add(self.addResult, child, directory, icon)
                try:
                    if os.path.isdir(path) and (self.symlinks.get_active() or not os.path.islink(path)) and not self.isRedundant(path):
                        subdirs.append(path)
                        self.dirs.append(os.path.realpath(path))
                except:
                    pass

        for directory in subdirs:
            if not self.searching:
                return
            self.searchDirectory(directory, key)

        if firstRun and self.searching:
            self.searching = False
            self.stopButton.set_sensitive(False)
            GObject.idle_add(self.setStatusText, (_("Search Completed")))

    def isRedundant(self, path):
        if not self.symlinks.get_active() or not os.path.islink(path) or not os.path.isdir(path):
            return False
        else:
            if os.path.realpath(path) in self.dirs:
                GObject.idle_add(self.setStatusText, _("Skipping") + ' ' + path + (_(" - directory already searched")))
                return True

    def isMatch(self, key, child):
        if self.regex.get_active():
            if re.search(key, child) == None:
                return False
            else:
                return True
        else:
            if key in child:
                return True
            else:
                return False

if __name__ == "__main__":
    GLib.threads_init()
    if len(sys.argv) > 1:
        SearchWindow(sys.argv[1])
    else:
        SearchWindow("/")

    Gtk.main()
