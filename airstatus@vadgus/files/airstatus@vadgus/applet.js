const UUID = 'airstatus@vadgus';
const TITLE = 'AirPods Status';

const APPLET_PATH = imports.ui.appletManager.appletMeta[UUID].path;
imports.searchPath.push(APPLET_PATH);

const Lang = imports.lang;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const MessageTray = imports.ui.messageTray;
const Gettext = imports.gettext;


function _(str) {
    return Gettext.dgettext(UUID, str);
}

function AirApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

AirApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name('audio-headphones');
        this.set_applet_tooltip(_(TITLE + ': Updating'));

        this.isLooping = true;
        this.waitForCmd = false;
        this.notifications = null;

        this.notificationSource = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(this.notificationSource);

        this._init_settings();
        this.check();
        this.loopId = Mainloop.timeout_add(this.interval * 1000, () => this.check());
    },

    _init_settings: function (instance_id) {
        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval', this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'notifications', 'notifications', this._update_settings);
    },

    _update_settings: function () {
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        this.loopId = Mainloop.timeout_add(this.interval * 1000, () => this.check());
    },

    on_applet_removed_from_panel: function () {
        Mainloop.source_remove(this.loopId);
        this.loopId = 0;
        this.isLooping = false;
    },

    on_applet_clicked: function (event) {
        this.check();
    },

    check: function () {
        if (!this.isLooping) {
            return false;
        }

        if (!this.waitForCmd) {
            this.waitForCmd = true;
            Util.spawn_async(['python3', APPLET_PATH + '/main.py'], Lang.bind(this, this._update));
        }

        return true;
    },

    _update: function(input) {
        let title = TITLE;
        let status = 'Disconnected';

        if (input) {
            let data = JSON.parse(input);

            if (data.hasOwnProperty('status') && data['status'] && data.hasOwnProperty('charge')) {
                let warning = '';
                title = data['model'];

                status = 'L ' + data['charge']['left'] + '%';
                if (data['charging_left']) {
                    status += ' (charging)';
                }

                status += ', R ' + data['charge']['right'] + '%';
                if (data['charging_right']) {
                    status += ' (charging)';
                }

                status += ', Case ' + data['charge']['case'] + '%';
                if (data['charging_case']) {
                    status += ' (charging)';
                }

                if (!data['charging_left'] && data['charge']['left'] > -1 && data['charge']['left'] < 10) {
                    warning += '\nL ' + data['charge']['left'] + '%';
                }

                if (!data['charging_right'] && data['charge']['right'] > -1 && data['charge']['right'] < 10) {
                    warning += '\nR ' + data['charge']['right'] + '%';
                }

                if (warning) {
                    this._notify('Warning! Low battery!\n' + warning);
                }
            }
        }

        this.set_applet_tooltip(_(title + ': ' + status));
        this.waitForCmd = false;

        return true;
    },

    _notify: function (text) {
        if (!this.notifications) {
            return false;
        }

        let gicon = Gio.icon_new_for_string(APPLET_PATH + "/icon.png");
        let icon = new St.Icon({ gicon: gicon });

        let notification = new MessageTray.Notification(this.notificationSource, TITLE, text, {icon});
        this.notificationSource.notify(notification);
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new AirApplet(orientation, panel_height, instance_id);
}
