const JSon = imports.gi.Json;
const GLib = imports.gi.GLib;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;

function SmogWawelski(metadata, orientation){
    this._init(metadata, orientation);
}

//region TextImageMenuItem
function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.actor.add_style_pseudo_class('active');
        this.icon = new St.Icon({gicon: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16});
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setText: function(text) {
        this.text.text = text;
    },

    setIcon: function(icon) {
        this.icon.gicon = icon;
    }
};
//endregion TextImageMenuItem

SmogWawelski.prototype = {
    __proto__: Applet.IconApplet.prototype,

    STATION_ID : "MP-6",
    REFRESH_TIME : 29,

    getData: function() {
        var parser = new JSon.Parser();
        parser.load_from_file(this._dataFile);
        return parser.get_root().get_object();
    },

    _init: function(metadata, orientation){
        try {
            Applet.IconApplet.prototype._init.call(this, orientation);

            this.settings = new Settings.AppletSettings(this, 'smogwawelski@pamsoft.pl');
            this._Reg_Setting("STATION_ID", this.on_setting_change);
            this._Reg_Setting("REFRESH_TIME", this.on_setting_change);

            this._orientation = orientation;
            this._myDir = GLib.get_home_dir() + "/.local/share/cinnamon/applets/smogwawelski@pamsoft.pl/";
            this._serviceScript = this._myDir + "fetch.py";
            this._killScript = this._myDir + "kill.py";
            this._dataFile = this._myDir + "data/data.json";
            this._iconBad = Gio.icon_new_for_string(this._myDir + "icons/bad.png");
            this._iconOk = Gio.icon_new_for_string(this._myDir + "icons/ok.png");
            this._initialized = false;

            //'WS':'Pr\u0119dko\u015b\u0107 wiatru', 'WD':'Kierunek wiatru', 'PA': 'Ci\u015bnienie atmosferyczne', 'TP':'Temperatura'};
            this._labelMap = {
                'CO':'CO', 'NO':'NO', 'NO2':'NO\u2082', 'NOx':'NO\u2093', 'NOX':'NO\u2093', 'PM10':'PM\u2081\u2080',
                'PM2.5':'PM\u2082.\u2085', 'PM2,5':'PM\u2082.\u2085', 'PM25':'PM\u2082.\u2085', 'SO2':'SO\u2082',
                'O3': 'O\u2083', 'Ozon': 'O\u2083',
                'WS':'Pr\u0119dk. wiatru', 'WD':'Kier. wiatru', 'TP':'Temp.',
                'RH': 'Wilgotno\u015b\u0107',  'RF': 'Ilo\u015b\u0107 opadu',
                'RAD': 'Radiacja ca\u0142kowita', 'UVB': 'Radiacja ca\u0142kowita',
                'C6H6': 'C\u2086H\u2086', 'C6/sub>H6': 'Benzen', 'BZN': 'Benzen',
                'C7H8': 'Toluen', 'C8H10':'M-P-Ksylen',
                'PA': 'Ci\u015bnienie at.', 'PH': 'Ci\u015bnienie at.',
                '\u00c5\u009brednie o\u00c5\u009bmiogodz.': 'CO'};
            this._maxVals = { 'CO':10000, 'NO2':200, 'PM10':50, 'PM2.5':25, 'PM25':25, 'C6H6':5, 'SO2':350, 'O3':120};
            this._menuItems = {};

            this.set_applet_icon_symbolic_path(this._myDir + "icon.png");
            this.set_applet_tooltip(_("Smog Wawelski"));

            Util.spawnCommandLine("python " + this._serviceScript);
        } catch (e) {
            global.logError(e);
        }
    },

    createTableCell: function(label) {
        var cell= new St.Label( { style_class: 'popup-menu-item'});
        cell.text = label;
        return cell;
    },

    createTableCellIcon: function(icon) {
        return new St.Icon({ gicon: icon, icon_size: 16});
    },

    updateData: function(firstTimeUpdate) {
        try {
            self = this;
            var data = this.getData();
            var rowCounter = 0;

            if (firstTimeUpdate) {
                this.menuManager = new PopupMenu.PopupMenuManager(this);
                this.menu = new Applet.AppletPopupMenu(this, this._orientation);
                this.menuManager.addMenu(this.menu);

                this._contentSection = new PopupMenu.PopupMenuSection();
                this.menu.addMenuItem(this._contentSection);

                this.tabelka = new St.Table({homogeneous: false, style_class: 'popup-menu-item', reactive: true});
                this.menu.addActor(this.tabelka);
            }

            this.tabelka.destroy_children();

            var stationInfo = data.get_string_member('locationName');
            this.tabelka.add(self.createTableCell("Location:"), {row: rowCounter, col: 0});
            this.tabelka.add(self.createTableCell(String(stationInfo)), {row: rowCounter, col: 1, col_span: 3});
            rowCounter++;
            var measurements = data.get_object_member('measurements');
            var members = measurements.get_members();

            //for each member
            members.map(function(item) {

                var measurement = measurements.get_object_member(item);
                var label = self._labelMap[item];
                var val = measurement.get_string_member('value');
                var hour = measurement.get_int_member('hour');
                var maxVal = measurement.get_string_member('maxVal');
                var unit = measurement.get_string_member('unit');
                var icon = null;
                var prc = 0;
                if (maxVal != "") {
                    prc = (val / parseFloat(maxVal)) * 100
                } else if (self._maxVals[item]) {
                    prc = (val / parseFloat(self._maxVals[item])) * 100
                }

                if (prc > 100) {
                    icon = self._iconBad;
                } else if (prc > 0) {
                    icon = self._iconOk
                }

                self.tabelka.add(self.createTableCell(label), {row: rowCounter, col: 0});
                self.tabelka.add(self.createTableCell(String(val) + " " + unit), {row: rowCounter, col: 1});
                if (prc > 0) {
                    self.tabelka.add(self.createTableCell(String(prc.toFixed(2))+"%"), {row: rowCounter, col: 2});
                    self.tabelka.add(self.createTableCellIcon(icon), {row: rowCounter, col: 3 });
                }
                rowCounter++;
            });

            var updatedAt = data.get_string_member('updatedAt');
            var updateInfoItem = self.createTableCell(updatedAt);
            this.tabelka.add(self.createTableCell("Updated:"), {row: rowCounter, col: 0});
            this.tabelka.add(updateInfoItem, {row: rowCounter, col: 1, col_span: 3});
            this._initialized = true;
        } catch (e) {
            global.logError(e)
        }
    },

    on_applet_clicked: function (event) {
        try {
            if (!this._initialized) {
                this.updateData(1);
            } else {
                this.updateData(0); // 0 = not first time update
            }
            this.menu.toggle();
        } catch (e) {
            global.logError(e)
        }

    },

    on_applet_removed_from_panel: function() {
        Util.spawnCommandLine("python " + this._killScript);
    },

    on_setting_change: function () {
        try {
            var splitted = this.STATION_ID.split('-');
            var f = Gio.file_new_for_path(this._myDir + "data/config.properties");
            var stream = f.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            stream.write("[fetch]", null);
            stream.write("\n",null);
            stream.write("station.id=" + splitted[1], null);
            stream.write("\n",null);
            stream.write("refresh.time=" + this.REFRESH_TIME, null);
            stream.write("\n",null);
            stream.write("wios=" + splitted[0], null);
            stream.flush(null);
            stream.close(null);
        } catch (e) {
            global.logError(e);
        }
    },

    _Reg_Setting: function (key, callback, callback_data) {
        this.settings.bindProperty(Settings.BindingDirection.IN,// Setting type
            key,				// The setting key
            key,				// The property to manage (this.width)
            callback,			// Callback when value changes
            callback_data);			// Optional callback data
    }

};

function main(metadata, orientation){
    var smogWawelski = new SmogWawelski(metadata, orientation);
    return smogWawelski;
}
