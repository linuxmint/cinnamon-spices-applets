#!/usr/bin/python3

"""
  desktopiconsize.py
  Copyright (C) 2016  Gaston Brito <2 previous words without separators in gmail>
 
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.
 
  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.
 
  You should have received a copy of the GNU General Public License along
  with this program; if not, write to the Free Software Foundation, Inc.,
  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
"""

"""
  Desktop Icon Size

  This works by setting the metadata in the gvfs filesystem for each element in the desktop.
  It is the same method used when resizing with the mouse in the native Resize icon option.

  The refresh of the elements (making sure Cinnamon detects the changes) is made
  by renaming the files with a prefix and then renaming again with the original name.

  The exception are system icons, since metadata is stored in a file. In that case the file
  browser process is killed and restarted. Pressing F5 in the desktop does not work, it causes
  the metadata file to be rewritten with the data in memory.

  The order of the elements is stored in a configuration file, it can be deleted in case of problems.

  Limitations :

  * All system icons in the metadata file appear in the order list, even the ones not showing on screen.
    Their status might be read from some configuration, leaving them at the end of the list should not
    affect with the layouts.

  * The flickering is caused by the slow refresh method, this could be improved a lot by adding some
    communication with the file browser. The same thing with the restart for system icons.
    A scale bar is also impractical with the current speed.

  * The types are not read/detected.

  * Only works with Cinnamon, a combo box/detection might be added to work with other environments.

  Tested with :

  * Linux Mint 18.0 64 bit  Cinnamon 3.0.7   nemo 3.0.6  Python 3.5.2
  * Linux Mint 17.0 32 bit  Cinnamon 2.2.13  nemo 2.2.2  Python 3.4.0
"""

import os, subprocess, sys, configparser, math, copy
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GdkPixbuf

WINDOW_TITLE = "Desktop Icon Size"
CONFIGURATION_FILE = ".desktopiconsize.conf"
PROGRAM_VERSION = "1.1"
PROGRAM_WEBSITE = "https://github.com/lotsrc/DesktopIconSize"
PROGRAM_COPYRIGHT = "Copyright (C) 2016  Gaston Brito"

# If changed these values must end with /

OVERRIDE_HOME_PATH = None
OVERRIDE_DESKTOP_PATH = None
OVERRIDE_CONFIG_PATH = None

# These values might be changed to work with other file managers

STRING_SCALE_SYSTEM = "icon-scale"
STRING_POSITION_SYSTEM = "nemo-icon-position"
SYSTEM_ICONS_FILE = ".config/nemo/desktop-metadata"

REFRESH_PREFIX = "dis000_"
NUM_PROFILES = 4

SCALE_MIN = 0.5
SCALE_MAX = 8
SCALE_STEP = 0.1

MARGIN_TOP_DEFAULT = 100
MARGIN_BOTTOM_DEFAULT = 200
MARGIN_LEFT_DEFAULT = 120
MARGIN_RIGHT_DEFAULT = 150
MARGIN_STEP = 10

GRID_WIDTH_DEFAULT = 150
GRID_HEIGHT_DEFAULT = 150
GRID_STEP = 1

BAR_ITEMS_DEFAULT = 5
BAR_POSX_DEFAULT = 50
BAR_POSY_DEFAULT = 50
BAR_STEP = 10

ROUND_START_DEFAULT = 270
ROUND_STEP_DEFAULT = 15
ROUND_START_STEP = 5.0
ROUND_STEP_STEP = 0.5
ROUND_POS_STEP = 10
ROUND_RADIUS_STEP = 10

BUTTON_ELEMENTS_SIZE = 16
MAIN_BORDER = 5
BOX_BORDER = 5
PACK_SPIN = 2
LOG_BORDER = 2
RESIZE_VERTICAL_DELTA = 100

LAYOUTS = ["Horizontal", "Vertical", "Double Horizontal", "Double Vertical", "Round"]
BAR_TYPES = ["None", "Horizontal", "Vertical"]

log_data = ""


class DesktopElement:
    """An icon on the desktop"""

    def __init__(self, name, scale, position_x, position_y, is_user):
        self.name = name
        self.scale = scale
        self.position_x = position_x
        self.position_y = position_y
        self.is_user = is_user          # Exists as a file in desktop folder, false for Computer, Home, Trash, Network and mounted volumes

    def display_name(self):
        pos_desktop = self.name.find(".desktop")
        if pos_desktop != -1:
            return self.name[:pos_desktop]
        pos_volume = self.name.find(".volume")
        if pos_volume != -1:
            return self.name[:pos_volume]
        return self.name

    def set_metadata(self, cfg, base_path, scale, x, y, just_scale):
        if self.is_user:
            set_file_metadata(base_path, self.name, scale, x, y, just_scale)
        else:
            set_file_metadata_system(cfg, self.name, scale, x, y, just_scale)

    @staticmethod
    def order_by_name(lista):
        """Return sorted list of index"""
        return sorted(range(len(lista)), key=lambda k: lista[k].display_name().lower())

    @staticmethod
    def element_index(plist, new_element):
        for i in range(len(plist)):
            if plist[i].name == new_element.name:
                return i
        return -1

"""
  These classes generate screen points based on certain parameters

  LinearPositionGenerator
  RoundPositionGenerator
"""


class LinearPositionGenerator:
    """Allows 4 different ways of moving across the screen, horizontal/vertical with or without alternation"""

    def __init__(self, is_horizontal, x, y, grid_width, grid_height, margin1, margin2, alternate, position_alternate):
        self.alternate = alternate
        self.first_section = True
        self.margin1, self.margin2 = margin1, margin2
        self.values = [x, y, x, y, position_alternate, grid_width, grid_height]
        if is_horizontal:  # self.values indexes to avoid different code paths
            self.pos1, self.pos2, self.pos2a, self.pos2b, self.delta1, self.delta2 = 0, 1, 3, 4, 5, 6
        else:
            self.pos1, self.pos2, self.pos2a, self.pos2b, self.delta1, self.delta2 = 1, 0, 2, 4, 6, 5

    def get_position(self):
        return self.values[0], self.values[1]

    def next(self):
        self.values[self.pos1] += self.values[self.delta1]
        if self.values[self.pos1] > self.margin2:
            self.values[self.pos1] = self.margin1
            if self.alternate:
                if self.first_section:
                    self.values[self.pos2a] += self.values[self.delta2]
                    self.values[self.pos2] = self.values[self.pos2b]
                else:
                    self.values[self.pos2b] -= self.values[self.delta2]
                    self.values[self.pos2] = self.values[self.pos2a]
                self.first_section = not self.first_section
            else:
                self.values[self.pos2] += self.values[self.delta2]


class RoundPositionGenerator:
    """Generates points of a elliptical shape"""

    def __init__(self, center_x, center_y, radius_x, radius_y, angle_start, angle_step):
        self.center_x, self.center_y = center_x, center_y
        self.radius_x, self.radius_y = radius_x, radius_y
        self.angle, self.step = angle_start * (math.pi / 180), angle_step * (math.pi / 180)
        self.pos_x = self.center_x + int(self.radius_x * math.cos(self.angle))
        self.pos_y = self.center_y + int(self.radius_y * math.sin(self.angle))

    def get_position(self):
        return self.pos_x, self.pos_y

    def next(self):
        # TODO Check complete turn
        self.angle += self.step
        self.pos_x = self.center_x + int(self.radius_x * math.cos(self.angle))
        self.pos_y = self.center_y + int(self.radius_y * math.sin(self.angle))


