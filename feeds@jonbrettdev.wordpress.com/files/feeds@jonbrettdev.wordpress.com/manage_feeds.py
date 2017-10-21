#!/usr/bin/env python3
'''
 * Cinnamon RSS feed reader (python backend)
 *
 * Author: jake1164@hotmail.com
 * Date: 2013-2017
 *
 * Cinnamon RSS feed reader is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Cinnamon RSS feed reader is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
 * Public License for more details.  You should have received a copy of the GNU
 * General Public License along with Cinnamon RSS feed reader.  If not, see
 * <http://www.gnu.org/licenses/>.
'''
import os
import sys
import gi
import argparse
import gettext
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
from ConfigFileManager import ConfigFileManager

home = os.path.expanduser("~")
gettext.install("feeds@jonbrettdev.wordpress.com", home + "/.local/share/locale")

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


class MainWindow(Gtk.Window):

    def __init__(self, config):        
        super(Gtk.Window, self).__init__(title=_("Manage your feeds"))
        self.config = config
        self.show_hidden_fields = False
        self.hidden_fields = []        
        
        # Create UI manager
        self.ui_manager = Gtk.UIManager()

        # Set window properties
        self.set_default_size(800, 150 + len(self.config.feeds) * 20)
        icon_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "icon.png"))
        self.set_icon_from_file(icon_path)

        box = Gtk.Box(False, 10, orientation=Gtk.Orientation.VERTICAL)
        instance_box = Gtk.Box(False, 150)        
        button_box = Gtk.Box(False, 10)

        # Build menus
        self.build_menus()
        menubar = self.ui_manager.get_widget("/MenuBar")
        
        self.instance_combo = Gtk.ComboBox()
        render = Gtk.CellRendererText()
        self.instance_combo.pack_start(render, True)
        self.instance_combo.set_model(self.config.instances)
        
        
        self.instance_combo.set_active(self.config.get_instance_id())
        
        
        self.instance_combo.set_id_column(0)
        self.instance_combo.add_attribute(render, "text", 1)
        self.instance_combo.connect('changed', self.change_instance)

        instance_label = Gtk.Label()
        instance_label.set_text(_("Instance Name:"))
        instance_label.show()

        new_instance_button = Gtk.LinkButton()
        new_instance_button.set_label(_("Add/remove feed list"))
        new_instance_button.connect("activate-link", self.new_instance_button_activate)

        instance_box.pack_start(instance_label, False, False, 4)
        instance_box.pack_start(self.instance_combo, False, False, 0)
        instance_box.pack_end(new_instance_button, False, False, 0)

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
        column_enable = Gtk.TreeViewColumn(_("Enable"), renderer_enable, active=1)
        column_enable.set_expand(False)
        self.treeview.append_column(column_enable)

        renderer_url = Gtk.CellRendererText()
        renderer_url.set_property("editable", True)
        renderer_url.connect("edited", self.text_edited, 2)
        column_url = Gtk.TreeViewColumn(_("Url"), renderer_url, text=2)
        column_url.set_expand(True)
        self.treeview.append_column(column_url)

        renderer_title = Gtk.CellRendererText()
        renderer_title.set_property("editable", True)
        renderer_title.connect("edited", self.text_edited, 3)
        column_title = Gtk.TreeViewColumn(_("Custom title"), renderer_title, text=3)
        column_title.set_expand(True)
        self.treeview.append_column(column_title)

        renderer_notify = Gtk.CellRendererToggle()
        renderer_notify.connect("toggled", self.field_toggled, 4)
        column_notify = Gtk.TreeViewColumn(_("Notify"), renderer_notify, active=4)
        column_notify.set_expand(False)
        self.treeview.append_column(column_notify)

        renderer_showread = Gtk.CellRendererToggle()
        renderer_showread.connect("toggled", self.field_toggled, 6)
        column_showread = Gtk.TreeViewColumn(_("Show Read"), renderer_showread, active=6)
        column_showread.set_expand(False)
        self.treeview.append_column(column_showread)        

        renderer_interval = Gtk.CellRendererText()
        renderer_interval.set_property("editable", True)
        renderer_interval.connect("edited", self.interval_edited)
        column_interval = Gtk.TreeViewColumn(_("Interval"), renderer_interval, text=5)
        column_interval.set_expand(False)
        column_interval.set_visible(self.show_hidden_fields)
        self.hidden_fields.append(column_interval)
        self.treeview.append_column(column_interval)

        renderer_showimage = Gtk.CellRendererToggle()
        renderer_showimage.connect("toggled", self.field_toggled, 7)
        column_showimage = Gtk.TreeViewColumn(_("Show Image"), renderer_showimage, active=7)
        column_showimage.set_expand(False)
        column_showimage.set_visible(self.show_hidden_fields)
        self.hidden_fields.append(column_showimage)        
        self.treeview.append_column(column_showimage)

        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(Gtk.PolicyType.AUTOMATIC,
                                   Gtk.PolicyType.AUTOMATIC)
                
        scrolled_window.add(self.treeview)


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


        box.pack_start(menubar, False, False, 0)
        box.pack_start(instance_box, False, True, 0)

        box.pack_start(scrolled_window, True, True, 0)

        box.add(button_box)

        self.add(box)

    def build_menus(self):
        action_group = Gtk.ActionGroup("global_actions")

        # Create Import menu
        action_import_menu = Gtk.Action("ImportMenu", _("Import"), None, None)
        action_group.add_action(action_import_menu)

        action_import_opml = Gtk.Action("ImportOPML",
                                        _("_Import OPML"),
                                        _("Import feeds from OPML file"),
                                        Gtk.STOCK_FILE)
        action_import_opml.connect("activate", self.on_menu_import, "OPML")
        action_group.add_action(action_import_opml)

        action_import_file = Gtk.Action("ImportFeedFile",
                                        _("_Import Feeds File"),
                                        _("Import feeds from file"),
                                        Gtk.STOCK_FILE)
        action_import_file.connect("activate", self.on_menu_import, "FEEDS")
        action_group.add_action(action_import_file)

        # Create Export menu
        action_export_menu = Gtk.Action("ExportMenu", _("Export"), None, None)
        action_group.add_action(action_export_menu)

        action_export_file = Gtk.Action("ExportFeedFile",
                                        _("_Export Feeds File"),
                                        _("Export feeds to file"),
                                        Gtk.STOCK_FILE)
        action_export_file.connect("activate", self.on_menu_export_feeds)
        action_group.add_action(action_export_file)

        # Create Option menu
        action_option_menu = Gtk.Action("OptionMenu", _("Options"), None, None)
        action_group.add_action(action_option_menu)

        action_toggle_hidden = Gtk.Action("ShowHideFields",
                                        _("_Toggle Hidden Fields"),
                                        _("Show or Hide hidden fields"),
                                        Gtk.STOCK_FILE)
        action_toggle_hidden.connect("activate", self.on_menu_toggle_hidden)
        action_group.add_action(action_toggle_hidden)


        # Setup UI manager
        self.ui_manager.add_ui_from_string(UI_INFO)
        self.add_accel_group(self.ui_manager.get_accel_group())
        self.ui_manager.insert_action_group(action_group)


    def new_instance_button_activate(self, widget):
        checking = Gtk.MessageDialog(self, 
                                         Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                         Gtk.MessageType.QUESTION,
                                         Gtk.ButtonsType.OK_CANCEL,
                                         _("Changes will be discarded, continue?"))        
        checking.set_title(_('Are you sure?'))
        response = checking.run()
        checking.destroy()
        if response == Gtk.ResponseType.OK:
            dialog = Gtk.MessageDialog(self, 
                                            Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                            Gtk.MessageType.QUESTION,
                                            Gtk.ButtonsType.OK_CANCEL,
                                            _("New Instance (List) Name"))
            dialog_box = dialog.get_content_area()
            dialog.set_title(_('Add New Instance (List)'))
            entry = Gtk.Entry()
            entry.set_size_request(100, 0)
            dialog_box.pack_end(entry, False, False, 5)
            dialog.show_all()
            response = dialog.run()
            name = entry.get_text()
            dialog.destroy()
            if response == Gtk.ResponseType.OK and name != '':
                self.add_instance(name)


    def add_instance(self, name):
        """ Add a new instance by name """
        index = self.config.add_instance(name)
        self.instance_combo.set_model(self.config.instances)
        self.instance_combo.set_active(index)


    def change_instance(self, combo):
        """ When a new instance is selected we need to switch the feeds and the instance gets updated also """
        selected = combo.get_active()
        self.config.set_instance(self.config.get_instance_name(selected))
        self.treeview.set_model(self.config.feeds)        
        

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
        self.config.feeds.append([ConfigFileManager.get_new_id(), True, "http://", "", True, 5, False, False])        
        self.treeview.set_cursor(len(self.config.feeds) - 1, self.treeview.get_column(0), True)
        self.set_size_request(-1, 150 + len(self.config.feeds) * 20 )
        

    def save_clicked(self, button):
        """ When the user clicks apply we update and save the json file to disk """
        try:
            self.config.save()
            print(self.config.get_instance())
        except Exception as e:
            dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        _("Failed to save config file"))
            dialog.format_secondary_text(str(e))
            dialog.run()
            dialog.destroy()            


    def on_menu_import(self, widget, type):

        filter_type = Gtk.FileFilter()
        if type == "OPML":
            title = _("Choose a OPML feed file")
            filter_type.set_name(_("OPML files"))
            filter_type.add_pattern("*.opml")
        else:
            title = _("Choose a feed file")
            filter_type.set_name(_("Text files"))
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
        filter_any.set_name(_("All files"))
        filter_any.add_pattern("*")
        dialog.add_filter(filter_any)

        response = dialog.run()
        filename = dialog.get_filename()
        dialog.destroy()
        if response == Gtk.ResponseType.OK:
            try:
                if type == "OPML":
                    new_feeds = self.config.import_opml_file(filename)
                else:
                    new_feeds = self.config.import_feeds(filename)

                dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.INFO,
                                        Gtk.ButtonsType.OK,
                                        _("file imported"))
                dialog.format_secondary_text(_("Imported %d feeds") % new_feeds)
                dialog.run()
                dialog.destroy()
                
            except Exception as e:
                dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        _("Failed to import file"))
                dialog.format_secondary_text(str(e))
                dialog.run()
                dialog.destroy()        


    def on_menu_export_feeds(self, widget):
        dialog = Gtk.FileChooserDialog(_("Save a feed file"), self,
                                       Gtk.FileChooserAction.SAVE,
                                       (
                                           Gtk.STOCK_CANCEL,
                                           Gtk.ResponseType.CANCEL,
                                           Gtk.STOCK_SAVE,
                                           Gtk.ResponseType.OK
                                       ))

        # Add filters to dialog box
        filter_text = Gtk.FileFilter()
        filter_text.set_name(_("Text files"))
        filter_text.add_mime_type("text/plain")
        dialog.add_filter(filter_text)

        filter_any = Gtk.FileFilter()
        filter_any.set_name(_("All files"))
        filter_any.add_pattern("*")
        dialog.add_filter(filter_any)

        response = dialog.run()
        filename = dialog.get_filename()
        dialog.destroy()
        sys.stderr.write(str(response))
        if response == Gtk.ResponseType.OK:
            try:
                self.config.export_feeds(filename)
                #ConfigManager.write(self.config.feeds, filename=filename)
            except Exception as ex:
                sys.stderr.write(_("Unable to export file, exception: %s") % str(ex))
                error_dialog = Gtk.MessageDialog(self, 0,
                                        Gtk.MessageType.ERROR,
                                        Gtk.ButtonsType.CLOSE,
                                        _("Unable to export file"))
                error_dialog.format_secondary_text(str(ex))
                
                error_dialog.run()
                error_dialog.destroy()                         


    def on_menu_toggle_hidden(self, widget):
        self.show_hidden_fields = not self.show_hidden_fields
        for column in self.hidden_fields:
            column.set_visible(self.show_hidden_fields)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('filename', help='settings filename including path')
    parser.add_argument('instance', help='instance name to update the redirected url')

    args = parser.parse_args()    

    instance_name = args.instance
    filename = args.filename

    # Display the window to allow the user to manage the feeds.
    config = ConfigFileManager(filename, instance_name)
    window = MainWindow(config)
    window.connect("delete-event", Gtk.main_quit)
    
    window.show_all()
    Gtk.main()
