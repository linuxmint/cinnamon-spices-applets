//Cinnamon Applet: Color-Picker v0.2-Beta
//Release Date: 12 March 2014
//Update: 25 December 2015
//Author: Fatih Mete
//
//          Email: fatihmete@live.com
//
// This program is free software:
//
//    You can redistribute it and/or modify it under the terms of the
//    GNU General Public License as published by the Free Software
//    Foundation, either version 3 of the License, or (at your option)
//    any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "color-picker@fmete";
const Settings = imports.ui.settings;  // Needed for settings API
const Main = imports.ui.main;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation,metadata, panelHeight, instance_id) {
    this._init(orientation,metadata, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation,metadata, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight,  instance_id);

        this.instance_id=instance_id;
        this.appletPath=metadata.path;
        try {

            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id)

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "combo-selection",
                                 "combo_choice",
                                 this.on_settings_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "keybinding-test",
                                 "keybinding",
                                 this.on_keybinding_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "icon-name",
                                 "icon_name",
                                 this.on_settings_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "pick-notification",
                                 "pick_notification",
                                 null,
                                 null);

            this.svgPath = this.appletPath + "/color-circle.svg";
            this.set_applet_tooltip(_("Click here to pick a color"));
            this.on_keybinding_changed();
            this.on_settings_changed();
        }
        catch (e) {
            global.logError(e);
        }


     },

     on_settings_changed: function() {
        if (GLib.path_is_absolute(this.icon_name) && GLib.file_test(this.icon_name, GLib.FileTest.EXISTS))
            this.set_applet_icon_path(this.icon_name);
        else if (Gtk.IconTheme.get_default().has_icon(this.icon_name))
            this.set_applet_icon_name(this.icon_name);
        else
            this.set_applet_icon_symbolic_name("color-select");
     },

     on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
     },

     on_hotkey_triggered: function() {
        this.on_applet_clicked();
    },

    createColorCircleSVG: function(color) {
        if (this.combo_choice == "3")
            color = 'rgb(' + color + ')';
        else if (this.combo_choice == "4")
            color = 'rgb' + color;

        let svgFile = Gio.File.new_for_path(this.svgPath)
        if (svgFile.query_exists(null))
            svgFile.delete(null);
        let readwrite = svgFile.create_readwrite(Gio.FileCreateFlags.NONE, null);
        let writeFile = readwrite.get_output_stream();

        let svgLine_1 = '<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg">';
        let svgLine_2 = '  <circle cx="50%" cy="50%" r="50%" fill="' + color + '" />';
        let svgLine_3 = '</svg>';
        let svgContent = svgLine_1 + '\n' + svgLine_2 + '\n' + svgLine_3;

        writeFile.write(svgContent, null);
        writeFile.close(null);
    },

    notify_send: function(notification, iconPath) {
        if (iconPath == null)
            iconPath = this.appletPath + '/icon.png';
        Util.spawnCommandLine('notify-send --hint=int:transient:1 "' + notification + '" -i ' + iconPath);
    },

    notify_installation: function(packageName) {
        this.notify_send(_("Please install the '%s' package.").format(packageName), null);
    },

    on_applet_clicked: function(event) {
        if(Gio.file_new_for_path("/usr/bin/xclip").query_exists(null)) {
            global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
            global.set_cursor(Cinnamon.Cursor.CROSSHAIR);
            Util.spawn_async(["python3", this.appletPath + "/cp.py", this.combo_choice], Lang.bind(this, function(output) {
                global.unset_cursor();
                global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);

                output = output.replace(/\n$/, "");
                if (output == "ImportError Xlib") {
                    Util.spawnCommandLine("apturl apt://python3-xlib");
                    this.notify_installation('python3-xlib');
                } else if (output == "ImportError numpy") {
                    this.notify_installation('python3-numpy');
                    Util.spawnCommandLine("apturl apt://python3-numpy");
                } else {
                    if (this.pick_notification) {
                        this.createColorCircleSVG(output);
                        this.on_settings_changed();
                        this.notify_send(_("Color code '%s' copied to clipboard.").format(output), this.svgPath);
                    }
                }
            }));
        } else {
            this.notify_installation('xclip');
            Util.spawnCommandLine("apturl apt://xclip");
        }
    }

};

function main(metadata,orientation, panelHeight,  instance_id) {
    let myApplet = new MyApplet(orientation,metadata, panelHeight, instance_id);
    return myApplet;
}