class Organization:
    """Parameters used to generate the icon layout"""

    def __init__(self, screen_width, screen_height, system_metadata_path, desktop_path, elements, order, manage_system_icons):
        self.layout = 0
        self.scale = 1.0
        self.margin_top = MARGIN_TOP_DEFAULT
        self.margin_bottom = MARGIN_BOTTOM_DEFAULT
        self.margin_left = MARGIN_LEFT_DEFAULT
        self.margin_right = MARGIN_RIGHT_DEFAULT
        self.grid_width = GRID_WIDTH_DEFAULT
        self.grid_height = GRID_HEIGHT_DEFAULT
        self.screen_resolution = screen_width, screen_height
        self.elements = elements
        self.order = order
        self.desktop_path = desktop_path
        self.system_metadata_path = system_metadata_path
        self.manage_system_icons = manage_system_icons
        # Bar
        self.bar_type = 0
        self.bar_items = BAR_ITEMS_DEFAULT
        self.bar_posx = BAR_POSX_DEFAULT
        self.bar_posy = BAR_POSY_DEFAULT
        # Round
        self.round_posx = int(screen_width / 2)
        self.round_posy = int(screen_height / 2)
        mindim = min(screen_width, screen_height)
        self.round_radiusx = int(mindim / 3)
        self.round_radiusy = int(mindim / 3)
        self.round_start = ROUND_START_DEFAULT
        self.round_step = ROUND_STEP_DEFAULT

    def update_layout(self, window):
        self.layout = window.combo_layout.get_active()

    def update_scale(self, window):
        self.scale = window.scale.get_value()

    def update_margin(self, window):
        self.margin_top = window.margin_top.get_value_as_int()
        self.margin_bottom = window.margin_bottom.get_value_as_int()
        self.margin_left = window.margin_left.get_value_as_int()
        self.margin_right = window.margin_right.get_value_as_int()

    def update_grid(self, window):
        self.grid_width = window.spin_grid_width.get_value_as_int()
        self.grid_height = window.spin_grid_height.get_value_as_int()

    def update_bar(self, window):
        self.bar_type = window.combo_bar.get_active()
        self.bar_items = window.spin_bar_items.get_value_as_int()
        self.bar_posx = window.spin_bar_posx.get_value_as_int()
        self.bar_posy = window.spin_bar_posy.get_value_as_int()

    def update_round(self, window):
        self.round_posx = window.spin_round_posx.get_value_as_int()
        self.round_posy = window.spin_round_posy.get_value_as_int()
        self.round_radiusx = window.spin_round_radiusx.get_value_as_int()
        self.round_radiusy = window.spin_round_radiusy.get_value_as_int()
        self.round_start = window.spin_round_angle_start.get_value()
        self.round_step = window.spin_round_angle_step.get_value()

    def update_settings(self, window):
        self.manage_system_icons = window.manage_system_elements

    def apply(self, just_scale=False):
        if self.manage_system_icons:
            config = open_file_metadata_system(self.system_metadata_path)
        else:
            config = None

        log("Organization (" + str(self.layout) + "," + str(self.scale) + "," + str(self.grid_width) + "," + str(self.grid_height) + "," + str(self.margin_top) + "," + str(self.margin_bottom) + "," + str(self.margin_left) + "," + str(self.margin_right)+ ")")

        if self.layout == 0:
            gen = LinearPositionGenerator(True, self.margin_left, self.margin_top, self.grid_width, self.grid_height, self.margin_left, self.screen_resolution[0] - self.margin_right, False, 0)
        if self.layout == 1:
            gen = LinearPositionGenerator(False, self.margin_left, self.margin_top, self.grid_width, self.grid_height, self.margin_top, self.screen_resolution[1] - self.margin_bottom, False, 0)
        if self.layout == 2:
            gen = LinearPositionGenerator(True, self.margin_left, self.margin_top, self.grid_width, self.grid_height,  self.margin_left, self.screen_resolution[0] - self.margin_right, True, self.screen_resolution[1] - self.margin_bottom)
        if self.layout == 3:
            gen = LinearPositionGenerator(False, self.margin_left, self.margin_top, self.grid_width, self.grid_height, self.margin_top, self.screen_resolution[1] - self.margin_bottom, True, self.screen_resolution[0] - self.margin_right)
        if self.layout == 4:
            gen = RoundPositionGenerator(self.round_posx, self.round_posy, self.round_radiusx, self.round_radiusy, self.round_start, self.round_step)

        skip = self.organize_bar(config, just_scale)
        for i in range(skip, len(self.elements)):
            elem = self.elements[self.order[i]]
            if self.manage_system_icons or elem.is_user:
                posxc = clamp(gen.get_position()[0], 0, self.screen_resolution[0])
                posyc = clamp(gen.get_position()[1], 0, self.screen_resolution[1])
                elem.set_metadata(config, self.desktop_path, self.scale, posxc, posyc, just_scale)
                gen.next()

        refresh_items(self.desktop_path, self.elements)
        if config is not None:
            close_file_metadata_system(config, self.system_metadata_path)

    def organize_bar(self, cfg, just_scale):
        """This is always called before any other organization"""
        if self.bar_type == 0:
            return 0
        if self.bar_type == 1:
            gen = LinearPositionGenerator(True, self.bar_posx, self.bar_posy, self.grid_width, self.grid_height, self.bar_posx, self.screen_resolution[0] - self.margin_right, False, 0)
        else:
            gen = LinearPositionGenerator(False, self.bar_posx, self.bar_posy, self.grid_width, self.grid_height, self.bar_posy, self.screen_resolution[1] - self.margin_bottom, False, 0)
        skip = found = 0
        # Try to find at most self.bar_items elements
        while skip < len(self.order) and found < self.bar_items:
            elem = self.elements[self.order[skip]]
            if self.manage_system_icons or elem.is_user:
                found += 1
                posxc = clamp(gen.get_position()[0], 0, self.screen_resolution[0])
                posyc = clamp(gen.get_position()[1], 0, self.screen_resolution[1])
                elem.set_metadata(cfg, self.desktop_path, self.scale, posxc, posyc, just_scale)
                gen.next()
            skip += 1
        return skip


class ListBoxRowWithData(Gtk.ListBoxRow):

    def __init__(self, data):
        super(Gtk.ListBoxRow, self).__init__()
        self.data = data
        self.add(Gtk.Label(data))


class AboutInfoDialog(Gtk.AboutDialog):

    def __init__(self, parent):
        Gtk.Dialog.__init__(self, "About", parent, 0)
        self.set_program_name(WINDOW_TITLE)
        self.set_version(PROGRAM_VERSION)
        self.set_website(PROGRAM_WEBSITE)
        self.set_website_label(PROGRAM_WEBSITE)
        self.set_copyright(PROGRAM_COPYRIGHT)
        self.set_license_type(Gtk.License.GPL_2_0)
        try:
            logo = GdkPixbuf.Pixbuf.new_from_file_at_size(get_program_directory() + "icon.svg", 64, -1)
            self.set_logo(logo)
        except Exception as e:
            parent.log("Error AboutDialog : " + str(e))
        self.show()


