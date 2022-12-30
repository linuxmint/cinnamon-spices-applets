// This code come from the applet screen-inhibit@mtwebster.
// Author: Michael Webster.
const Lang = imports.lang;
const {DBusProxy, DBus} = imports.gi.Gio; // Gio
const {get_object_for_uuid} = imports.ui.appletManager; // AppletManager

const ENABLED_APPLETS_KEY = "enabled-applets";

const SessionManagerIface = '\
<node> \
    <interface name="org.gnome.SessionManager"> \
        <method name="Logout"> \
            <arg type="u" direction="in" /> \
        </method> \
        <method name="Shutdown" /> \
        <method name="CanShutdown"> \
            <arg type="b" direction="out" /> \
        </method> \
        <method name="Inhibit"> \
            <arg type="s" direction="in" /> \
            <arg type="u" direction="in" /> \
            <arg type="s" direction="in" /> \
            <arg type="u" direction="in" /> \
            <arg type="u" direction="out" /> \
        </method> \
        <method name="Uninhibit"> \
            <arg type="u" direction="in" /> \
        </method> \
    </interface> \
</node>';

var SessionManagerProxy = DBusProxy.makeProxyWrapper(SessionManagerIface);
function SessionManager(initCallback, cancellable) {
  return new SessionManagerProxy(DBus.session, 'org.gnome.SessionManager', '/org/gnome/SessionManager', initCallback, cancellable);
}

class ScreensaverInhibitor {
  constructor(applet) {
    this.applet = applet;

    this._inhibit = undefined;
    this.inhibited = false;

    SessionManager(Lang.bind(this, function(obj, err) {
      this._sessionProxy = obj;
    }));

    this._onInhibit = function(cookie) {
      this._inhibit = cookie;
    };
  }

  _screen_inhibit_applet_id() {
    // Whether screen-inhibit@mtwebster is loaded:
    let enabledApplets = global.settings.get_strv(ENABLED_APPLETS_KEY);

    for (let appData of enabledApplets) {
      let infos = (""+appData).split(":");
      if (infos[3] === "screen-inhibit@mtwebster") {
        return parseInt(infos[4]);
      }
    }

    return -1;
  }

  inhibit_screensaver() {
    //~ global.log("inhibit_screensaver");
    if (this._inhibit != undefined) return;

    this._sessionProxy.InhibitRemote(
      "inhibitor-screen-inhibit@mtwebster",
      0,
      "inhibit mode",
      9,
      Lang.bind(this, this._onInhibit)
    );

    this.inhibited = true;

    let inhibit_applet = get_object_for_uuid("screen-inhibit@mtwebster", ""+this._screen_inhibit_applet_id());

    if (inhibit_applet != null) {
      //~ global.log("call inhibit_applet.update_icon()");
      inhibit_applet.inhibited = true;
      inhibit_applet.update_icon();
    }
    //~ global.log("  Screensaver inhibited.");
  }

  uninhibit_screensaver() {
    //~ global.log("uninhibit_screensaver");
    if (this._inhibit == undefined) return;

    this._sessionProxy.UninhibitRemote(this._inhibit);
    this._inhibit = undefined;
    this.inhibited = false;

    let inhibit_applet = get_object_for_uuid("screen-inhibit@mtwebster", ""+this._screen_inhibit_applet_id());
    if (inhibit_applet != null) {
      //~ global.log("call inhibit_applet.update_icon()");

      // Prioritize the screen-inhibit@mtwebster applet:
      if (inhibit_applet._inhibit == undefined) {
        inhibit_applet.inhibited = false;
        inhibit_applet.update_icon();
      }
    }
    //~ global.log("  Screensaver uninhibited.");
  }
}
