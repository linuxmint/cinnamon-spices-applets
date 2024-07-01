#!/usr/bin/python3

from os import environ
from uuid import uuid4
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Pango
from xapp.SettingsWidgets import *
#from SettingsWidgets import SoundFileChooser, Keybinding
from SettingsWidgets import Keybinding

VARIABLE_TYPE_MAP = {
    "string"        :   str,
    "file"          :   str,
    "icon"          :   str,
    "sound"         :   str,
    "keybinding"    :   str,
    "integer"       :   int,
    "float"         :   float,
    "boolean"       :   bool
}

CLASS_TYPE_MAP = {
    "string"        :   Entry,
    "file"          :   FileChooser,
    "icon"          :   IconChooser,
    #"sound"         :   SoundFileChooser,
    "keybinding"    :   Keybinding,
    "integer"       :   SpinButton,
    "float"         :   SpinButton,
    "boolean"       :   Switch
}

PROPERTIES_MAP = {
    "title"         : "label",
    "min"           : "mini",
    "max"           : "maxi",
    "step"          : "step",
    "units"         : "units",
    "select-dir"    : "dir_select",
    "expand-width"  : "expand_width",
    "ordering"        : "ordering"
}

CATEGORY_ROW_FILE = environ["XDG_RUNTIME_DIR"] + "/radio_category_row.txt"

UPDATE_OPTIONS_FILE = environ["XDG_RUNTIME_DIR"] + "/radio_update_options.txt"

DURATION = 150

# ~ STEP_BY_DEFAULT = 15

def list_edit_factory(options):
    kwargs = {}
    if 'options' in options:
        kwargs['valtype'] = VARIABLE_TYPE_MAP[options['type']]
        widget_type = ComboBox
        options_list = options['options']
        if isinstance(options_list, dict):
            kwargs['options'] = [(b, a) for a, b in options_list.items()]
        else:
            kwargs['options'] = zip(options_list, options_list)
    else:
        widget_type = CLASS_TYPE_MAP[options["type"]]
    class Widget(widget_type):
        def __init__(self, **kwargs):
            super(Widget, self).__init__(**kwargs)

            if self.bind_dir is None:
                self.connect_widget_handlers()

        def get_range(self):
            return None

        def set_value(self, value):
            self.widget_value = value

        def get_value(self):
            if hasattr(self, "widget_value"):
                return self.widget_value
            else:
                return None

        def set_widget_value(self, value):
            if self.bind_dir is None:
                self.widget_value = value
                self.on_setting_changed()
            else:
                if hasattr(self, "bind_object"):
                    self.bind_object.set_property(self.bind_prop, value)
                else:
                    self.content_widget.set_property(self.bind_prop, value)

        def get_widget_value(self):
            if self.bind_dir is None:
                try:
                    return self.widget_value
                except Exception as e:
                    return None
            else:
                if hasattr(self, "bind_object"):
                    return self.bind_object.get_property(self.bind_prop)
                return self.content_widget.get_property(self.bind_prop)

    for prop in options:
        if prop in PROPERTIES_MAP:
            kwargs[PROPERTIES_MAP[prop]] = options[prop]

    return Widget(**kwargs)