class DISWindow(Gtk.Window):
    """Main window"""

    def __init__(self):
        Gtk.Window.__init__(self, title=WINDOW_TITLE)
        self.log("Init", False)

        self.apply_on_change = False
        self.update_organization = False
        self.active_profile = 0
        self.manage_system_elements = False

        self.screen_resolution = get_monitor_dimensions()
        self.log("Detected screen resolution " + str(self.screen_resolution), False)

        self.desktop_path = get_desktop_path()
        self.log("Using desktop path " + self.desktop_path, False)

        self.system_metadata_path = get_system_metadata_path()
        self.log("Using system metadata path " + self.system_metadata_path, False)

        self.load_icon()
        self.create_ui(self.screen_resolution[0], self.screen_resolution[1])

        # Default organizations

        elements = get_desktop_list(self.system_metadata_path)
        order_elements = DesktopElement.order_by_name(elements)
        self.organizations = []
        for i in range(NUM_PROFILES):
            self.organizations.append(Organization(self.screen_resolution[0], self.screen_resolution[1], self.system_metadata_path, self.desktop_path, copy.deepcopy(elements), list(order_elements), False))

        load_config(self)
        self.combo_active_profile.set_active(self.active_profile)
        self.switch_system_icons.set_active(self.manage_system_elements)
        if self.manage_system_elements:
            self.update_list_elements()
            for i in range(NUM_PROFILES):
                self.organizations[i].update_settings(self)
        else:
            reload_elements(self)
        self.set_organization(self.organizations[self.active_profile])
        self.apply_on_change = not self.manage_system_elements
        self.update_organization = True
        self.log("Init complete")

    def load_icon(self):
        full_icon_path = get_program_directory() + "icon.png"
        try:
            self.set_icon_from_file(full_icon_path)
        except Exception as e:
            log("Error: Could not load window icon " + full_icon_path)

    def display_mode(self, adjust_size):
        self.show_all()
        if self.combo_layout.get_active() == 4:
            self.box_margin_all.hide()
            self.box_round_all.show()
        else:
            self.box_round_all.hide()
            self.box_margin_all.show()
        # Avoid window with height for all boxes at the same time
        if adjust_size:
            size = self.get_size()
            self.resize(size[0], size[1] - RESIZE_VERTICAL_DELTA)

    def set_organization(self, org):
        self.combo_layout.set_active(org.layout)
        self.scale.set_value(org.scale)
        self.margin_top.set_value(org.margin_top)
        self.margin_bottom.set_value(org.margin_bottom)
        self.margin_left.set_value(org.margin_left)
        self.margin_right.set_value(org.margin_right)
        self.spin_grid_width.set_value(org.grid_width)
        self.spin_grid_height.set_value(org.grid_height)

        self.combo_bar.set_active(org.bar_type)
        self.spin_bar_items.set_value(org.bar_items)
        self.spin_bar_posx.set_value(org.bar_posx)
        self.spin_bar_posy.set_value(org.bar_posy)

        self.spin_round_posx.set_value(org.round_posx)
        self.spin_round_posy.set_value(org.round_posy)
        self.spin_round_radiusx.set_value(org.round_radiusx)
        self.spin_round_radiusy.set_value(org.round_radiusy)
        self.spin_round_angle_start.set_value(org.round_start)
        self.spin_round_angle_step.set_value(org.round_step)

    def create_ui(self, screen_width, screen_height):
        self.set_border_width(MAIN_BORDER)

        self.box_main = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)

        self.create_notebook()

        self.create_settings()
        self.create_ui_info()
        self.create_ui_log()

        self.box_icon_left  = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self.box_icon_right = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        self.box_page_icons.pack_start(self.box_icon_left, True, True, 0)
        self.box_page_icons.pack_start(self.box_icon_right, True, True, 0)

        self.create_combo_layouts()
        self.create_scale()
        self.create_combo_active_profile()
        self.create_list_elements()
        self.create_ui_grid(screen_width, screen_height)
        self.create_ui_margins(screen_width, screen_height)
        self.create_ui_round_options(screen_width, screen_height)
        self.create_ui_bar(screen_width, screen_height)
        self.create_buttons_bottom()

    def create_combo_active_profile(self):
        self.box_active_profile = create_vbox(BOX_BORDER)

        self.label_active_profile = Gtk.Label("Active profile", xalign=0)

        self.combo_active_profile = Gtk.ComboBoxText()
        for i in range(NUM_PROFILES):
            self.combo_active_profile.append_text("Profile " + str(i + 1))
        self.combo_active_profile.set_active(self.active_profile)
        self.combo_active_profile.connect("changed", self.on_combo_active_profile_changed)

        self.box_active_profile.pack_start(self.label_active_profile, False, False, 0)
        self.box_active_profile.pack_start(self.combo_active_profile, False, False, 0)

        self.box_icon_right.pack_start(self.box_active_profile, False, False, 0)

    def create_notebook(self):
        self.notebook = Gtk.Notebook()

        self.box_page_icons = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.box_page_settings = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

        self.notebook.append_page(self.box_page_icons, Gtk.Label('Icons'))
        self.notebook.append_page(self.box_page_settings, Gtk.Label('Settings'))

        self.box_main.pack_start(self.notebook, True, True, 0)
        self.add(self.box_main)

    def create_settings(self):
        self.box_system_icons = create_hbox(BOX_BORDER)

        self.label_system_icons = Gtk.Label("Manage system icons. Requires nemo restart to apply changes", xalign=0)
        self.switch_system_icons = Gtk.Switch()
        self.switch_system_icons.set_active(False)
        self.switch_system_icons.connect("notify::active", self.on_switch_system_icons_activated)

        self.box_system_icons.pack_start(self.label_system_icons, False, False, 0)
        self.box_system_icons.pack_end(self.switch_system_icons, False, False, 0)

        self.box_page_settings.pack_start(self.box_system_icons, False, False, 0)

    def create_ui_info(self):
        self.box_info = create_hbox(BOX_BORDER)

        self.label_desktop_path = Gtk.Label("Desktop path")
        self.entry_desktop_path = create_entry(False, self.desktop_path)

        self.box_info.pack_start(self.label_desktop_path, False, False, 0)
        self.box_info.pack_end(self.entry_desktop_path, False, False, 0)

        self.box_screen_width = create_hbox(BOX_BORDER)

        self.label_screen_width = Gtk.Label("Screen width")
        self.entry_screen_width = create_entry(False, str(self.screen_resolution[0]))

        self.box_screen_width.pack_start(self.label_screen_width, False, False, 0)
        self.box_screen_width.pack_end(self.entry_screen_width, False, False, 0)

        self.box_screen_height = create_hbox(BOX_BORDER)

        self.label_screen_height = Gtk.Label("Screen height")
        self.entry_screen_height = create_entry(False, str(self.screen_resolution[1]))

        self.box_screen_height.pack_start(self.label_screen_height, False, False, 0)
        self.box_screen_height.pack_end(self.entry_screen_height, False, False, 0)

        self.box_page_settings.pack_start(self.box_info, False, False, 0)
        self.box_page_settings.pack_start(self.box_screen_width, False, False, 0)
        self.box_page_settings.pack_start(self.box_screen_height, False, False, 0)

    def create_ui_log(self):
        self.box_log = create_vbox(BOX_BORDER)

        self.label_log = Gtk.Label("Log", xalign=0)

        self.textview_log = Gtk.TextView()
        self.textview_log.set_editable(False)
        self.textview_log.set_border_width(LOG_BORDER)
        self.textview_log_buffer = self.textview_log.get_buffer()

        self.textview_log_scroll = Gtk.ScrolledWindow()
        self.textview_log_scroll.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.textview_log_scroll.add(self.textview_log)

        self.box_log.pack_start(self.label_log, False, False, 0)
        self.box_log.pack_start(self.textview_log_scroll, True, True, 0)

        self.box_page_settings.pack_start(self.box_log, True, True, 0)

    def log(self, text, update_ui=True):
        global log_data
        log_data += text + "\n"
        if update_ui:
            self.textview_log_buffer.set_text(log_data)

    def create_combo_layouts(self):
        self.box_layouts = create_vbox(BOX_BORDER)

        self.label_layouts = Gtk.Label("Layout", xalign=0)
        self.box_layouts .pack_start(self.label_layouts, False, False, 0)

        self.combo_layout = Gtk.ComboBoxText()
        for layout in LAYOUTS:
            self.combo_layout.append_text(layout)
        self.combo_layout.set_active(0)
        self.combo_layout.connect("changed", self.on_combo_layout_changed)

        self.box_layouts.pack_start(self.combo_layout, False, False, 0)

        self.box_icon_left.pack_start(self.box_layouts, False, False, 0)

    def create_scale(self):
        self.box_scale = create_vbox(BOX_BORDER)

        self.box_icon_left.add(self.box_scale)

        self.label_scale = Gtk.Label("Scale", xalign=0)
        self.box_scale.pack_start(self.label_scale, False, False, 0)

        self.scale = create_spin_button(1, SCALE_MIN, SCALE_MAX, SCALE_STEP, 2, self.on_scale_changed)
        self.box_scale.add(self.scale)

    def create_ui_margins(self, screen_width, screen_height):
        self.box_margin_all = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

        self.box = create_hbox(BOX_BORDER)

        self.box_margin_header = create_header_box("Margin (pixels)")
        self.box_margin_all.pack_start(self.box_margin_header, False, False, 0)
        self.box_margin_all.pack_start(self.box, False, False, 0)
        self.box_icon_left.add(self.box_margin_all)

        self.box_margin_left = create_vbox(0)
        self.box_margin_right = create_vbox(0)

        self.label_margin_top = Gtk.Label("Top", xalign=0)
        self.label_margin_bottom = Gtk.Label("Bottom", xalign=0)
        self.label_margin_left = Gtk.Label("Left", xalign=0)
        self.label_margin_right = Gtk.Label("Right", xalign=0)

        self.margin_top = create_spin_button(MARGIN_TOP_DEFAULT, 0, screen_height, MARGIN_STEP, 0, self.on_margin_changed)
        self.margin_bottom = create_spin_button(MARGIN_BOTTOM_DEFAULT, 0, screen_height, MARGIN_STEP, 0, self.on_margin_changed)
        self.margin_left = create_spin_button(MARGIN_LEFT_DEFAULT, 0, screen_width, MARGIN_STEP, 0, self.on_margin_changed)
        self.margin_right = create_spin_button(MARGIN_RIGHT_DEFAULT, 0, screen_width, MARGIN_STEP, 0, self.on_margin_changed)

        self.box_margin_left.pack_start(self.label_margin_top, False, False, 0)
        self.box_margin_left.pack_start(self.margin_top, False, False, PACK_SPIN)
        self.box_margin_right.pack_start(self.label_margin_bottom, False, False, 0)
        self.box_margin_right.pack_start(self.margin_bottom, False, False, PACK_SPIN)
        self.box_margin_left.pack_start(self.label_margin_left, False, False, 0)
        self.box_margin_left.pack_start(self.margin_left, False, False, PACK_SPIN)
        self.box_margin_right.pack_start(self.label_margin_right, False, False, 0)
        self.box_margin_right.pack_start(self.margin_right, False, False, PACK_SPIN)

        self.box.pack_start(self.box_margin_left, False, False, 0)
        self.box.pack_end(self.box_margin_right, False, False, 0)

    def create_ui_grid(self, screen_width, screen_height):
        self.box_grid_all = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

        self.box_grid = create_hbox(BOX_BORDER)

        self.box_grid_left = create_vbox(0)
        self.box_grid_right = create_vbox(0)

        self.box_grid_header = create_header_box("Grid (pixels)")
        self.box_grid_all.pack_start(self.box_grid_header, False, False, 0)
        self.box_grid_all.add(self.box_grid)
        self.box_icon_left.add(self.box_grid_all)

        self.label_grid_width = Gtk.Label("Width", xalign=0)
        self.label_grid_height = Gtk.Label("Height", xalign=0)

        self.spin_grid_width = create_spin_button(GRID_WIDTH_DEFAULT, 0, screen_width, GRID_STEP, 0, self.on_grid_changed)
        self.spin_grid_height = create_spin_button(GRID_HEIGHT_DEFAULT, 0, screen_height, GRID_STEP, 0, self.on_grid_changed)

        self.box_grid_left.add(self.label_grid_width)
        self.box_grid_left.pack_start(self.spin_grid_width, False, False, PACK_SPIN)
        self.box_grid_right.add(self.label_grid_height)
        self.box_grid_right.pack_start(self.spin_grid_height, False, False, PACK_SPIN)

        self.box_grid.pack_start(self.box_grid_left, False, False, 0)
        self.box_grid.pack_end(self.box_grid_right, False, False, 0)

    def create_ui_bar(self, screen_width, screen_height):
        self.box_bar_all = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

        self.box_bar = create_hbox(BOX_BORDER)
        self.box_bar_left = create_vbox(0)
        self.box_bar_right = create_vbox(0)

        # Combo types

        self.label_bar_type = Gtk.Label("Type", xalign=0)

        self.combo_bar = Gtk.ComboBoxText()
        for bar in BAR_TYPES:
            self.combo_bar.append_text(bar)
        self.combo_bar.set_active(0)
        self.combo_bar.connect("changed", self.on_combo_bar_changed)

        # Spin items

        self.label_bar_items = Gtk.Label("# First items", xalign=0)
        self.spin_bar_items = create_spin_button(BAR_ITEMS_DEFAULT, 1, 1000, 1, 0, self.on_bar_changed)
        self.spin_bar_items.set_tooltip_text("Number of elements used to make the bar")

        self.box_bar_left.pack_start(self.label_bar_type, False, False, 0)
        self.box_bar_left.pack_start(self.combo_bar, False, False, PACK_SPIN)

        self.box_bar_right.pack_start(self.label_bar_items, False, False, 0)
        self.box_bar_right.pack_start(self.spin_bar_items, False, False, PACK_SPIN)

        # Position

        self.label_bar_posx = Gtk.Label("Left (pixels)", xalign=0)
        self.label_bar_posy = Gtk.Label("Top (pixels)", xalign=0)

        self.spin_bar_posx = create_spin_button(BAR_POSX_DEFAULT, 0, screen_width, BAR_STEP, 0, self.on_bar_changed)
        self.spin_bar_posy = create_spin_button(BAR_POSY_DEFAULT, 0, screen_height, BAR_STEP, 0, self.on_bar_changed)
        self.spin_bar_posx.set_tooltip_text("Starting position of bar")
        self.spin_bar_posy.set_tooltip_text("Starting position of bar")

        self.box_bar_left.pack_start(self.label_bar_posy, False, False, 0)
        self.box_bar_left.pack_start(self.spin_bar_posy, False, False, PACK_SPIN)

        self.box_bar_right.pack_start(self.label_bar_posx, False, False, 0)
        self.box_bar_right.pack_start(self.spin_bar_posx, False, False, PACK_SPIN)

        self.box_bar.pack_start(self.box_bar_left, False, False, 0)
        self.box_bar.pack_end(self.box_bar_right, False, False, 0)

        self.box_bar_header = create_header_box("Bar")
        self.box_bar_all.add(self.box_bar_header)

        self.box_bar_all.add(self.box_bar)
        self.box_icon_left.add(self.box_bar_all)

    def create_ui_round_options(self, screen_width, screen_height):
        self.box_round_all = create_vbox(0)

        self.box_round_center = create_hbox(BOX_BORDER)
        self.box_round_center_left = create_vbox(0)
        self.box_round_center_right = create_vbox(0)

        self.box_round_center.pack_start(self.box_round_center_left, False, False, 0)
        self.box_round_center.pack_end(self.box_round_center_right, False, False, 0)

        self.label_round_posx = Gtk.Label("Left", xalign=0)
        self.label_round_posy = Gtk.Label("Top", xalign=0)

        self.spin_round_posx = create_spin_button(screen_width / 2, 0, screen_width, ROUND_POS_STEP, 0, self.on_spin_round_changed)
        self.spin_round_posy = create_spin_button(screen_height / 2, 0, screen_height, ROUND_POS_STEP, 0, self.on_spin_round_changed)

        self.box_round_size = create_hbox(BOX_BORDER)
        self.box_round_size_left = create_vbox(0)
        self.box_round_size_right = create_vbox(0)

        self.box_round_size.pack_start(self.box_round_size_left, False, False, 0)
        self.box_round_size.pack_end(self.box_round_size_right, False, False, 0)

        self.label_round_radiusx = Gtk.Label("Width", xalign=0)
        self.label_round_radiusy = Gtk.Label("Height", xalign=0)

        min_dim = int(min(screen_width, screen_height) / 3)

        self.spin_round_radiusx = create_spin_button(min_dim, 0, screen_width, ROUND_RADIUS_STEP, 0, self.on_spin_round_changed)
        self.spin_round_radiusy = create_spin_button(min_dim, 0, screen_height, ROUND_RADIUS_STEP, 0, self.on_spin_round_changed)

        self.box_round_distance = create_hbox(BOX_BORDER)
        self.box_round_distance_left = create_vbox(0)
        self.box_round_distance_right = create_vbox(0)

        self.box_round_distance.pack_start(self.box_round_distance_left, False, False, 0)
        self.box_round_distance.pack_end(self.box_round_distance_right, False, False, 0)

        self.label_round_angle_start = Gtk.Label("Angle start", xalign=0)
        self.label_round_angle_step = Gtk.Label("Angle step", xalign=0)

        self.spin_round_angle_start = create_spin_button(ROUND_START_DEFAULT, 0, 360, ROUND_START_STEP, 2, self.on_spin_round_changed)
        self.spin_round_angle_step  = create_spin_button(ROUND_STEP_DEFAULT, 1, 360, ROUND_STEP_STEP, 2, self.on_spin_round_changed)

        self.box_round_center_left.pack_start(self.label_round_posy, False, False, 0)
        self.box_round_center_left.pack_start(self.spin_round_posy, False, False, PACK_SPIN)

        self.box_round_size_left.pack_start(self.label_round_radiusx, False, False, 0)
        self.box_round_size_left.pack_start(self.spin_round_radiusx, False, False, PACK_SPIN)

        self.box_round_distance_left.pack_start(self.label_round_angle_start, False, False, 0)
        self.box_round_distance_left.pack_start(self.spin_round_angle_start, False, False, PACK_SPIN)

        self.box_round_center_right.pack_start(self.label_round_posx, False, False, 0)
        self.box_round_center_right.pack_start(self.spin_round_posx, False, False, PACK_SPIN)

        self.box_round_size_right.pack_start(self.label_round_radiusy, False, False, 0)
        self.box_round_size_right.pack_start(self.spin_round_radiusy, False, False, PACK_SPIN)

        self.box_round_distance_right.pack_start(self.label_round_angle_step, False, False, 0)
        self.box_round_distance_right.pack_start(self.spin_round_angle_step, False, False, PACK_SPIN)

        self.box_round_center_header = create_header_box("Center (pixels)")
        self.box_round_all.pack_start(self.box_round_center_header, False, False, 0)
        self.box_round_all.pack_start(self.box_round_center, False, False, 0)

        self.box_round_size_header = create_header_box("Size (pixels)")
        self.box_round_all.pack_start(self.box_round_size_header, False, False, 0)
        self.box_round_all.pack_start(self.box_round_size, False, False, 0)

        self.box_round_distance_header = create_header_box("Distance (degrees)")
        self.box_round_all.pack_start(self.box_round_distance_header, False, False, 0)
        self.box_round_all.pack_start(self.box_round_distance, False, False, 0)

        self.box_icon_left.add(self.box_round_all)

    def create_list_elements(self):
        self.box_list_elements = create_vbox(BOX_BORDER)
        self.label_list_elements = Gtk.Label("Order", xalign=0)

        # Buttons

        self.box_order_buttons = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)

        self.button_up = create_button_image(get_program_directory() + "images/up.svg", BUTTON_ELEMENTS_SIZE, "Move element up", self.on_button_up_clicked)
        self.button_down = create_button_image(get_program_directory() + "images/down.svg", BUTTON_ELEMENTS_SIZE, "Move element down", self.on_button_down_clicked)
        self.button_top = create_button_image(get_program_directory() + "images/top.svg", BUTTON_ELEMENTS_SIZE, "Move element top", self.on_button_top_clicked)
        self.button_bottom = create_button_image(get_program_directory() + "images/bottom.svg", BUTTON_ELEMENTS_SIZE, "Move element bottom", self.on_button_bottom_clicked)
        self.button_refresh = create_button_image(get_program_directory() + "images/reload.svg", BUTTON_ELEMENTS_SIZE, "Reload elements", self.on_button_refresh_clicked)
        #self.button_sort_menu = create_button_image(get_program_directory() + "images/menu.svg", BUTTON_ELEMENTS_SIZE, "Sort options", self.on_button_refresh_clicked)

        self.box_order_buttons.pack_start(self.button_up, False, False, 0)
        self.box_order_buttons.pack_start(self.button_down, False, False, 0)
        self.box_order_buttons.pack_start(self.button_top, False, False, 0)
        self.box_order_buttons.pack_start(self.button_bottom, False, False, 0)
        self.box_order_buttons.pack_start(self.button_refresh, False, False, 0)
        #self.box_order_buttons.pack_start(self.button_sort_menu, False, False, 0)

        self.box_list_elements.pack_start(self.box_order_buttons, False, False, 5)

        self.liststore_elements = Gtk.ListStore(str)
        self.current_filter_language = None

        self.treeview_elements = Gtk.TreeView(self.liststore_elements)
        self.treeview_elements_selection = self.treeview_elements.get_selection()

        renderer = Gtk.CellRendererText()
        column = Gtk.TreeViewColumn("Order", renderer, text=0)
        self.treeview_elements.append_column(column)

        self.treeview_elements_scroll = Gtk.ScrolledWindow()
        self.treeview_elements_scroll.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        self.treeview_elements_scroll.set_vexpand(True)
        self.treeview_elements_scroll.add(self.treeview_elements)

        self.box_list_elements.pack_start(self.treeview_elements_scroll, True, True, 0)
        self.box_icon_right.pack_start(self.box_list_elements, True, True, 0)

    def create_buttons_bottom(self):
        self.box_buttons_bottom = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        self.button_about = create_button("About", self.on_button_about_clicked)
        self.button_apply = create_button("Apply", self.on_button_apply_clicked)
        self.button_close = create_button("Close", self.on_button_close_clicked)

        self.box_buttons_bottom.pack_start(self.button_about, False, False, 0)
        self.box_buttons_bottom.pack_end(self.button_close, False, False, 0)
        self.box_buttons_bottom.pack_end(self.button_apply, False, False, 0)

        self.box_main.pack_start(self.box_buttons_bottom, False, False, 0)

    def apply_organization(self, check_bar=False):
        if self.apply_on_change and ((not check_bar) or (self.combo_bar.get_active() != 0)):
            self.organizations[self.active_profile].apply()
            self.log("Organization done")

    def on_combo_active_profile_changed(self, combo):
        if self.update_organization:
            self.active_profile = self.combo_active_profile.get_active()
            original_value = self.apply_on_change
            self.apply_on_change = False
            self.update_organization = False
            self.set_organization(self.organizations[self.active_profile])
            self.update_organization = True
            self.update_list_elements()
            self.apply_on_change = original_value
            self.apply_organization()
            save_config(self)

    def on_combo_layout_changed(self, combo):
        if self.update_organization:
            self.organizations[self.active_profile].update_layout(self)
            self.display_mode(False)
            self.apply_organization()
            save_config(self)

    def on_combo_bar_changed(self, combo):
        if self.update_organization:
            self.organizations[self.active_profile].update_bar(self)
            self.apply_organization()
            save_config(self)

    def on_bar_changed(self, event):
        if self.update_organization:
            self.organizations[self.active_profile].update_bar(self)
            self.apply_organization(True)
            save_config(self)

    def on_margin_changed(self, event):
        if self.update_organization:
            self.organizations[self.active_profile].update_margin(self)
            self.apply_organization()
            save_config(self)

    def on_grid_changed(self, event):
        if self.update_organization:
            self.organizations[self.active_profile].update_grid(self)
            self.apply_organization()
            save_config(self)

    def on_scale_changed(self, event):
        if self.update_organization:
            self.organizations[self.active_profile].update_scale(self)
            self.apply_organization()
            save_config(self)

    def swap_order(self, i, j):
        tmp = self.organizations[self.active_profile].order[i]
        self.organizations[self.active_profile].order[i] = self.organizations[self.active_profile].order[j]
        self.organizations[self.active_profile].order[j] = tmp

    def on_button_up_clicked(self, button):
        model, it = self.treeview_elements_selection.get_selected()
        if it is not None:
            path = model.get_path(it).get_indices()
            if len(path) > 0:
                index = path[0]
                if index > 0:
                    self.swap_order(index - 1, index)
                    self.update_list_elements()
                    self.treeview_elements_selection.select_path(index - 1)
                    self.apply_organization()
                    save_config(self)

    def on_button_down_clicked(self, button):
        model, it = self.treeview_elements_selection.get_selected()
        if it is not None:
            path = model.get_path(it).get_indices()
            if len(path) > 0:
                index = path[0]
                if index + 1 < len(self.organizations[self.active_profile].elements):
                    self.swap_order(index + 1, index)
                    self.update_list_elements()
                    self.treeview_elements_selection.select_path(index + 1)
                    self.apply_organization()
                    save_config(self)

    def on_button_top_clicked(self, button):
        model, it = self.treeview_elements_selection.get_selected()
        if it is not None:
            path = model.get_path(it).get_indices()
            if len(path) > 0:
                index = path[0]
                if index > 0:
                    for n in range(index, 0, -1):
                        self.swap_order(n - 1, n)
                    self.update_list_elements()
                    self.treeview_elements_selection.select_path(0)
                    self.apply_organization()
                    save_config(self)

    def on_button_bottom_clicked(self, button):
        model, it = self.treeview_elements_selection.get_selected()
        if it is not None:
            path = model.get_path(it).get_indices()
            if len(path) > 0:
                index = path[0]
                if index + 1 < len(self.organizations[self.active_profile].elements):
                    for n in range(index, len(self.organizations[self.active_profile].elements) - 1):
                        self.swap_order(n, n + 1)
                    self.update_list_elements()
                    self.treeview_elements_selection.select_path(len(self.organizations[self.active_profile].elements) - 1)
                    self.apply_organization()
                    save_config(self)

    def on_spin_round_changed(self, event):
        if self.update_organization:
            self.organizations[self.active_profile].update_round(self)
            self.apply_organization()
            save_config(self)

    def on_button_refresh_clicked(self, button):
        reload_elements(self)

    def on_switch_system_icons_activated(self, switch, gparam):
        if self.update_organization:
            if switch.get_active():
                self.manage_system_elements = True
                self.apply_on_change = False
            else:
                self.manage_system_elements = False
                self.apply_on_change = True
            for i in range(NUM_PROFILES):
                self.organizations[i].update_settings(self)
            reload_elements(self)
            save_config(self)

    def on_button_apply_clicked(self, event):
        self.organizations[self.active_profile].apply()
        if self.manage_system_elements:
            restart_nemo()
            self.log("Nemo restarted")

    def on_button_about_clicked(self, event):
        dialog = AboutInfoDialog(self)
        dialog.run()
        dialog.destroy()

    def on_button_close_clicked(self, event):
        Gtk.main_quit()

    def update_list_elements(self):
        elements = self.organizations[self.active_profile].elements
        order = self.organizations[self.active_profile].order
        self.liststore_elements.clear()
        for elem in order:
            if self.manage_system_elements or elements[elem].is_user:
                self.liststore_elements.append([elements[elem].display_name()])


