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

            //this.set_applet_icon_name(this.icon_name);

            this.set_applet_tooltip(_("click here to pick a color"));
            this.on_keybinding_changed();
            this.on_settings_changed();
        }
        catch (e) {
            global.logError(e);
        }


     },

     on_settings_changed: function() {


        if (this.icon_name=="") {
            this.set_applet_icon_path(this.appletPath + "/icon.png")
        } else {
            this.set_applet_icon_path(this.icon_name)
        }
     },

     on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
     },

     on_hotkey_triggered: function() {
        this.on_applet_clicked();

        let timeoutId = Mainloop.timeout_add(3000, Lang.bind(this, function() {
            this.on_settings_changed();
        }));
    },

    on_applet_clicked: function(event) {
        homeDir=GLib.get_home_dir();
        GLib.spawn_command_line_async("python2 " + this.appletPath + "/cp.py "+this.combo_choice);
    }

};

function main(metadata,orientation, panelHeight,  instance_id) {
    let myApplet = new MyApplet(orientation,metadata, panelHeight, instance_id);
    return myApplet;
}
