#!/usr/bin/python3

import os
import re
import subprocess
import shutil
import json
import gettext
from pathlib import Path
from collections import defaultdict
import gi

gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, Gio

gettext.install("theme-editor@fredcw", os.environ['HOME'] + "/.local/share/locale")

def gsettings_get(schema, key):
    if Gio.SettingsSchemaSource.get_default().lookup(schema, True) is not None:
        setting = Gio.Settings.new(schema)
        return setting.get_string(key)
    else:
        return ""

def gsettings_set(schema, key, value):
    if Gio.SettingsSchemaSource.get_default().lookup(schema, True) is not None:
        setting = Gio.Settings.new(schema)
        setting.set_string(key, value)

def get_scss_variables(root_directory):
    """
    Recursively searches a directory for .scss files and extracts 
    top-level variables with paths relative to root_directory.
    """
    results = []
    
    # Regex: Starts with $, captures name and value until semicolon
    var_pattern = re.compile(r'^\$([a-zA-Z0-9_-]+)\s*:\s*([^;]+)')

    for root, _, files in os.walk(root_directory):
        for file in files:
            if file.endswith('.scss'):
                full_path = os.path.join(root, file)
                
                # Calculate the relative path from the base search directory
                relative_path = os.path.relpath(full_path, root_directory)
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        for line_num, line in enumerate(f, 1):
                            match = var_pattern.match(line)
                            if match:
                                results.append({
                                    'filePath': relative_path,
                                    'lineNumber': line_num,
                                    'name': match.group(1).strip(),
                                    'value': match.group(2).strip()
                                })
                except (IOError, UnicodeDecodeError) as e:
                    print(f"Error reading {full_path}: {e}")

    return results