def get_program_directory():
    return format_directory_path(os.path.dirname(os.path.realpath(__file__)))


def format_directory_path(path):
    """Returns path with / at the end"""
    path = path.strip()
    if not path.endswith('/'):
        path += "/"
    return path


def get_home_path():
    if OVERRIDE_HOME_PATH is not None:
        return OVERRIDE_HOME_PATH
    return format_directory_path(os.path.expanduser("~"))


def get_desktop_path():
    if OVERRIDE_DESKTOP_PATH is not None:
        return OVERRIDE_DESKTOP_PATH
    ret_dir = None
    try:
        desktopdir = subprocess.check_output("xdg-user-dir DESKTOP", shell=True, stderr=subprocess.DEVNULL)
        desktopdir = desktopdir.decode("utf-8")
        ret_dir = desktopdir
    except Exception as e:
        pass
    if ret_dir is None:
        ret_dir = get_home_path() + "Desktop/"
    return format_directory_path(ret_dir)


def get_system_metadata_path():
    return get_home_path() + SYSTEM_ICONS_FILE


def get_config_file_path():
    if OVERRIDE_CONFIG_PATH is not None:
        return OVERRIDE_CONFIG_PATH
    return get_home_path() + "" + CONFIGURATION_FILE


def get_desktop_user_elements():
    """Returns a list of all files and directories in the desktop"""
    desktop_path = get_desktop_path()
    return os.listdir(desktop_path)


