const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen

// Code for selecting network manager thanks to Jason Hicks - Not currently utilised
let tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      errCb(e);
    }
  }
}

let CONNECTED_STATE, NMClient_new, newNM;
// Removed use of try-catch function to force used of new NM - some of what remains can be rationised when Cinnamon 4.0 is available to allow full testing.

  const NM = imports.gi.NM;
  CONNECTED_STATE = NM.DeviceState.ACTIVATED;
  NMClient_new = NM.Client.new;
  newNM = true;

// l10n/translation
const Gettext = imports.gettext;
let UUID;

function _(str) {
    return Gettext.dgettext(UUID, str);
};

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);


            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useExtendedDisplay",
                "useExtendedDisplay",
                this.on_settings_changed,
                null);


            this.settings.bindProperty(Settings.BindingDirection.IN,
                "extendedDisplay",
                "extendedDisplay",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useVnstatiCommandString",
                "useVnstatiCommandString",
                this.on_settings_changed,
                null);


            this.settings.bindProperty(Settings.BindingDirection.IN,
                "vnstatiCommandString",
                "vnstatiCommandString",
                this.on_settings_changed,
                null);


        try {
            // l10n/translation
            UUID = metadata.uuid;
            Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

            this.set_applet_icon_path(metadata.path + "/icon.png");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.imageWidget = new St.Bin({x_align: St.Align.MIDDLE});
            this.textWidget = new St.Label();
            this.menu.addActor(this.imageWidget);
            this.menu.addActor(this.textWidget);

            this._device = "null";
            this.vnstatImage = GLib.get_home_dir() + "/vnstatlmapplet.png";
            let args = newNM ? [null] : [];
            this._client = NMClient_new.apply(this, args);
//          this._client = NMClient_new(null);  // Ready to replace lines above
//          global.logError("Test output - Loaded from Folder 4.0");   // Comment out unless testing
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        if (!this.menu.isOpen) {
            this._update();
        }
        this.menu.toggle();
    },

    // ++ Function called when settings are changed
    on_settings_changed: function () {
            this._update();
    },


    _update: function() {
        this._updateDevice();
        this._updateGraph(); // Comment this out to test without vnstat installed
    },

    getInterfaces: function () {
        return this._client.get_devices();
    },

    isInterfaceAvailable: function (name) {
        let interfaces = this.getInterfaces();
        if (interfaces != null) {
           for (let i = 0; i < interfaces.length; i++) {
                let iname = interfaces[i].get_iface();
                if (iname == name && interfaces[i].state == CONNECTED_STATE) {

                   return true;
                 }
             }
        }
        return false;
    },

    _updateDevice: function() {
         try {
             this._device = "null"
             let interfaces = this.getInterfaces();
             if (interfaces != null) {
                 for (let i = 0; i < interfaces.length; i++) {
                    let iname = interfaces[i].get_iface();
                    if (this.isInterfaceAvailable(iname)) {
                        this._device = iname;
//                        global.logError("Test output - vnstat@linuxmin.com detected device: " + this._device);   // Comment out unless testing
                    }
                }
            }
        }
        catch (e) {
            global.logError(e);
        }
    },

    _updateGraph: function() {
        try {
            if (this._device != "null") {
                   if (this.useExtendedDisplay) {
                         if(this.extendedDisplay == "classic" ) {

                                GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this._device + ' -o ' + this.vnstatImage );
                         }
                         if(this.extendedDisplay == "classicPlus" ) {

                               GLib.spawn_command_line_sync('vnstati -vs -ne -i ' + this._device + ' -o ' + this.vnstatImage );
                         }

                         if(this.extendedDisplay == "userDefined" ) {
                               if (this.useVnstatiCommandString) {
                                     GLib.spawn_command_line_sync('vnstati ' + this.vnstatiCommandString + ' -ne -i ' + this._device + ' -o ' + this.vnstatImage );
                               } else {
                                     GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this._device + ' -o ' +  this.vnstatImage );
                               }
                         }
                   } else {
                        GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this._device + ' -o ' +  this.vnstatImage );
                   }
              this.textWidget.set_text(" " + _("Current Active Interface:") + " " + this._device + "  " + _("Last update time is at top right") );
            }
            else {
                this.textWidget.set_text(" " + _("No interface devices currently active - Showing last update") + " ");
            }
            let l = new Clutter.BinLayout();
            let b = new Clutter.Box();
            let c = new Clutter.Texture({keep_aspect_ratio: true, filter_quality: 2, filename: this.vnstatImage });
            b.set_layout_manager(l);
            b.add_actor(c);
            this.imageWidget.set_child(b);
        }
        catch (e) {
            this.textWidget.set_text(" " + _("Please make sure vnstat and vnstati are installed and that the vnstat daemon is running!") + " " + e + " ");
            global.logError(e);
        }
    },

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}

/*
# Change log since author changed to pdcurtis
## 1.0.0
  * Changes to check which network manager libraries are in use and choose which to use - addresses/solves issue #1647 with Fedora versions 27 and higher.
  * Change "author" to "pdcurtis and set "original author" to clefebvre
## 1.0.1
  * Changes for Cinnamon 4.0 and higher to avoid segfaults when old Network Manager Library is no longer available by using multiversion with folder 4.0 - Issues #2094 and #2097
  * Remove Try-Catch as no longer required in 4.0 and associated changes.
  * It is believed that all Distributions packaging Cinnamon 4.0 have changed to the new Network Manager Libraries
  * Update README.md
## 1.0.2
  * Add panelHeight and instance_id to various functions
  * Add Configure (settings-schema.json) to applet
  * Provide options to choose different vnstati formats including a user specified format
  * Tidy code to remove trailing spaces
  * Change Icon to be unique and have better affordance
  * Add CHANGELOG.md
  * Update README.md
*/