def update_scss_variables(root_directory, updated_variables):
    """
    Groups variables by file and updates specific line numbers 
    with new values in the original .scss files.
    """
    # 1. Group variables by filePath for efficiency
    files_to_update = defaultdict(list)
    for var in updated_variables:
        files_to_update[var['filePath']].append(var)

    for relative_path, vars_in_file in files_to_update.items():
        full_path = os.path.join(root_directory, relative_path)
        
        # Create a mapping of {lineNumber: new_value_string}
        # Format: $name: value;
        line_map = {
            v['lineNumber']: f"${v['name']}: {v['value']};" 
            for v in vars_in_file
        }

        try:
            # Read all lines from the file
            with open(full_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # 2. Update the lines based on the lineNumber (1-indexed)
            for line_num, new_content in line_map.items():
                # Subtract 1 because list indices are 0-based
                index = line_num - 1
                if index < len(lines):
                    # Preserving the newline character if it exists
                    suffix = '\n' if lines[index].endswith('\n') else ''
                    lines[index] = new_content + suffix

            # 3. Write the updated content back
            with open(full_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)

        except (IOError, OSError) as e:
            print(f"Error writing to {full_path}: {e}")

class StyleConfEditor(Gtk.Application):
    def __init__(self):
        super().__init__(application_id='com.fredcw.ThemeEditor',
                         flags=Gio.ApplicationFlags.FLAGS_NONE)
        self.theme_name = "custom-theme"
        self.theme_path = Path.home() / ".themes" / self.theme_name
        self.theme_path.mkdir(parents=True, exist_ok=True)
        self.config_path = self.theme_path / "cinnamon-style.conf"
        self.script_dir = Path(__file__).resolve().parent
        
        # Load default values from the script's local cinnamon folder
        defaults = get_scss_variables(self.script_dir / "cinnamon" / "cinnamon-sass")
        self.default_values = {v['name']: v['value'] for v in defaults}
        
        self.widgets = {}

    def is_color(self, value):
        value = value.strip()
        if re.match(r'^#(?:[0-9a-fA-F]{3}){1,2}$', value):
            return "hex"
        if re.match(r'^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$', value):
            return "rgb"
        if re.match(r'^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\)$', value):
            return "rgba"
        return None

    def rgba_to_hex(self, rgba):
        r, g, b = int(rgba.red * 255), int(rgba.green * 255), int(rgba.blue * 255)
        return f"#{r:02x}{g:02x}{b:02x}".upper()

    def rgba_to_rgb(self, rgba):
        r, g, b = int(rgba.red * 255), int(rgba.green * 255), int(rgba.blue * 255)
        return f"rgb({r}, {g}, {b})"

    def rgba_to_rgba_string(self, rgba):
        r, g, b = int(rgba.red * 255), int(rgba.green * 255), int(rgba.blue * 255)
        return f"rgba({r}, {g}, {b}, {round(rgba.alpha, 2)})"

    def do_activate(self):
        self.window = Gtk.ApplicationWindow(application=self, title="Cinnamon Theme Editor")
        self.window.set_default_size(650, 700)
        self.window.set_border_width(15)
        self.window.set_icon_from_file(str(self.script_dir) + "/icon.png")

        # Create HeaderBar (CSD)
        hb = Gtk.HeaderBar()
        hb.set_show_close_button(True)
        hb.set_title("Cinnamon Theme Editor")
        self.window.set_titlebar(hb)

        # Create Gear Menu
        menu_button = Gtk.MenuButton()
        menu_icon = Gtk.Image.new_from_icon_name("open-menu-symbolic", Gtk.IconSize.BUTTON)
        menu_button.add(menu_icon)
        hb.pack_end(menu_button)

        # Create Menu structure
        menu = Gio.Menu()
        menu.append(_("Reset all to default"), "win.reset_defaults")
        menu_button.set_menu_model(menu)

        # Register Action for Reset
        reset_action = Gio.SimpleAction.new("reset_defaults", None)
        reset_action.connect("activate", self.on_reset_clicked)
        self.window.add_action(reset_action)

        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.window.add(main_box)

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_shadow_type(Gtk.ShadowType.IN)
        main_box.pack_start(scrolled, True, True, 0)

        self.grid = Gtk.Grid(column_spacing=15, row_spacing=10)
        self.grid.set_margin_start(10)
        self.grid.set_margin_end(10)
        self.grid.set_margin_top(10)
        self.grid.set_margin_bottom(10)
        scrolled.add(self.grid)

        self.load_config()
        self.populate_grid()

        btn_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        main_box.pack_start(btn_box, False, False, 0)

        save_button = Gtk.Button(label=_("Save changes and set theme"))
        save_button.set_hexpand(True)
        save_button.get_style_context().add_class("suggested-action")
        save_button.connect("clicked", self.on_save_clicked)
        btn_box.pack_start(save_button, True, True, 0)

        self.window.show_all()

    def clear_grid(self):
        for child in self.grid.get_children():
            self.grid.remove(child)
        self.widgets = {}

    def load_config(self):
        theme_cinnamon_path = self.theme_path / "cinnamon"
        if not theme_cinnamon_path.exists():
            self.copy_cinnamon_theme()

        self.variables = get_scss_variables(self.theme_path / "cinnamon" / "cinnamon-sass")

        if not self.config_path.exists():
            return

        conf_values = {}
        # 1. Read the .conf file into a lookup dictionary
        try:
            with open(self.config_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Skip empty lines or comments
                    if not line or line.startswith('#'):
                        continue
                    
                    # Split by the first '=' found
                    if '=' in line:
                        key, val = line.split('=', 1)
                        conf_values[key.strip()] = val.strip()
        except FileNotFoundError:
            print(f"Error: {conf_filepath} not found.")
            return data_list

        # 2. Update the variables
        for item in self.variables:
            name_key = item.get('name')
            if name_key in conf_values:
                item['value'] = conf_values[name_key]

    def on_entry_changed(self, entry, color_btn, key_tuple):
        text = entry.get_text().strip()
        ctype = self.is_color(text)
        
        # Update the stored mode
        old_entry, old_btn, _ = self.widgets[key_tuple]
        self.widgets[key_tuple] = (old_entry, old_btn, ctype or "text")

        if ctype:
            rgba = Gdk.RGBA()
            if rgba.parse(text):
                # Block the color-set signal to prevent feedback loop
                color_btn.handler_block_by_func(self.on_color_set)
                color_btn.set_rgba(rgba)
                color_btn.set_property("use-alpha", True if ctype == "rgba" else False)
                color_btn.handler_unblock_by_func(self.on_color_set)
                color_btn.show()
        else:
            color_btn.hide()

    def on_color_set(self, color_btn, entry, key_tuple):
        rgba = color_btn.get_rgba()
        _, _, mode = self.widgets[key_tuple]
        
        if mode == "hex":
            new_text = self.rgba_to_hex(rgba)
        elif mode == "rgb":
            new_text = self.rgba_to_rgb(rgba)
        elif mode == "rgba":
            new_text = self.rgba_to_rgba_string(rgba)
        else:
            new_text = self.rgba_to_hex(rgba) # Default if it was text

        # Block the changed signal to prevent feedback loop
        entry.handler_block_by_func(self.on_entry_changed)
        entry.set_text(new_text)
        entry.handler_unblock_by_func(self.on_entry_changed)

    def on_individual_reset_clicked(self, button, entry, var_name):
        """Resets a single field to its original value from the local scss files"""
        original_val = self.default_values.get(var_name)
        if original_val:
            entry.set_text(original_val)

    def populate_grid(self):
        self.clear_grid()
        
        section = 0
        row = 0
        previous_source_file = ""

        for var in self.variables:
            if var["filePath"] != previous_source_file:
                header = Gtk.Label()
                header.set_markup(f"<b>{var['filePath']}</b>")
                header.set_margin_top(10)
                header.set_halign(Gtk.Align.START)
                self.grid.attach(header, 0, row, 2, 1)
                previous_source_file = var["filePath"]
                row += 1

            name = var["name"]
            value = var["value"]
            label = Gtk.Label(label=name)
            label.set_halign(Gtk.Align.END)
            self.grid.attach(label, 0, row, 1, 1)

            # Container for the entry and optional button
            hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
            hbox.set_hexpand(True)
            
            entry = Gtk.Entry()
            entry.set_text(value)
            entry.set_hexpand(True)
            hbox.pack_start(entry, True, True, 0)

            ctype = self.is_color(value)
            
            # We always create the button, but hide it if not a color
            color_btn = Gtk.ColorButton()
            color_btn.set_no_show_all(True) # Allows manual visibility control
            hbox.pack_start(color_btn, False, False, 0)
            
            # Add the individual reset button
            reset_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic", Gtk.IconSize.BUTTON)
            reset_btn.set_tooltip_text(_("Reset to default value"))
            reset_btn.connect("clicked", self.on_individual_reset_clicked, entry, name)
            hbox.pack_start(reset_btn, False, False, 0)
            
            key_tuple = (section, name)
            self.widgets[key_tuple] = (entry, color_btn, ctype or "text")

            if ctype:
                rgba = Gdk.RGBA()
                if rgba.parse(value):
                    color_btn.set_rgba(rgba)
                    color_btn.set_property("use-alpha", True if ctype == "rgba" else False)
                    color_btn.show()
            else:
                color_btn.hide()

            # Connect signals for mutual updates
            entry.connect("changed", self.on_entry_changed, color_btn, key_tuple)
            color_btn.connect("color-set", self.on_color_set, entry, key_tuple)

            self.grid.attach(hbox, 1, row, 1, 1)
            row += 1

        self.grid.show_all()

    def on_save_clicked(self, button):
        new_values = {}
        for (sec, key), (entry, color_btn, mode) in self.widgets.items():
            # Always pull value from the text entry
            new_values[key] = entry.get_text().strip()

        for item in self.variables:
            name_key = item.get('name')
            if name_key in new_values:
                item['value'] = new_values[name_key]
        
        try:
            # 1. Save .conf
            with open(self.config_path, 'w') as f:            
                for item in self.variables:
                    f.write(f"{item.get('name')} = {item.get('value')}\n")
            
            # 2. Update _colors.scss
            update_scss_variables(self.theme_path / "cinnamon" / "cinnamon-sass", self.variables)

            self.compile_sass()
            self.refresh_cinnamon_theme()
            
        except subprocess.CalledProcessError as e:
            self.show_info_dialog("Sass Error", f"Failed to compile Sass:\n{e.stderr.decode()}", Gtk.MessageType.ERROR)
        except Exception as e:
            self.show_info_dialog("Error", str(e), Gtk.MessageType.ERROR)

    def compile_sass(self):
        if shutil.which("sassc") is None:
            self.show_info_dialog(_("sassc not found"), _("The 'sassc' command was not found. Please install (e.g., 'sudo apt install sassc') to compile the theme."))
            
        src_scss = self.theme_path / "cinnamon" / "cinnamon-sass" / "cinnamon.scss"
        out_css = self.theme_path / "cinnamon" / "cinnamon.css"
        
        subprocess.run(["sassc", str(src_scss), str(out_css)], check=True, stderr=subprocess.PIPE)

    def copy_cinnamon_theme(self):
        """Copies ./cinnamon contents to theme directory"""
        src_dir = str(self.script_dir) + "/cinnamon"
        dest_dir = self.theme_path / "cinnamon"
        shutil.copytree(src_dir, str(dest_dir), dirs_exist_ok=True)

    def refresh_cinnamon_theme(self):
        gsettings_set("org.cinnamon.theme", "name", "")
        gsettings_set("org.cinnamon.theme", "name", self.theme_name)

    def on_reset_clicked(self, action, parameter):
        dialog = Gtk.MessageDialog(
            transient_for=self.window, flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO, text=_("Reset to Defaults?")
        )
        dialog.format_secondary_text(_("This will delete current settings and reset to the default cinnamon theme."))
        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            if self.config_path.exists():
                self.config_path.unlink()
            self.copy_cinnamon_theme()
            self.load_config()
            self.populate_grid()

    def show_info_dialog(self, title, message, msg_type=Gtk.MessageType.INFO):
        dialog = Gtk.MessageDialog(
            transient_for=self.window, flags=0,
            message_type=msg_type, buttons=Gtk.ButtonsType.OK, text=title
        )
        dialog.format_secondary_text(message)
        dialog.run()
        dialog.destroy()

if __name__ == "__main__":
    app = StyleConfEditor()
    app.run(None)
