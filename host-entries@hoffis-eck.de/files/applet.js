const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

const UUID = "host-entries@hoffis-eck.de";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
  return Gettext.dgettext(UUID, str)
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _path: '',
    _hf: null,

    STATUS_UNKNOWN: 0,
    STATUS_CONNECTED: 1,
    STATUS_DISCONNECTED: 2,
    STATUS_NOTEXISTENT: 3,

    _status: null,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._path = metadata.path;

        this._set_status(this.STATUS_UNKNOWN);
        this._hf = this._get_hf();
        this._bind_settings(instance_id);

        this._get_status();
    },

    _get_hf: function () {
        if (imports.searchPath.indexOf(this._path) == -1) {
            imports.searchPath.push(this._path);
        }
        let HostsFile = imports.HostsFile;
        return new HostsFile.HostsFile();
    },

    _bind_settings: function(instance_id) {
        let settings = new Settings.AppletSettings(
            this,
            "host-entries@hoffis-eck.de",
            instance_id
        );
        settings.bindProperty(Settings.BindingDirection.IN,
            "ip",
            "ip",
            this._update_ip,
            null
        );
        settings.bindProperty(Settings.BindingDirection.IN,
            "hosts",
            "hosts",
            this._update_hosts,
            null
        );
    },

    _get_status: function() {
        this.set_applet_tooltip(_('Checking status'));
        if (!this._hf.exists(this.ip)) {
            this._set_status(this.STATUS_NOTEXISTENT);
            return;
        }
        switch (this._hf.isCommented(this.ip)) {
            case true:
                this._set_status(this.STATUS_DISCONNECTED);
                break;
            case false:
                this._set_status(this.STATUS_CONNECTED);
                break;
            default:
                global.log(_("Error, could not extract status!"));
        }
    },

    _set_status: function(status) {
        this._status = status;
        switch (status) {
            case this.STATUS_CONNECTED:
                this._set_applet('Connected', 'Entry is active');
                break;
            case this.STATUS_DISCONNECTED:
                this._set_applet('Disconnected', 'Entry is inactive');
                break;
            case this.STATUS_NOTEXISTENT:
                this._set_applet('NotExistent', 'Entry does not exist');
                break;
            case this.STATUS_UNKNOWN:
                this._set_applet('Unknown', 'Entry status is unknown');
                break;
            default:
                global.log(_("Error, trying to set unknown status!"));
        }
    },

    _set_applet: function(icon_name, text) {
        this.set_applet_icon_path(this._path + '/icons/128/' + icon_name + '.png');
        this.set_applet_tooltip(_(text));
    },

    _update_ip: function() {
        this._set_status(this.STATUS_UNKNOWN);
        this._get_status();
    },

    _update_hosts: function() {
        /* Nothing to do yet */
    },

    on_applet_clicked: function () {
        switch (this._status) {
            case this.STATUS_CONNECTED:
                this._hf.commentEntry(this.ip);
                break;
            case this.STATUS_DISCONNECTED:
                this._hf.uncommentEntry(this.ip);
                break;
            case this.STATUS_NOTEXISTENT:
                let retStat = this._hf.addIp(
                    this.ip,
                    [this.hosts]
                );
                break;
            case this.STATUS_UNKNOWN:
                // just re-try _get_status()
                break;
            default:
                global.log(_("Error, unknown status!"));
        }
        this._hf.save();
        this._get_status();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
