// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;

const LG_SERVICE_NAME = 'info.Lusito.TouchpadIndicatorClassic';
const LG_SERVICE_PATH = '/info/Lusito/TouchpadIndicatorClassic';
const TouchpadIndicatorIface = <interface name={LG_SERVICE_NAME}>
<method name="Toggle"></method>
</interface>;

function AppletDBus(applet) {
    this._init(applet);
}

AppletDBus.prototype = {
    _init: function(applet) {
        this._applet = applet;
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(TouchpadIndicatorIface, this);
        this._dbusImpl.export(Gio.DBus.session, LG_SERVICE_PATH);

        this._nameId = Gio.DBus.session.own_name(LG_SERVICE_NAME, Gio.BusNameOwnerFlags.REPLACE, null, null);
    },
    
    destroy: function() {
        this._dbusImpl.unexport();
        Gio.DBus.session.unown_name(this._nameId);
    },

    Toggle: function() {
        this._applet.toggleSetting("touchpad-enabled");
    },
};
