const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Main = imports.ui.main; 
const St = imports.gi.St;

function AnyAlarmApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

AnyAlarmApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.set_applet_icon_symbolic_name("alarm");
        this.set_applet_tooltip(_("AnyAlarm"));

        this.refreshCounter = 0;
        this.state = {};
        this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'enabled', 'enabled', () => this.refresh(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'mode', 'mode', () => this.refresh(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'xs-mode-seconds', 'xsModeSeconds', () => this.refresh(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'alarm-text', 'alarmText', () => this.refresh(), null);
        this.refresh();
    },

    refresh: function() {
        this.refreshCounter += 1;
        if (!this.state.enabled) return;
        this.scheduleAlarm(this.state.mode, this.state.alarmText, this.refreshCounter);
    },

    scheduleAlarm: function(mode, text, refreshCounter) {
        let interval = this.getSecondsToNext(mode);
        if (interval == null) return;
        Mainloop.timeout_add_seconds(interval, () => this.alarm(mode, text, refreshCounter));
    },

    alarm: function(mode, text, refreshCounter) {
        // don't execute and continue alarms that were updated or removed
        if (this.refreshCounter != refreshCounter) return false;        
        this.showMessage(text);
        this.scheduleAlarm(mode, text, refreshCounter);
        return false;
    },

    showMessage: function(text) {
        let icon = new St.Icon({
            icon_name: 'error',
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 36
        });

        Main.criticalNotify(_('AnyAlarm'), text, icon);
    },

    getSecondsToNext: function(mode) {
        let now = new Date();
        let min = now.getMinutes();
        let sec = now.getSeconds();

        switch (mode) {
          case "xs": // test mode 5 seconds
            return this.state.xsModeSeconds;
            break;
          case "fm": // next full minute
            return 60 - sec;
            break;
          case "qh": // next quarter hour
            if (min > 45) return 60 - min;
            if (min > 30) return 45 - min;
            if (min > 15) return 30 - min;
            return 15 - min;
          case "hh": // next half hour
            if (min > 30) return 60 - min;
            return 30 - min;
          case "fh": // next full hour
            return 60 - min;
            break;
          default:
            break;
        }

        return null;
    },

    on_applet_removed_from_panel: function() {
        this.refreshCounter += 1;
    },
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AnyAlarmApplet(metadata, orientation, panel_height, instance_id);
}