def get_desktop_list(system_elements_path):
    todos = get_desktop_user_elements()
    log("Found " + str(len(todos)) + " user elements :")
    for e in todos:
        log(e)
    res = []
    for i in range(len(todos)):
        res.append(DesktopElement(todos[i], 1, 0, 0, True))
    if system_elements_path is not None:
        try:
            c = read_text_file(system_elements_path)
            system_elements = get_desktop_system_elements(c)
            log("Found " + str(len(system_elements)) + " system elements :")
            for s in system_elements:
                log(s.name)
            return system_elements + res
        except Exception as e:
            return res
    return res


def parse_system_item(cad):
    first_closing_bracket = cad.find("]")
    if first_closing_bracket == -1:
        return "", -1, -1, -1
    name = cad[:first_closing_bracket]
    return DesktopElement(name, 1, 0, 0, False)


def read_text_file(path):
    f = open(path, 'r')
    text = f.read()
    f.close()
    return text


def get_desktop_system_elements(cad):
    res = []
    first_bracket = cad.find("[")
    if first_bracket == -1:
        return res
    parts = cad[first_bracket + 1:].split("[")
    for p in parts:
        e = parse_system_item(p)
        if e.name != "directory":
            res.append(e)
    return res


def set_file_metadata(base_path, file_name, scale, x, y, just_scale):
    try:
        subprocess.check_output("gvfs-set-attribute '" + base_path + file_name + "' metadata::" + STRING_SCALE_SYSTEM + " " + str(scale), shell=True, stderr=subprocess.DEVNULL)
        if not just_scale:
            subprocess.check_output("gvfs-set-attribute '" + base_path + file_name + "' metadata::" + STRING_POSITION_SYSTEM + " " + str(x) + ',' + str(y), shell=True, stderr=subprocess.DEVNULL)
    except Exception as e:
        log("Error setting metadata in " + file_name + " : " + str(e))