class List(SettingsWidget):
    bind_dir = None

    def __init__(self, label=None, columns=None, height=200, size_group=None, \
                 dep_key=None, tooltip="", show_buttons=True, reorderable=False):
        super(List, self).__init__(dep_key=dep_key)
        self.columns = columns

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)
        self.set_margin_left(0)
        self.set_margin_right(0)
        self.set_border_width(0)

        if label != None:
            self.label = Gtk.Label(label)

        """ Specific to Radio3.0: BEGIN"""
        self.index_for_url = 0
        self.index_for_name = 0
        self.index_for_inc = 0
        self.index_for_tags = 0
        """ Specific to Radio3.0: END"""

        self.content_widget = Gtk.TreeView()
        self.content_widget.set_enable_search(True)
        self.content_widget.set_enable_tree_lines(True)
        self.content_widget.set_grid_lines(Gtk.TreeViewGridLines.HORIZONTAL)
        self.content_widget.set_reorderable(reorderable)
        #self.content_widget.set_headers_clickable(reorderable)
        #self.content_widget.set_row_separator_func(self.separator_function)

        self.scrollbox = Gtk.ScrolledWindow()
        self.scrollbox.set_size_request(-1, height)
        self.scrollbox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.scrollbox.set_propagate_natural_height(True)
        self.scrollbox.set_propagate_natural_width(True)

        self.scrollbox.set_overlay_scrolling(True)

        self.scrollbox.set_kinetic_scrolling(False)
        self.scrollbox.set_capture_button_press(False)
        self.scrollbox.connect("button_release_event", self.timed_update_button_sensitivity)
        self.scrollbox.connect("edge_reached", self.timed_update_button_sensitivity)
        self.scrollbox.connect("scroll_event", self.timed_update_button_sensitivity)

        self.pack_start(self.scrollbox, True, True, 0)
        self.scrollbox.add(self.content_widget)

        # ~ self.path = "0"
        self.path_of_changed_row = None
        self.show_buttons = show_buttons

        types = []
        tv_columns = []
        for i in range(len(columns)):
            column_def = columns[i]
            types.append(VARIABLE_TYPE_MAP[column_def['type']])

            has_option_map = 'options' in column_def and isinstance(column_def['options'], dict)
            render_type = 'string' if has_option_map else column_def['type']

            """ Specific to Radio3.0: BEGIN"""
            if column_def['id'] == 'name' and not has_option_map:
                self.index_for_name = 0 + i

            if column_def['id'] == 'url' and not has_option_map:
                self.index_for_url = 0 + i

            if column_def['id'] == 'inc' and not has_option_map:
                self.index_for_inc = 0 + i

            if column_def['id'] == 'tags' and not has_option_map:
                self.index_for_tags = 0 + i

            is_name = column_def['id'] == 'name'and not has_option_map
            """ Specific to Radio3.0: END"""

            if render_type == 'boolean':
                renderer = Gtk.CellRendererToggle()

                def toggle_checkbox(renderer, path, column):
                    self.model[path][column] = not self.model[path][column]

                    # ~ if self.content_widget != None and self.content_widget.get_visible_range() != None:
                        # ~ self.path = self.content_widget.get_visible_range()[0].to_string()
                    # ~ else:
                        # ~ self.path = "0"

                    self.list_changed()

                renderer.connect('toggled', toggle_checkbox, i)
                prop_name = 'active'
                column = Gtk.TreeViewColumn(column_def['title'], renderer)
            elif render_type == 'icon':
                renderer = Gtk.CellRendererPixbuf()
                prop_name = 'icon_name'
                column = Gtk.TreeViewColumn(column_def['title'], renderer)
            else:
                renderer = Gtk.CellRendererText()
                renderer.set_fixed_height_from_font(1)
                prop_name = 'text'
                if is_name:
                    column = Gtk.TreeViewColumn(column_def['title'], renderer, weight_set=True)
                else:
                    column = Gtk.TreeViewColumn(column_def['title'], renderer)

            if has_option_map:
                def map_func(col, rend, model, row_iter, options):
                    value = model[row_iter][i]
                    for key, val in options.items():
                        if val == value:
                            rend.set_property('text', key)

                column.set_cell_data_func(renderer, map_func, column_def['options'])
            elif is_name:
                def map_func_for_name(col, rend, model, row_iter, data):
                    url_value = model[row_iter][self.index_for_url]
                    inc_value = model[row_iter][self.index_for_inc]
                    # ~ print ("url_value:", url_value)
                    if url_value == None or url_value.strip() == "":
                        # ~ print("n_colums:", self.model.get_n_columns())
                        # ~ print("Categorie:", model[row_iter][self.index_for_name])
                        if rend.get_property('weight') != None:
                            if inc_value:
                                rend.set_property('weight', Pango.Weight.BOLD)
                            else:
                                rend.set_property('weight', 450)
                            rend.set_property('weight_set', True)
                    else:
                        if rend.get_property('weight') != None:
                            if inc_value:
                                rend.set_property('weight', Pango.Weight.NORMAL)
                            else:
                                rend.set_property('weight', Pango.Weight.SEMILIGHT)
                            rend.set_property('weight_set', True)

                column.add_attribute(renderer, prop_name, self.index_for_name)
                column.set_cell_data_func(renderer, map_func_for_name)
            else:
                column.add_attribute(renderer, prop_name, i)

            if 'align' in column_def:
                renderer.set_alignment(column_def['align'], 0.5)
                column.set_alignment(column_def['align'])

            column.set_resizable(True)
            self.content_widget.append_column(column)

        self.model = Gtk.ListStore(*types)
        self.content_widget.set_model(self.model)

        self.content_widget.set_search_column(self.index_for_name)

        self.content_widget.set_tooltip_column(self.index_for_tags)

        button_toolbar = Gtk.Toolbar()
        button_toolbar.set_icon_size(Gtk.IconSize.MENU)
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), \
                                       "inline-toolbar")
        self.pack_start(button_toolbar, True, False, 0)


        if show_buttons:
            self.add_button = Gtk.ToolButton(None, None)
            self.add_button.set_icon_name("list-add-symbolic")
            self.add_button.set_tooltip_text(_("Add new entry"))
            self.add_button.connect("clicked", self.add_item)
            self.remove_button = Gtk.ToolButton(None, None)
            self.remove_button.set_icon_name("list-remove-symbolic")
            self.remove_button.set_tooltip_text(_("Remove selected entry"))
            self.remove_button.connect("clicked", self.remove_item)
            self.remove_button.set_sensitive(False)
            self.edit_button = Gtk.ToolButton(None, None)
            self.edit_button.set_icon_name("list-edit-symbolic")
            self.edit_button.set_tooltip_text(_("Edit selected entry"))
            self.edit_button.connect("clicked", self.edit_item)
            self.edit_button.set_sensitive(False)
            self.unselect_all_button = Gtk.ToolButton(None, None)
            self.unselect_all_button.set_icon_name("checkbox-symbolic")
            self.unselect_all_button.set_tooltip_text(_("Unselect the selected row"))
            self.unselect_all_button.connect("clicked", self.unselect_all_item)
            self.unselect_all_button.set_sensitive(False)
            self.move_up_button = Gtk.ToolButton(None, None)
            self.move_up_button.set_icon_name("go-up-symbolic")
            self.move_up_button.set_tooltip_text(_("Move selected entry up"))
            self.move_up_button.connect("clicked", self.move_item_up)
            self.move_up_button.set_sensitive(False)
            self.move_down_button = Gtk.ToolButton(None, None)
            self.move_down_button.set_icon_name("go-down-symbolic")
            self.move_down_button.set_tooltip_text(_("Move selected entry down"))
            self.move_down_button.connect("clicked", self.move_item_down)
            self.move_down_button.set_sensitive(False)


            self.vertical_separator_button1 = Gtk.ToolButton(None, None)
            self.vertical_separator_button1.set_label("")
            self.vertical_separator_button1.set_sensitive(False)
            self.vertical_separator_button2 = Gtk.ToolButton(None, None)
            self.vertical_separator_button2.set_label("")
            self.vertical_separator_button2.set_sensitive(False)

            button_toolbar.insert(self.add_button, 0)
            button_toolbar.insert(self.remove_button, 1)
            button_toolbar.insert(self.edit_button, 2)
            #button_toolbar.insert(self.vertical_separator_button1, 3)
            button_toolbar.insert(self.unselect_all_button, 4)
            #button_toolbar.insert(self.vertical_separator_button2, 5)
            button_toolbar.insert(self.move_up_button, 6)
            button_toolbar.insert(self.move_down_button, 7)

        self.bottom_button = Gtk.ToolButton(None, None)
        self.bottom_button.set_icon_name("go-bottom-symbolic")
        self.bottom_button.set_tooltip_text(_("Go to bottom"))
        self.bottom_button.connect("clicked", self.go_to_bottom)
        self.bottom_button.set_sensitive(True)
        self.next_page_button = Gtk.ToolButton(None, None)
        #self.next_page_button.set_icon_name("orientation-landscape-inverse-symbolic")
        self.next_page_button.set_icon_name("go-down-symbolic")
        self.next_page_button.set_tooltip_text(_("Go to next page"))
        self.next_page_button.connect("clicked", self.go_to_next_page)
        self.next_page_button.set_sensitive(True)
        self.previous_page_button = Gtk.ToolButton(None, None)
        #self.previous_page_button.set_icon_name("orientation-landscape-symbolic")
        self.previous_page_button.set_icon_name("go-up-symbolic")
        self.previous_page_button.set_tooltip_text(_("Go to previous page"))
        self.previous_page_button.connect("clicked", self.go_to_previous_page)
        self.previous_page_button.set_sensitive(False)
        self.top_button = Gtk.ToolButton(None, None)
        self.top_button.set_icon_name("go-top-symbolic")
        self.top_button.set_tooltip_text(_("Go to top"))
        self.top_button.connect("clicked", self.go_to_top)
        self.top_button.set_sensitive(False)
        self.vertical_separator_button3 = Gtk.ToolButton(None, None)
        self.vertical_separator_button3.set_label("")
        self.vertical_separator_button3.set_sensitive(False)
        self.vertical_separator_button3.set_expand(True)

        self.next_category_button = Gtk.ToolButton(None, None)
        is_rtl = self.content_widget.get_default_direction() == Gtk.TextDirection.RTL
        if is_rtl:
            self.next_category_button.set_icon_name("go-next-rtl-symbolic")
        else:
            self.next_category_button.set_icon_name("go-next-symbolic")
        self.next_category_button.set_tooltip_text(_("Go to next category"))
        self.next_category_button.connect("clicked", self.go_to_next_category)
        self.next_category_button.set_sensitive(True)

        self.previous_category_button = Gtk.ToolButton(None, None)
        is_rtl = self.content_widget.get_default_direction() == Gtk.TextDirection.RTL
        if is_rtl:
            self.previous_category_button.set_icon_name("go-previous-rtl-symbolic")
        else:
            self.previous_category_button.set_icon_name("go-previous-symbolic")
        self.previous_category_button.set_tooltip_text(_("Go to previous category"))
        self.previous_category_button.connect("clicked", self.go_to_previous_category)
        self.previous_category_button.set_sensitive(True)

        if is_rtl and show_buttons:
            button_toolbar.insert(self.next_category_button, 8)
            button_toolbar.insert(self.previous_category_button, 9)
        button_toolbar.insert(self.vertical_separator_button3, 10)
        button_toolbar.insert(self.top_button, 11)
        button_toolbar.insert(self.previous_page_button, 12)
        button_toolbar.insert(self.next_page_button, 13)
        button_toolbar.insert(self.bottom_button, 14)
        if not is_rtl and show_buttons:
            button_toolbar.insert(self.previous_category_button, 15)
            button_toolbar.insert(self.next_category_button, 16)

        self.content_widget.get_selection().connect("changed", self.timed_update_button_sensitivity)
        self.content_widget.set_activate_on_single_click(False)
        # ~ self.content_widget.connect("row-activated", self.on_row_activated)
        # ~ self.content_widget.connect("drag-data-received", self.connect_drag_data_received)
        # ~ self.content_widget.connect("drag-end", self.connect_drag_end)

        self.set_tooltip_text(tooltip)

        if show_buttons:
            self.file_row = Gio.File.new_for_path(CATEGORY_ROW_FILE)
            self.file_row_monitor = self.file_row.monitor_file(Gio.FileMonitorFlags.WATCH_MOVES, None)
            self.file_row_monitor.connect("changed", self.go_to_row)

    def update_button_sensitivity(self, *args):
        self.top_button.set_sensitive(True)
        self.previous_page_button.set_sensitive(True)
        self.next_page_button.set_sensitive(True)
        self.bottom_button.set_sensitive(True)
        self.previous_category_button.set_sensitive(True)
        self.next_category_button.set_sensitive(True)


        if self.show_buttons:
            model, selected = self.content_widget.get_selection().get_selected()
            if selected is None:
                self.remove_button.set_sensitive(False)
                self.edit_button.set_sensitive(False)
                self.unselect_all_button.set_sensitive(False)
            else:
                self.remove_button.set_sensitive(True)
                self.edit_button.set_sensitive(True)
                self.unselect_all_button.set_sensitive(True)

            if selected is None or model.iter_previous(selected) is None:
                self.move_up_button.set_sensitive(False)
            else:
                self.move_up_button.set_sensitive(True)

            if selected is None or model.iter_next(selected) is None:
                self.move_down_button.set_sensitive(False)
            else:
                self.move_down_button.set_sensitive(True)


        rectangle = self.content_widget.get_visible_rect()
        # ~ print("x:", rectangle.x, "y:", rectangle.y, "width:", rectangle.width, "height:", rectangle.height)

        visible_range = self.content_widget.get_visible_range()

        if rectangle.y < 10: # or (visible_range != None and int(visible_range[0].to_string())) == 0:
            self.top_button.set_sensitive(False)
            self.previous_page_button.set_sensitive(False)
            self.previous_category_button.set_sensitive(False)

        if visible_range != None and int(visible_range[1].to_string()) == len(self.model)-1:
            self.next_page_button.set_sensitive(False)
            self.bottom_button.set_sensitive(False)
            self.next_category_button.set_sensitive(False)

        return False

    def timed_update_button_sensitivity(self, *args):
        GLib.timeout_add(DURATION, self.update_button_sensitivity)

    def create_update_options_file(self, *args):
        GLib.file_set_contents(UPDATE_OPTIONS_FILE, bytes(str(uuid4()), encoding="utf8"))

    def timed_create_update_options_file(self, *args):
        GLib.timeout_add(DURATION, self.create_update_options_file)

    def on_row_activated(self, *args):
        self.edit_item()

    def add_item(self, *args):
        data = self.open_add_edit_dialog()
        if data != None:
            self.model.insert(0, data)
            self.list_changed()
            #self.on_setting_changed()
            self.go_to_top()
            self.timed_create_update_options_file()

    def remove_item(self, *args):
        self.path_of_changed_row = self.content_widget.get_cursor()[0].to_string()
        model, t_iter = self.content_widget.get_selection().get_selected()
        model.remove(t_iter)
        self.list_changed()
        self.timed_create_update_options_file()
        # ~ self.content_widget.get_selection().unselect_all()


    def edit_item(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        data = self.open_add_edit_dialog(model[t_iter])
        if data != None:
            for i in range(len(data)):
                self.model[t_iter][i] = data[i]
            self.list_changed()
            self.timed_create_update_options_file()

    def unselect_all_item(self, *args):
        self.content_widget.get_selection().unselect_all()

    def move_item_up(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        model.swap(t_iter, model.iter_previous(t_iter))
        self.path_of_changed_row = self.content_widget.get_cursor()[0].to_string()
        # ~ self.path = str(int(self.path)-1) if int(self.path) > 0 else "0"
        self.list_changed()

    def move_item_down(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        model.swap(t_iter, model.iter_next(t_iter))
        self.path_of_changed_row = self.content_widget.get_cursor()[0].to_string()
        # ~ self.path = str(int(self.path)+1)
        self.list_changed()

    def open_add_edit_dialog(self, info=None):
        if info is None:
            title = _("Add new entry")
        else:
            title = _("Edit entry")
        dialog = Gtk.Dialog(title, self.get_toplevel(), Gtk.DialogFlags.MODAL,
                            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                             Gtk.STOCK_OK, Gtk.ResponseType.OK))

        content_area = dialog.get_content_area()
        content_area.set_margin_right(30)
        content_area.set_margin_left(30)
        content_area.set_margin_top(20)
        content_area.set_margin_bottom(20)

        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class("view")
        content_area.add(frame)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(content)

        widgets = []
        for i in range(len(self.columns)):
            if len(widgets) != 0:
                content.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

            widget = list_edit_factory(self.columns[i])
            widgets.append(widget)

            settings_box = Gtk.ListBox()
            settings_box.set_selection_mode(Gtk.SelectionMode.NONE)

            content.pack_start(settings_box, True, True, 0)
            settings_box.add(widget)

            if info != None and info[i] != None:
                widget.set_widget_value(info[i])
            elif "default" in self.columns[i]:
                widget.set_widget_value(self.columns[i]["default"])

        content_area.show_all()
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            values = []
            for widget in widgets:
                values.append(widget.get_widget_value())

            dialog.destroy()
            # ~ self.path = "0"
            return values

        dialog.destroy()
        return None

    def go_to_row(self, *args):
        if GLib.file_test(CATEGORY_ROW_FILE, GLib.FileTest.EXISTS) and self.content_widget != None:
            row = str(int(GLib.file_get_contents(CATEGORY_ROW_FILE)[1]))
            path = Gtk.TreePath.new_from_string(row)
            self.content_widget.scroll_to_cell(path, None, True, 0.0, 0.0)
            self.timed_update_button_sensitivity()

    def go_to_just_edited_row(self):
        if  self.content_widget != None and \
            len(self.content_widget.get_model()) > 0 and \
            self.path_of_changed_row != None:
                path_of_changed_row = Gtk.TreePath.new_from_string(self.path_of_changed_row)
                self.content_widget.set_cursor_on_cell(path_of_changed_row, None, None, False)
                self.content_widget.scroll_to_cell(path_of_changed_row, None, True, 0.5, 0.0)
                self.timed_update_button_sensitivity()

    def go_to_top(self, *args):
        path_str = "0"
        path = Gtk.TreePath.new_from_string(path_str)
        self.content_widget.scroll_to_cell(path, None, True, 0.0, 0.0)

        self.bottom_button.set_sensitive(True)
        self.next_page_button.set_sensitive(True)
        self.next_category_button.set_sensitive(True)
        self.top_button.set_sensitive(False)
        self.previous_page_button.set_sensitive(False)
        self.previous_category_button.set_sensitive(False)

    def go_to_bottom(self, *args):
        path = Gtk.TreePath.new_from_string(str(len(self.model) - 1))
        self.content_widget.scroll_to_cell(path, None, True, 1.0, 0.0)

        self.bottom_button.set_sensitive(False)
        self.next_page_button.set_sensitive(False)
        self.next_category_button.set_sensitive(False)
        self.top_button.set_sensitive(True)
        self.previous_page_button.set_sensitive(True)
        self.previous_category_button.set_sensitive(True)

    def go_to_previous_category(self, *args):
        if self.content_widget != None and self.content_widget.get_visible_range() != None:
            self.content_widget.get_selection().unselect_all()
            path_str = self.content_widget.get_visible_range()[0].to_string()
            self.content_widget.scroll_to_cell(path_str, None, True, 0.0, 0.0)
            row_num = int(path_str)
            model = self.content_widget.get_model()
            if len(model[row_num][self.index_for_url]) == 0:
                row_num -= 1
            found = False
            while (row_num >= 0) and not found:
                if len(model[row_num][self.index_for_url]) == 0:
                    found = True
                    # ~ print("Found at %s: " % str(row_num), end=" ")
                    # ~ print(model[row_num][0 + self.index_for_name])
                row_num -= 1
            if found:
                path_str = str(row_num + 1)
            else:
                path_str = "0"

            path = Gtk.TreePath.new_from_string(path_str)
            self.content_widget.scroll_to_cell(path, None, True, 0.0, 0.0)
            self.timed_update_button_sensitivity()

        # ~ print("go_to_previous_category")

    def go_to_next_category(self, *args):
        if self.content_widget != None and self.content_widget.get_visible_range() != None:
            self.content_widget.get_selection().unselect_all()
            path_str = self.content_widget.get_visible_range()[0].to_string()
            self.content_widget.scroll_to_cell(path_str, None, True, 0.0, 0.0)
            row_num = int(path_str) + 1
            model = self.content_widget.get_model()
            if len(model[row_num][self.index_for_url]) == 0:
                row_num += 1
            found = False
            while row_num < len(model) and not found:
                if len(model[row_num][self.index_for_url]) == 0:
                    found = True
                    # ~ print("Found at %s: " % str(row_num), end=" ")
                    # ~ print(model[row_num][0 + self.index_for_name])
                row_num += 1
            if found:
                path_str = str(row_num - 1)
            else:
                path_str = "0"

            path = Gtk.TreePath.new_from_string(path_str)
            self.content_widget.scroll_to_cell(path, None, True, 0.0, 0.0)
            self.timed_update_button_sensitivity()

    def go_to_next_page(self, *args):
        rectangle = self.content_widget.get_visible_rect()
        print("x:", rectangle.x, "y:", rectangle.y, "width:", rectangle.width, "height:", rectangle.height)

        self.content_widget.scroll_to_point(-1, rectangle.y + rectangle.height)
        path = self.content_widget.get_path_at_pos(0, 0)[0].to_string()
        print("path:", path)

        self.timed_update_button_sensitivity()

    def go_to_previous_page(self, *args):
        rectangle = self.content_widget.get_visible_rect()
        print("x:", rectangle.x, "y:", rectangle.y, "width:", rectangle.width, "height:", rectangle.height)

        self.content_widget.scroll_to_point(-1, rectangle.y - rectangle.height)
        path = self.content_widget.get_path_at_pos(0, 0)[0].to_string()
        print("path:", path)

        self.timed_update_button_sensitivity()

    def list_changed(self, *args):
        data = []
        numrow = 0
        for row in self.model:
            i = 0
            row_info = {}
            #self.index_for_name = None
            for column in self.columns:
                row_info[column["id"]] = row[i]
                i += 1
            data.append(row_info)
            numrow += 1

        self.set_value(data)

        self.go_to_just_edited_row()
        self.timed_update_button_sensitivity()

    def on_setting_changed(self, *args):
        if self.content_widget.get_cursor()[0] != None:
            self.path_of_changed_row = self.content_widget.get_cursor()[0].to_string()
            # ~ print("path_of_changed_row:", self.path_of_changed_row)
        else:
            self.path_of_changed_row = None

        # ~ if self.content_widget != None and self.content_widget.get_visible_range() != None:
            # ~ self.path = self.content_widget.get_visible_range()[0].to_string()

        self.model.clear()
        rows = self.get_value()
        for row in rows:
            row_info = []
            for column in self.columns:
                cid = column["id"]
                if cid in row:
                    row_info.append(row[column["id"]])
                elif "default" in column:
                    row_info.append(column["default"])
                else:
                    row_info.append(None)
            self.model.append(row_info)

        self.content_widget.columns_autosize()

        self.go_to_just_edited_row()
        self.timed_update_button_sensitivity()

    def connect_widget_handlers(self, *args):
        self.content_widget.connect("row-activated", self.on_row_activated)
        self.content_widget.connect("drag-data-received", self.connect_drag_data_received)
        self.content_widget.connect("drag-end", self.connect_drag_end)
        # ~ pass

    def connect_drag_data_received(self, *args):
        # ~ for arg in args:
            # ~ print(arg)
        # ~ for i in range(len(args[4])):
            # ~ print(i, ":", args[4][i])
        dest = self.content_widget.get_drag_dest_row()[0]
        if dest != None:
            self.destination = dest
            # ~ print(dest.to_string())
        else:
            self.path_of_changed_row = self.destination.to_string()
            # ~ if self.content_widget != None and self.content_widget.get_visible_range() != None:
                # ~ self.path = self.content_widget.get_visible_range()[0].to_string()
            # ~ print(self.path)

    def connect_drag_end(self, *args):
        # ~ print(args[0].get_drag_dest_row().to_string())
        # ~ for key, value in args[0].items():
            # ~ print(key, value)
        # ~ if self.content_widget.get_cursor()[0] != None:
            # ~ self.path_of_changed_row = self.content_widget.get_cursor()[0].to_string()
            # ~ self.content_widget.get_selection().select_path(Gtk.TreePath.new_from_string(self.path_of_changed_row))
            # ~ print("path_of_changed_row:", self.path_of_changed_row)
        # ~ else:
            # ~ self.path_of_changed_row = None

        # ~ if self.content_widget != None and self.content_widget.get_visible_range() != None:
            # ~ self.path = self.content_widget.get_visible_range()[0].to_string()
        self.list_changed()
        self.content_widget.get_selection().unselect_all()

    # def separator_function (self, model, iter_):
        # return model[iter_][5] == None or model[iter_][5] == ""
