const Version = "0.1";
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;
const UUID = "back-up_state@natsakis.com";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// Applet
// ----------
function BackupStateApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

BackupStateApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
      Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

      this._opt_warningDays = null;
      this._opt_errorDays = null;
      this._opt_logFile = null;
      this._opt_refreshInt = null;

    	this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instance_id);
      this._bindSettings();

      this._status = this._findDate();
      this.set_applet_tooltip(this._findDate());

      this.refreshState();
    },

    refreshState: function refreshLocation() {
      if (this._findDate() == 'Has never run successfully!') {
        this.set_applet_icon_name("dialog-error-symbolic");
        this.set_applet_tooltip(_("Has never run succesfully!"));
      }
      else {
        let shortDate = new Date(this._findDate());
        let longDate = new Date(this._findDate());
        shortDate.setDate(shortDate.getDate() + this._opt_warningDays);
        longDate.setDate(longDate.getDate() + this._opt_errorDays);
        if (longDate < new Date()) {
          this.set_applet_icon_name("dialog-error-symbolic");
        }
        else if (shortDate < new Date()) {
          this.set_applet_icon_name("dialog-warning-symbolic");
        }
        else {
          this.set_applet_icon_name("object-select-symbolic");
        }
        this.set_applet_tooltip(_("Last successful back-up completed on") + " " + this._findDate());
      }

      Mainloop.timeout_add_seconds(this._opt_refreshInt * 60, () => this.refreshState());
    },

    _searchStringInArray: function (str, strArray) {
      let k = null;
      for (let j=0; j < strArray.length; j++) {
        if (strArray[j].match(str)) k = j;
      }
      return k;
    },

    _findDate: function () {
      this._opt_logFile = this._opt_logFile
        .replace(/file\:\/\//, '')
        .replace(/~/g, GLib.getenv('HOME'));
      let file = Gio.File.new_for_path(this._opt_logFile);

      if (!file.query_exists(null)) {
        Util.trySpawnCommandLine(`touch ${this._opt_logFile}`)
      }
      let [success, logs] = file.load_contents(null);
      if (logs instanceof Uint8Array) { // mozjs60 future-proofing
        logs = ByteArray.toString(logs);
      } else {
        logs = logs.toString();
      }
      let lines = logs.split('\n');
      let index = this._searchStringInArray(this._opt_idString,lines);

      if (index == null) {
        return _("Has never run successfully!");
      }
      else {
        return String(lines[index]).substring(0,19);
      }
    },

    _bindSettings: function() {
      this._settingsProvider.bindProperty(
        Settings.BindingDirection.IN,
        "warning_days",
        "_opt_warningDays",
        null,
      );

      this._settingsProvider.bindProperty(
        Settings.BindingDirection.IN,
        "error_days",
        "_opt_errorDays",
        null,
      );

      this._settingsProvider.bindProperty(
        Settings.BindingDirection.IN,
        "log_file",
        "_opt_logFile",
        null,
      );

      this._settingsProvider.bindProperty(
        Settings.BindingDirection.IN,
        "id_string",
        "_opt_idString",
        null,
      );

      this._settingsProvider.bindProperty(
        Settings.BindingDirection.IN,
        "refresh_int",
        "_opt_refreshInt",
        null,
      );
    }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new BackupStateApplet(metadata, orientation, panel_height, instance_id);
}