def open_file_metadata_system(system_metadata_path):
    cfg = configparser.ConfigParser()
    cfg.read(system_metadata_path)
    return cfg


def close_file_metadata_system(cfg, system_metadata_path):
    with open(system_metadata_path, 'wt') as configfile:
        cfg.write(configfile, space_around_delimiters=False)


def set_file_metadata_system(cfg, name, scale, x, y, just_scale):
    if not name in cfg:
        log(name + " section not found")
        return
    cfg[name][STRING_SCALE_SYSTEM] = str(scale)
    if not just_scale:
        cfg[name][STRING_POSITION_SYSTEM] = str(x) + "," + str(y)


def refresh_items(basepath, elements):
    for e in elements:
        if e.is_user:
            try:
                filename = e.name
                subprocess.check_output("mv '" + basepath + filename + "' '" + basepath + REFRESH_PREFIX + filename + "'", shell=True, stderr=subprocess.DEVNULL)
                subprocess.check_output("mv '" + basepath + REFRESH_PREFIX + filename + "' '" + basepath + filename + "'", shell=True, stderr=subprocess.DEVNULL)
            except Exception as e:
                log("Error refreshing " + filename + " : " + str(e))


def write_config_file(config):
    with open(get_config_file_path(), 'w') as configfile:
        config.write(configfile, space_around_delimiters=False)


