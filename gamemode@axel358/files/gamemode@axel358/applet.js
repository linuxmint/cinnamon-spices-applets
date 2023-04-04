const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const MessageTray = imports.ui.messageTray;
const GM_INTERFACE = '<node> \
  <interface name="com.feralinteractive.GameMode"> \
    <property name="ClientCount" type="i" access="read"></property> \
  </interface> \
</node>';


class GameModeApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this._source = null;
        this._notification = null;
        this.count = 0;
        this.actor.hide();

        this.set_applet_icon_symbolic_name("applications-games-symbolic");
        this.set_applet_tooltip(_("No active clients"));

        //TODO: Make this async?
        const GameModeProxy = Gio.DBusProxy.makeProxyWrapper(GM_INTERFACE);
        this._proxy = null;

        try {
            this._proxy = GameModeProxy(Gio.DBus.session, "com.feralinteractive.GameMode", "/com/feralinteractive/GameMode");
            this._proxy.connect("g-properties-changed", Lang.bind(this, this._gamemode_props_changed));
            this._gamemode_props_changed();
        } catch (e) {
            this._notify("Cinnamon GameMode", e);
        }
    }

    _gamemode_props_changed(proxy, changed) {
        //GameMode has only one prop: ClientCount
        let c_count = this._proxy.ClientCount;

        if (c_count > 0 && this.count == 0) {
            this.actor.show();
            this._notify("GameMode is on", "Computer performance has been optimized for playing games");

        } else if (c_count < 1 && this.count > 0) {
            this._notify("GameMode is off", "Computer performance has been reset to normal");
            this.actor.hide();
        }
        this.count = c_count;
        this.set_applet_tooltip(this.count + " active clients");
    }

    _ensure_source() {
        if (!this._source) {
            this._source = new MessageTray.Source("Cinnamon Gamemode");
            this._source.connect('destroy', Lang.bind(this, function () {
                this._source = null;
            }));
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    }

    _notify(title, text) {
        if (this._notification)
            this._notification.destroy();

        this._ensure_source();

        let icon = new St.Icon({
            icon_name: "applications-games-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this._source.ICON_SIZE
        });
        this._notification = new MessageTray.Notification(this._source, title, text,
            { icon: icon });
        this._notification.setTransient(true);
        this._notification.connect('destroy', function () {
            this._notification = null;
        });
        this._source.notify(this._notification);

    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new GameModeApplet(metadata, orientation, panel_height, instance_id);
}
