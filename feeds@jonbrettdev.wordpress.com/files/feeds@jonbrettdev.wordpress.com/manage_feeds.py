#!/usr/bin/env python2
# -*- encoding: utf-8 -*-
from __future__ import unicode_literals
import gi
import sys
import os
import uuid
import json
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
import xml.etree.ElementTree as et
from io import open

DEFAULT_FEEDS="""
{
    "instances" : [ 
        {
            "name": "default",        
            "interval": 5,    
            "feeds": [
                {
                    "id": "",
                    "title": "default",
                    "url": "http://fxfeeds.mozilla.com/en-US/firefox/headlines.xml",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showimage": false
                },                {
                    "id": "",
                    "title": "default",
                    "url": "http://www.linuxmint.com/planet/rss20.xml",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showimage": false
                },                {
                    "id": "",
                    "title": "default",
                    "url": "http://segfault.linuxmint.com/feed/",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showimage": false
                }
            ]
        }


    ]
}
"""


UI_INFO = """
<ui>
  <menubar name='MenuBar'>
    <menu action='ImportMenu'>
      <menuitem action='ImportOPML' />
      <menuitem action='ImportFeedFile' />
    </menu>
    <menu action='ExportMenu'>
      <menuitem action='ExportFeedFile' />
    </menu>
  </menubar>
</ui>
"""

try:
    FileNotFoundError
except NameError:
    FileNotFoundError = IOError

class JsonConfigManager:
    @staticmethod
    def read(filename):
        try:
            with open(filename, mode="r") as json_data:
                feeds = json.load(json_data)

        except FileNotFoundError:
            # No file found, return default values # everything else throws.
            feeds = json.loads(DEFAULT_FEEDS)
            # Populate the UUIDs
            for instance in feeds['instances']:
                if instance['name'] == 'default':
                    for feed in instance['feeds']:
                        # This unique ID is the identifier for this feed for life
                        feed['id'] = JsonConfigManager.get_new_id()
            with open(filename, mode='w', encoding='utf-8') as f:
                f.write(unicode(json.dumps(feeds, ensure_ascii=False)))


        print(feeds)
        return feeds


    @staticmethod
    def get_new_id():
        """ Common method used to return a unique id in a string format. """
        return str(uuid.uuid4())




class ConfigManager:    
    @staticmethod
    def write(filename=None):
        """
            Writes the feeds list to the file/stdout
        """
        #if filename is None:
        #    filename = self.filename

        if filename is None:
            f = sys.stdout
        else:
            f = open(filename, mode="w", encoding="utf-8")

        # Need to check if all feeds have been removed
        if len(feeds) == 0:
            f.write(u'#')
            f.write('')
            f.write(u'\n')

        for feed in feeds:
            if not feed[2]:
                f.write(u'#')
            f.write(feed[0].decode('utf8'))
            if feed[1] is not None:
                f.write(u' ')
                f.write(feed[1].decode('utf8'))
            f.write(u'\n')

    @staticmethod
    def read(filename = None):
        """
            Reads content of the feed file/stdin and returns a list of lists
        """
        content = []
        
        if filename is None:
            f = sys.stdin
        else:
            f = open(filename, "r")

        for line in f:
            try:
                # If input is coming from the command line, convert to utf8
                if filename is None:
                    line = line.decode('utf8')

                if line[0] == "#":
                    # cut out the comment and define this item as disabled
                    line = line[1:]
                    enable = False
                else:
                    enable = True
                temp = line.split()
                url = temp[0]
                custom_title = None
                if len(temp) > 1:
                    custom_title = " ".join(temp[1:])
                content.append([url, custom_title, enable])
            except IndexError:
                # empty lines are ignored
                pass
        
        return content

    @staticmethod
    def update_redirected_feed(current_url, redirected_url):
        feeds = ConfigManager.read()
        for feed in feeds:
            if feed[0] == current_url:
                feed[0] = redirected_url                
        ConfigManager.write(feeds)


    @staticmethod
    def import_opml_file(filename):
        """
            Reads feeds list from an OPML file
        """
        new_feeds = []

        tree = et.parse(filename)
        root = tree.getroot()
        for outline in root.findall(".//outline[@type='rss']"):
            url = outline.attrib.get('xmlUrl', '').decode('utf-8')
            # for now just ignore feed title decoding issues.
            try:
                title = outline.attrib.get('text', '').decode('utf-8').encode('ascii', 'ignore')
            except:
                title = ""
            new_feeds.append([
                    url,
                    title,
                    False])
        return new_feeds        