def save_config(window):
    config = configparser.ConfigParser()
    config["DesktopIconSize"] = {}
    config["DesktopIconSize"]["profile"] = str(window.active_profile)
    config["DesktopIconSize"]["system"] = str(window.manage_system_elements)
    for i in range(len(window.organizations)):
        config["Profile" + str(i + 1)] = {}
        dis = config["Profile" + str(i + 1)]
        dis["layout"] = str(window.organizations[i].layout)
        dis["scale"] = str(window.organizations[i].scale)
        dis["margin-top"] = str(window.organizations[i].margin_top)
        dis["margin-bottom"] = str(window.organizations[i].margin_bottom)
        dis["margin-left"] = str(window.organizations[i].margin_left)
        dis["margin-right"] = str(window.organizations[i].margin_right)
        dis["grid-width"] = str(window.organizations[i].grid_width)
        dis["grid-height"] = str(window.organizations[i].grid_height)

        dis["bar_type"] = str(window.organizations[i].bar_type)
        dis["bar_items"] = str(window.organizations[i].bar_items)
        dis["bar_posx"] = str(window.organizations[i].bar_posx)
        dis["bar_posy"] = str(window.organizations[i].bar_posy)

        dis["round_posx"] = str(window.organizations[i].round_posx)
        dis["round_posy"] = str(window.organizations[i].round_posy)
        dis["round_radiusx"] = str(window.organizations[i].round_radiusx)
        dis["round_radiusy"] = str(window.organizations[i].round_radiusy)
        dis["round_start"] = str(window.organizations[i].round_start)
        dis["round_step"] = str(window.organizations[i].round_step)

        config["Order" + str(i + 1)] = {}
        conf_order = config["Order" + str(i + 1)]
        for index in range(len(window.organizations[i].order)):
            elem = window.organizations[i].elements[window.organizations[i].order[index]]
            conf_order[elem.name] = str(index)

    write_config_file(config)


