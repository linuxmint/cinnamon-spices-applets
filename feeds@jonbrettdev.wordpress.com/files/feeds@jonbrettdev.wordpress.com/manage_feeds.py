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
                    "title": "",
                    "url": "http://fxfeeds.mozilla.com/en-US/firefox/headlines.xml",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,                    
                    "showreaditems": false,
                    "showimage": false
                },                {
                    "id": "",
                    "title": "",
                    "url": "http://www.linuxmint.com/planet/rss20.xml",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showreaditems": false,
                    "showimage": false
                },                {
                    "id": "",
                    "title": "",
                    "url": "http://segfault.linuxmint.com/feed/",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showreaditems": false,
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
    <menu action='OptionMenu'>
      <menuitem action='ShowHideFields' />
    </menu>    
  </menubar>
</ui>
"""

try:
    FileNotFoundError
except NameError:
    FileNotFoundError = IOError

class JsonConfig:
    def __init__(self, filename, instance_name):
        """ This requires the filename that is being read along with the instance name to bind to the feed array """
        self.feeds = Gtk.ListStore(str, bool, str, str, bool, int, bool, bool)
        self.__filename = filename
        self.__json = self.__read()
        self.set_instance(instance_name)
        

    def set_instance(self, instance_name):
        """ Method used to change which instance list is being bound to the feeds array """
        self.__instance_selected = instance_name
        self.__load_feeds()
                

    def save(self):
        """ Convert the array back into feeds instance in the config file and then save / export it """
        for instance in self.__json['instances']:
            if instance['name'] == self.__instance_selected:                
                # Remove the feed
                instance.pop('feeds')
                # add a new empty section
                instance['feeds'] = []

                # Add all the feeds back in
                for feed in self.feeds:
                    instance['feeds'].append({'id': feed[0], 'enabled': feed[1], 'url': feed[2], 'title': feed[3], 'notify': feed[4], 'interval': feed[5], 'showreaditems': feed[6], 'showimage': feed[7]})

        # Save the file back out
        with open(self.__filename, mode='w', encoding='utf-8') as f:
            #f.write(self.__ensure_unicode(json.dumps(self.__json, ensure_ascii=False)))
            f.write(json.dumps(self.__json, ensure_ascii=False))

    def __load_feeds(self):
        self.feeds = Gtk.ListStore(str, bool, str, str, bool, int, bool, bool)

        for instance in self.__json['instances']:
            if instance['name'] == self.__instance_selected:
                for feed in instance['feeds']:
                    self.feeds.append([feed['id'], feed['enabled'], feed['url'], feed['title'], feed['notify'], feed['interval'], feed['showreaditems'], feed['showimage']])


    def __read(self):
        """ Returns the config.json file or creates a new one with default values if it does not exist """
        try:
            with open(self.__filename, mode="r") as json_data:
                feeds = json.load(json_data)

        except FileNotFoundError:
            # No file found, return default values # everything else throws.
            feeds = json.loads(DEFAULT_FEEDS)
            # Populate the UUIDs
            for instance in feeds['instances']:
                if instance['name'] == 'default':
                    for feed in instance['feeds']:
                        # This unique ID is the identifier for this feed for life
                        feed['id'] = JsonConfig.get_new_id()
            with open(self.__filename, mode='w', encoding='utf-8') as f:
                f.write(json.dumps(feeds, ensure_ascii=False))

        return feeds


    @staticmethod
    def get_new_id():
        """ 
            Common method used to return a unique id in a string format. 
        """
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

    def __init__(self, config):        
        super(Gtk.Window, self).__init__(title="Manage your feeds")
        self.config = config
        self.show_hidden_fields = False
        self.hidden_fields = []        
        
        # Create UI manager
        self.ui_manager = Gtk.UIManager()

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
        self.treeview = Gtk.TreeView(model=self.config.feeds)
        self.treeview.set_reorderable(True)

        renderer_id = Gtk.CellRendererText()
        renderer_id.set_property("editable", False)
        column_id = Gtk.TreeViewColumn("Id", renderer_id, text=0)
        column_id.set_expand(False)
        column_id.set_visible(self.show_hidden_fields)
        self.hidden_fields.append(column_id)
        self.treeview.append_column(column_id)

        renderer_enable = Gtk.CellRendererToggle()
        renderer_enable.connect("toggled", self.field_toggled, 1)
        column_enable = Gtk.TreeViewColumn("Enable", renderer_enable, active=1)
        column_enable.set_expand(False)
        self.treeview.append_column(column_enable)

        renderer_url = Gtk.CellRendererText()
        renderer_url.set_property("editable", True)
        renderer_url.connect("edited", self.text_edited, 2)
        column_url = Gtk.TreeViewColumn("Url", renderer_url, text=2)
        column_url.set_expand(True)
        self.treeview.append_column(column_url)

        renderer_title = Gtk.CellRendererText()
        renderer_title.set_property("editable", True)
        renderer_title.connect("edited", self.text_edited, 3)
        column_title = Gtk.TreeViewColumn("Custom title", renderer_title, text=3)
        column_title.set_expand(True)
        self.treeview.append_column(column_title)

        renderer_notify = Gtk.CellRendererToggle()
        renderer_notify.connect("toggled", self.field_toggled, 4)
        column_notify = Gtk.TreeViewColumn("Notify", renderer_notify, active=4)
        column_notify.set_expand(False)
        self.treeview.append_column(column_notify)

        renderer_showread = Gtk.CellRendererToggle()
        renderer_showread.connect("toggled", self.field_toggled, 6)
        column_showread = Gtk.TreeViewColumn("Show Read", renderer_showread, active=6)
        column_showread.set_expand(False)
        column_showread.set_visible(self.show_hidden_fields)
        self.hidden_fields.append(column_showread)        
        self.treeview.append_column(column_showread)        

        renderer_interval = Gtk.CellRendererText()
        renderer_interval.set_property("editable", True)
        renderer_interval.connect("edited", self.interval_edited)
        column_interval = Gtk.TreeViewColumn("Interval", renderer_interval, text=5)
        column_interval.set_expand(False)
        column_interval.set_visible(self.show_hidden_fields)
        self.hidden_fields.append(column_interval)
        self.treeview.append_column(column_interval)

        renderer_showimage = Gtk.CellRendererToggle()
        renderer_showimage.connect("toggled", self.field_toggled, 7)
        column_showimage = Gtk.TreeViewColumn("Show Image", renderer_showimage, active=7)
        column_showimage.set_expand(False)
        column_showimage.set_visible(self.show_hidden_fields)
        self.hidden_fields.append(column_showimage)        
        self.treeview.append_column(column_showimage)

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

        # Create Option menu
        action_option_menu = Gtk.Action("OptionMenu", "Options", None, None)
        action_group.add_action(action_option_menu)

        action_toggle_hidden = Gtk.Action("ShowHideFields",
                                        "_Toggle Hidden Fields",
                                        "Show or Hide hidden fields",
                                        Gtk.STOCK_FILE)
        action_toggle_hidden.connect("activate", self.on_menu_toggle_hidden)
        action_group.add_action(action_toggle_hidden)


        # Setup UI manager
        self.ui_manager.add_ui_from_string(UI_INFO)
        self.add_accel_group(self.ui_manager.get_accel_group())
        self.ui_manager.insert_action_group(action_group)


    def text_edited(self, widget, row, text, col):
        """ When a text box is edited we need to update the feed array. """
        if len(text) > 0:
            self.config.feeds[row][col] = text 
            
        else:
            self.config.feeds[row][col] = None


    def field_toggled(self, widget, row, col):
        """ Toggle the value of the passed row / col in the feed array """
        self.config.feeds[row][col] = not self.config.feeds[row][col]


    def interval_edited(self, widget, row, text):
        """ When the interval is changed convert it to a number or refuse to update the field in the feed array """
        try:
            self.config.feeds[row][5] = int(text)        
        except:
            pass# Nothing to do, ignore this.


    def remove_feed(self, button):
        """ When delete button is clicked we find the selected record and remove it from the feed array """
        selection = self.treeview.get_selection()
        result = selection.get_selected()
        if result:
            model, itr = result
        model.remove(itr)
        

    def new_feed(self, button):
        """ Adds a new row to the bottom of the array / Grid """        
        self.config.feeds.append([JsonConfig.get_new_id(), True, "http://", "", True, 5, False, False])        
        self.treeview.set_cursor(len(self.config.feeds) - 1, self.treeview.get_column(0), True)


    def save_clicked(self, button):
        try:
            config.save()
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
                    self.config.feeds.append(feed)

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
                ConfigManager.write(self.config.feeds, filename=filename)
            except Exception as ex:
                sys.stderr.write("Unable to export file, exception: %s" % str(ex))
                error_dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        "Unable to export file")
                error_dialog.format_secondary_text(str(ex))
                
                error_dialog.run()
                error_dialog.destroy()                         


    def on_menu_toggle_hidden(self, widget):
        self.show_hidden_fields = not self.show_hidden_fields
        for column in self.hidden_fields:
            column.set_visible(self.show_hidden_fields)


if __name__ == '__main__':
    # If three parameters are passed in then we need to bypass the GUI and update the feed.
    ## TODO: Switch this use parameter passing instead of guessing by number of parameters.
    #if len(sys.argv) >= 3:
    print(sys.version)
    instance_name = sys.argv[1]
    data_path = sys.argv[2]

    if len(sys.argv) == 5:
        current_url = sys.argv[3]
        redirect_url = sys.argv[4]
        try:            
            ConfigManager.update_redirected_feed(current_url, redirect_url)
        except Exception as e:
            sys.stderr.write("Error updating feed\n" + e + "\n")
        finally:
            # No need to show the GUI, all the work has been done here.
            exit()

    # Display the window to allow the user to manage the feeds.
    config = JsonConfig(data_path + "/feeds.json", instance_name)
    window = MainWindow(config)
    window.connect("delete-event", Gtk.main_quit)
    
    window.show_all()
    Gtk.main()