class MainWindow(Gtk.Window):

    def __init__(self, data_path):        
        super(Gtk.Window, self).__init__(title="Manage your feeds")
        
        self.data_path = data_path
        # Create UI manager
        self.ui_manager = Gtk.UIManager()

        self.feedjson = JsonConfigManager.read(self.data_path + "/feeds.json")

        #self.filename = filename
        self.feeds = Gtk.ListStore(str, str, bool)
        try:
            for feed in ConfigManager.read():
                self.feeds.append(feed)
        except Exception as e:
            dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        "Failed to Import feeds")
            dialog.format_secondary_text(str(e))
            dialog.run()
            dialog.destroy()                                        

        # Set window properties
        self.set_default_size(600, 200)
        icon_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "icon.png"))
        self.set_icon_from_file(icon_path)

        box = Gtk.Box(False, 10, orientation=Gtk.Orientation.VERTICAL)
        button_box = Gtk.Box(False, 10)

        # Build menus
        self.build_menus()
        menubar = self.ui_manager.get_widget("/MenuBar")
        box.pack_start(menubar, False, False, 0)

        # Build feed table
        self.treeview = Gtk.TreeView(model=self.feeds)
        self.treeview.set_reorderable(True)

        renderer_enable = Gtk.CellRendererToggle()
        renderer_enable.connect("toggled", self.enable_toggled)
        column_enable = Gtk.TreeViewColumn("Enable", renderer_enable, active=2)
        column_enable.set_expand(False)
        self.treeview.append_column(column_enable)

        renderer_url = Gtk.CellRendererText()
        renderer_url.set_property("editable", True)
        renderer_url.connect("edited", self.url_edited)
        column_url = Gtk.TreeViewColumn("Url", renderer_url, text=0)
        column_url.set_expand(True)
        self.treeview.append_column(column_url)

        renderer_title = Gtk.CellRendererText()
        renderer_title.set_property("editable", True)
        renderer_title.connect("edited", self.title_edited)
        column_title = Gtk.TreeViewColumn("Custom title", renderer_title, text=1)
        column_title.set_expand(True)
        self.treeview.append_column(column_title)

        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(Gtk.PolicyType.AUTOMATIC,
                                   Gtk.PolicyType.AUTOMATIC)
        scrolled_window.add(self.treeview)
        box.pack_start(scrolled_window, True, True, 0)

        # Add buttons
        add_button = Gtk.Button(stock=Gtk.STOCK_ADD)
        add_button.connect("clicked", self.new_feed)

        del_button = Gtk.Button(stock=Gtk.STOCK_DELETE)
        del_button.connect("clicked", self.remove_feed)

        cancel_button = Gtk.Button(stock=Gtk.STOCK_CANCEL)
        cancel_button.connect("clicked", Gtk.main_quit)

        save_button = Gtk.Button(stock=Gtk.STOCK_APPLY)
        save_button.connect("clicked", self.save_clicked)
        save_button.connect("clicked", Gtk.main_quit)

        button_box.pack_start(add_button, False, False, 0)
        button_box.pack_start(del_button, False, False, 0)
        button_box.pack_end(save_button, False, False, 0)
        button_box.pack_end(cancel_button, False, False, 0)

        box.add(button_box)

        self.add(box)

    def build_menus(self):
        action_group = Gtk.ActionGroup("global_actions")

        # Create Import menu
        action_import_menu = Gtk.Action("ImportMenu", "Import", None, None)
        action_group.add_action(action_import_menu)

        action_import_opml = Gtk.Action("ImportOPML",
                                        "_Import OPML",
                                        "Import feeds from OPML file",
                                        Gtk.STOCK_FILE)
        action_import_opml.connect("activate", self.on_menu_import, "OPML")
        action_group.add_action(action_import_opml)

        action_import_file = Gtk.Action("ImportFeedFile",
                                        "_Import Feeds File",
                                        "Import feeds from file",
                                        Gtk.STOCK_FILE)
        action_import_file.connect("activate", self.on_menu_import, "FEEDS")
        action_group.add_action(action_import_file)

        # Create Export menu
        action_export_menu = Gtk.Action("ExportMenu", "Export", None, None)
        action_group.add_action(action_export_menu)

        action_export_file = Gtk.Action("ExportFeedFile",
                                        "_Export Feeds File",
                                        "Export feeds to file",
                                        Gtk.STOCK_FILE)
        action_export_file.connect("activate", self.on_menu_export_feeds)
        action_group.add_action(action_export_file)

        # Setup UI manager
        self.ui_manager.add_ui_from_string(UI_INFO)
        self.add_accel_group(self.ui_manager.get_accel_group())
        self.ui_manager.insert_action_group(action_group)

    def url_edited(self, widget, path, text):
        self.feeds[path][0] = text

    def title_edited(self, widget, path, text):
        if len(text) > 0:
            self.feeds[path][1] = text
        else:
            self.feeds[path][1] = None

    def enable_toggled(self, widget, path):
        self.feeds[path][2] = not self.feeds[path][2]

    def remove_feed(self, button):
        selection = self.treeview.get_selection()
        result = selection.get_selected()
        if result:
            model, itr = result
        model.remove(itr)

    def new_feed(self, button):
        self.feeds.append(["http://", "", True])
        self.treeview.set_cursor(len(self.feeds) - 1, self.treeview.get_column(0), True)

    def save_clicked(self, button):
        try:
            ConfigManager.write(self.feeds)
        except Exception as e:
            dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        "Failed to import OPML")
            dialog.format_secondary_text(str(e))
            dialog.run()
            dialog.destroy()            


    def on_menu_import(self, widget, type):

        filter_type = Gtk.FileFilter()
        if type == "OPML":
            title = "Choose a OPML feed file"
            filter_type.set_name("OPML files")
            filter_type.add_pattern("*.opml")
        else:
            title = "Choose a feed file"
            filter_type.set_name("Text files")
            filter_type.add_mime_type("text/plain")            


        dialog = Gtk.FileChooserDialog(title, self,
                                       Gtk.FileChooserAction.OPEN,
                                       (
                                           Gtk.STOCK_CANCEL,
                                           Gtk.ResponseType.CANCEL,
                                           Gtk.STOCK_OPEN,
                                           Gtk.ResponseType.OK
                                       ))

        # Add filters to dialog box
        dialog.add_filter(filter_type)

        filter_any = Gtk.FileFilter()
        filter_any.set_name("All files")
        filter_any.add_pattern("*")
        dialog.add_filter(filter_any)

        response = dialog.run()
        filename = dialog.get_filename()
        dialog.destroy()
        if response == Gtk.ResponseType.OK:
            try:
                if type == "OPML":
                    new_feeds = ConfigManager.import_opml_file(filename)
                else:
                    new_feeds = ConfigManager.read(filename)

                for feed in new_feeds:
                    self.feeds.append(feed)

                dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.INFO,
                                        Gtk.ButtonsType.OK,
                                        "file imported")
                dialog.format_secondary_text("Imported %d feeds" % len(new_feeds))
                dialog.run()
                dialog.destroy()
                
            except Exception as e:
                dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        "Failed to import file")
                dialog.format_secondary_text(str(e))
                dialog.run()
                dialog.destroy()        


    def on_menu_export_feeds(self, widget):
        dialog = Gtk.FileChooserDialog("Save a feed file", self,
                                       Gtk.FileChooserAction.SAVE,
                                       (
                                           Gtk.STOCK_CANCEL,
                                           Gtk.ResponseType.CANCEL,
                                           Gtk.STOCK_SAVE,
                                           Gtk.ResponseType.OK
                                       ))

        # Add filters to dialog box
        filter_text = Gtk.FileFilter()
        filter_text.set_name("Text files")
        filter_text.add_mime_type("text/plain")
        dialog.add_filter(filter_text)

        filter_any = Gtk.FileFilter()
        filter_any.set_name("All files")
        filter_any.add_pattern("*")
        dialog.add_filter(filter_any)

        response = dialog.run()
        filename = dialog.get_filename()
        dialog.destroy()
        sys.stderr.write(str(response))
        if response == Gtk.ResponseType.OK:
            try:
                ConfigManager.write(self.feeds, filename=filename)
            except Exception as ex:
                sys.stderr.write("Unable to export file, exception: %s" % str(ex))
                error_dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        "Unable to export file")
                error_dialog.format_secondary_text(str(ex))
                
                error_dialog.run()
                error_dialog.destroy()                         


if __name__ == '__main__':
    # If three parameters are passed in then we need to bypass the GUI and update the feed.
    ## TODO: Switch this use parameter passing instead of guessing by number of parameters.
    if len(sys.argv) == 2:
        data_path = sys.argv[1]
    elif len(sys.argv) == 4:
        data_path = sys.argv[1]
        current_url = sys.argv[2]
        redirect_url = sys.argv[3]
        try:            
            ConfigManager.update_redirected_feed(current_url, redirect_url)
        except Exception as e:
            sys.stderr.write("Error updating feed\n" + e + "\n")
        finally:
            # No need to show the GUI, all the work has been done here.
            exit()
    else:
        raise Exception("Invaild number of parameters included")

    # Display the window to allow the user to manage the feeds.
    window = MainWindow(data_path)
    window.connect("delete-event", Gtk.main_quit)
    
    window.show_all()
    Gtk.main()