def load_config(window):
    config = configparser.ConfigParser()
    config_file = get_config_file_path()
    log("Reading config file " + config_file)
    config.read(config_file)
    if not "DesktopIconSize" in config:
        log("Main section not in file")
        return
    log("Main section found")
    window.active_profile = int(config["DesktopIconSize"].get("profile", "0"))
    str_system = config["DesktopIconSize"].get("system", "False")
    window.manage_system_elements = str_system.lower() == "true"
    for i in range(NUM_PROFILES):
        cprofile = "Profile" + str(i+1)
        if cprofile in config:
            window.organizations[i].layout = int(config[cprofile].get("layout", 0))
            window.organizations[i].scale = float(config[cprofile].get("scale", 1))
            window.organizations[i].margin_top = int(config[cprofile].get("margin-top", MARGIN_TOP_DEFAULT))
            window.organizations[i].margin_bottom = int(config[cprofile].get("margin-bottom", MARGIN_BOTTOM_DEFAULT))
            window.organizations[i].margin_left = int(config[cprofile].get("margin-left", MARGIN_LEFT_DEFAULT))
            window.organizations[i].margin_right = int(config[cprofile].get("margin-right", MARGIN_RIGHT_DEFAULT))
            window.organizations[i].grid_width = int(config[cprofile].get("grid-width", MARGIN_TOP_DEFAULT))
            window.organizations[i].grid_height = int(config[cprofile].get("grid-height", MARGIN_TOP_DEFAULT))

            window.organizations[i].bar_type = int(config[cprofile].get("bar_type", 0))
            window.organizations[i].bar_items = int(config[cprofile].get("bar_items", BAR_ITEMS_DEFAULT))
            window.organizations[i].bar_posx = int(config[cprofile].get("bar_posx", BAR_POSX_DEFAULT))
            window.organizations[i].bar_posy = int(config[cprofile].get("bar_posy", BAR_POSY_DEFAULT))

            window.organizations[i].round_posx = int(config[cprofile].get("round_posx", 0))
            window.organizations[i].round_posy = int(config[cprofile].get("round_posy", 0))
            window.organizations[i].round_radiusx = int(config[cprofile].get("round_radiusx", 0))
            window.organizations[i].round_radisuy = int(config[cprofile].get("round_radiusy", 0))
            window.organizations[i].round_start = float(config[cprofile].get("round_start", ROUND_START_DEFAULT))
            window.organizations[i].round_step = float(config[cprofile].get("round_step", ROUND_STEP_DEFAULT))

        conf_order = "Order" + str(i+1)
        if conf_order in config:

            # For every element in window, read the position in the config file

            new_order = []
            maximum = -1
            for index in range(len(window.organizations[i].elements)):
                elem = window.organizations[i].elements[index]
                order_in_config_file = int(config[conf_order].get(elem.name, -1))
                new_order.append([index, order_in_config_file])
                maximum = max(order_in_config_file, maximum)

            # Send elements not in config file (new) at the end

            for k in range(len(new_order)):
                if new_order[k][1] == -1:
                    maximum += 1
                    new_order[k][1] = maximum

            # Sort all elements and assign order to window

            ordered = sorted(new_order, key=lambda v: v[1])
            for j in range(len(ordered)):
                window.organizations[i].order[j] = ordered[j][0]


def create_button(text, click_function):
    button = Gtk.Button(text)
    button.connect("clicked", click_function)
    return button


def create_button_image(image_path, size, tooltip_text, click_function):
    button = Gtk.Button()
    image = Gtk.Image.new_from_file(image_path)
    button.set_size_request(size, size)
    button.add(image)
    button.set_tooltip_text(tooltip_text)
    button.connect("clicked", click_function)
    return button


def create_spin_button(value, minv, maxv, step, num_digits, change_function):
    spin = Gtk.SpinButton(adjustment=Gtk.Adjustment(value, minv, maxv, step, 10*step, 0), digits=num_digits)
    spin.set_value(value)
    spin.connect("value-changed", change_function)
    return spin


def create_entry(editable, text):
    entry = Gtk.Entry()
    entry.set_editable(editable)
    entry.set_text(text)
    return entry


def create_hbox(border):
    box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
    box.set_border_width(border)
    return box


def create_vbox(border):
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
    box.set_border_width(border)
    return box


def create_header_box(text):
    box_header = create_vbox(BOX_BORDER)
    box_header.pack_start(Gtk.Label(text, xalign=0), False, False, 0)
    box_header.pack_start(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), False, False, 0)
    return box_header


def restart_nemo():
    # A better way of making nemo reload the metadata is needed
    log("Restarting nemo")
    subprocess.Popen('sh -c "nemo --quit && sleep 1 && nemo"', shell=True, stderr=subprocess.DEVNULL)


def log(text):
    global log_data
    log_data += text + "\n"


def reload_elements(window):
    if window.manage_system_elements:
        refreshed_elements = get_desktop_list(window.system_metadata_path)
    else:
        refreshed_elements = get_desktop_list(None)

    for p in range(NUM_PROFILES):
        new_order = []

        # Add old elements still on the desktop

        for i in range(len(window.organizations[p].order)):
            pos = DesktopElement.element_index(refreshed_elements, window.organizations[p].elements[window.organizations[p].order[i]])
            if pos != -1:
                new_order.append(pos)

        # Add new elements

        for j in range(len(refreshed_elements)):
            pos = DesktopElement.element_index(window.organizations[p].elements, refreshed_elements[j])
            if pos == -1:
                new_order.append(j)

        window.organizations[p].elements = copy.deepcopy(refreshed_elements)
        window.organizations[p].order = list(new_order)

    window.update_list_elements()


class ProfileHolder:

    def __init__(self):
        self.active_profile = 0
        self.manage_system_elements = False

        self.screen_resolution = get_monitor_dimensions()

        self.desktop_path = get_desktop_path()
        self.system_metadata_path = get_system_metadata_path()

        elements = get_desktop_list(self.system_metadata_path)
        order_elements = DesktopElement.order_by_name(elements)
        self.organizations = []
        for i in range(NUM_PROFILES):
            self.organizations.append(Organization(self.screen_resolution[0], self.screen_resolution[1], self.system_metadata_path, self.desktop_path, copy.deepcopy(elements), list(order_elements), False))

        load_config(self)
        if self.manage_system_elements:
            for i in range(NUM_PROFILES):
                self.organizations[i].screen_resolution = self.screen_resolution
                self.organizations[i].update_settings(self)
        else:
            reload_elements(self)

    def update_list_elements(self):
        pass


def load_profile(profile_number):
    profile_holder = ProfileHolder()
    print("Applying profile", profile_number)
    profile_holder.active_profile = profile_number
    profile_holder.organizations[profile_number].apply()
    if profile_holder.manage_system_elements:
        restart_nemo()
    save_config(profile_holder)
    print("Applying profile", profile_number, "done")


def set_icon_scale(value):
    profile_holder = ProfileHolder()
    print("Applying scale", value)
    profile_holder.organizations[profile_holder.active_profile].scale = value
    profile_holder.organizations[profile_holder.active_profile].apply()
    if profile_holder.manage_system_elements:
        restart_nemo()
    save_config(profile_holder)
    print("Applying scale", value, "done")


def clamp(n, smallest, largest):
    return max(smallest, min(n, largest))


class UnusedWindow(Gtk.Window):
    """Window used to get the monitor dimensions"""
    def __init__(self):
        Gtk.Window.__init__(self, title="Unused")


def get_monitor_dimensions():
    winx = UnusedWindow()
    screen = winx.get_screen()
    monitor = screen.get_monitor_at_window(screen.get_active_window())
    dimensions = screen.get_monitor_geometry(monitor)
    return dimensions.width, dimensions.height


def terminate():
    sys.exit(0)


if __name__ == "__main__":

    # Parse icon scale

    if len(sys.argv) > 2 and sys.argv[1] == "-s":
        try:
            icon_scale = float(sys.argv[2])
        except Exception as e:
            print("Scale must be a float number")
            terminate()
        if icon_scale < 0.5 or icon_scale > 8:
            print("Scale must be in [ 0.5 , 8 ]")
            terminate()
        set_icon_scale(icon_scale)
        terminate()

    # Parse profile number

    if len(sys.argv) > 2 and sys.argv[1] == "-p":
        try:
            profile = int(sys.argv[2])
        except Exception as e:
            print("Profile must be a number")
            terminate()
        if profile < 0 or profile >= NUM_PROFILES:
            print("Profile must be in [ 0 ,", NUM_PROFILES - 1, "]")
            terminate()
        load_profile(profile)
        terminate()

    # Open main window

    win = DISWindow()
    win.connect("delete-event", Gtk.main_quit)
    win.display_mode(True)
    Gtk.main()
