const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

const UUID = "ctrl4docker@hoffis-eck.de";
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
    _docker: null,
    _DockerApi: null,

    HOST_IDENTITY: 'TESTSERVER',

    STATUS_UNKNOWN: 0,
    STATUS_NOTEXISTENT: 1,
    STATUS_NAMEINUSE: 2,
    STATUS_RUNNING: 3,
    STATUS_PAUSED: 4,
    STATUS_ERROR: 5,
    STATUS_NOTRUNNING: 6,

    _status: null,
    _id: 0,
    _error: "",

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._path = metadata.path;

        this._docker = this._get_docker();
        this._bind_settings(instance_id);
        this._get_status();
    },

    _get_docker: function () {
        if (imports.searchPath.indexOf(this._path) == -1) {
            imports.searchPath.push(this._path);
        }
        this._DockerApi = imports.DockerApi;
        return new this._DockerApi.DockerApi();
    },

    _bind_settings: function(instance_id) {
        let settings = new Settings.AppletSettings(
            this,
            "ctrl4docker@hoffis-eck.de",
            instance_id
        );
        settings.bindProperty(Settings.BindingDirection.IN,
            "container",
            "container",
            this._get_status,
            null
        );
        settings.bindProperty(Settings.BindingDirection.IN,
            "image",
            "image",
            this._get_status,
            null
        );
        settings.bindProperty(Settings.BindingDirection.IN,
            "parameter",
            "parameter",
            this._parse_parameter,
            null
        );
    },

    _parse_parameter: function() {
        try {
            let parameter = JSON.parse(this.parameter);
            return parameter;
        } catch (e) {
            global.log(e);
            this._error = 'Can not parse parameter »' + this.parameter + '«';
            this._set_status(this.STATUS_ERROR);
            return null;
        }
    },

    _get_status: function() {
        this.set_applet_tooltip(_('Checking status'));
        if ((this.container == '') || (this.image == '')) {
            return this._set_status(this.STATUS_UNKNOWN);
        }
        let containers = this._docker.listContainers({'all': 1});
        let filteredContainers = containers.filter(this._DockerApi.isName(this.container))
        if (filteredContainers.length == 0) {
            return this._set_status(this.STATUS_NOTEXISTENT);
        }
        let container = filteredContainers.pop();
        if (container.Image != this.image) {
            return this._set_status(this.STATUS_NAMEINUSE);
        }
        this._id = container.Id;
        container = this._docker.inspectContainer(this._id);
        if (container.State.Running) {
            return this._set_status(this.STATUS_RUNNING);
        }
        if (container.State.Paused) {
            return this._set_status(this.STATUS_PAUSED);
        }
        if (container.State.Error != "") {
            this._error = container.State.Error;
            return this._set_status(this.STATUS_ERROR);
        }
        return this._set_status(this.STATUS_NOTRUNNING);
    },

    _set_status: function(status) {
        this._status = status;
        switch (status) {
            case this.STATUS_UNKNOWN:
                this._set_applet('Unknown', 'No container-name/-image');
                break;
            case this.STATUS_NOTEXISTENT:
                this._set_applet('NotExistent', 'Container does not exist');
                break;
            case this.STATUS_NAMEINUSE:
                this._set_applet('NameInUse', 'Containername is in use');
                break;
            case this.STATUS_RUNNING:
                this._set_applet('Running', 'Container is running');
                break;
            case this.STATUS_PAUSED:
                this._set_applet('Paused', 'Container is paused');
                break;
            case this.STATUS_ERROR:
                this._set_applet('Error', 'Container has an error');
                break;
            case this.STATUS_NOTRUNNING:
                this._set_applet('Stopped', 'Container is not running');
                break;
            default:
                this._error = status;
                this._set_applet('Error', 'Wrongfull _set_status call');
        }
        return status;
    },

    _set_applet: function(icon_name, text) {
        this.set_applet_icon_path(this._path + '/icons/128/' + icon_name + '.png');
        let log = _(text);
        if (icon_name == 'Error') {
            log += this._error;
        }
        this.set_applet_tooltip(log);
        global.log(log);
    },

    on_applet_clicked: function() {
        try {
            this._click();
        } catch (e) {
            global.log(e);
            this._error = e;
            this._set_status('Error', 'Error in action')
        }
    },

    _click: function() {
        let old_status = this._status;
        this._get_status();
        if (this._status != old_status) {
            return this._status;
        }

        switch (this._status) {
            case this.STATUS_UNKNOWN:
            case this.STATUS_NAMEINUSE:
            case this.STATUS_ERROR:
                return null;
            case this.STATUS_NOTEXISTENT:
                let parameter = this._parse_parameter();
                parameter['name'] = this.container;
                parameter['Image'] = this.image;
                this._id = this._docker.createContainer(parameter);
            case this.STATUS_PAUSED:
            case this.STATUS_NOTRUNNING:
                this._docker.startContainer(this._id);
                break;
            case this.STATUS_RUNNING:
                this._docker.stopContainer(this._id);
                break;
            default:
        }
        return this._get_status();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
