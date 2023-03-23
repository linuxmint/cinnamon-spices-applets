const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const UUID = "nordvpn-indicator@nickdurante";

// pull: https://github.com/linuxmint/cinnamon-spices-applets

function NordVPNApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

NordVPNApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function (orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.set_applet_icon_name("network-vpn");
    this.set_applet_tooltip(_("Manage your NordVPN connection"));
    this.set_applet_label("NordVPN");
    this.connected = false;
    this.update_interval = 5000;

    try {

      this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
      this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval", "update_interval", this._new_freq, null);

      // Create the popup menu
      this.menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      this.menuManager.addMenu(this.menu);

      this._contentSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._contentSection);

      // First item: Turn on
      let item = new PopupMenu.PopupIconMenuItem("Connect", "connect_established", St.IconType.FULLCOLOR);

      item.connect('activate', Lang.bind(this, function () {
        Util.spawnCommandLine("nordvpn connect");
      }));
      this.menu.addMenuItem(item);


      item = new PopupMenu.PopupIconMenuItem("Connect P2P", "connect_established", St.IconType.FULLCOLOR);

      item.connect('activate', Lang.bind(this, function () {
        Util.spawnCommandLine("nordvpn connect --group p2p");
      }));
      this.menu.addMenuItem(item);

      // Second item: Turn off
      item = new PopupMenu.PopupIconMenuItem("Disconnect", "connect_no", St.IconType.FULLCOLOR);

      item.connect('activate', Lang.bind(this, function () {
        Util.spawnCommandLine("nordvpn disconnect");
      }));
      this.menu.addMenuItem(item);

      this._get_status();
      this._update_loop();
    }
    catch (e) {
      global.logError(e);
    }

  },

  on_applet_clicked: function () {

    this.menu.toggle();
  },

  on_applet_removed_from_panel: function () {
    if (this._updateLoopID) {
      Mainloop.source_remove(this._updateLoopID);
    }

  },

  _run_cmd: function (command) {
    try {
      let proc = Gio.Subprocess.new(
        ['nordvpn', 'status'],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
      );

      return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [, stdout, stderr] = proc.communicate_utf8_finish(res);
            let status = proc.get_exit_status();

            if (status !== 0) {
              throw new Gio.IOErrorEnum({
                code: Gio.io_error_from_errno(status),
                message: stderr ? stderr.trim() : GLib.strerror(status)
              });
            }
            resolve(stdout.trim());
          } catch (e) {
            reject(e);
          }
        });
      });
    }
    catch (e) {
      global.logError(e);
    }
  },

  _new_freq: function () {
    global.log(this.update_interval);
    if (this._updateLoopID) {
      Mainloop.source_remove(this._updateLoopID);
    }
    this._update_loop();
  },

  _get_status: function () {
    let promise_return = this._run_cmd();

    promise_return.then((value) => {
      let outString;
      let result;
      let regex = /Status: ([a-zA-Z]+)/i;
      try {
        result = regex.exec(value)[1];
      }
      catch (e) {
        global.logError(e);
      }
      if (result === "Connected") {
        this.connected = true;
        outString = "ON";
      } else if (result === "Disconnected") {
        this.connected = false;
        outString = "OFF";
      } else {
        this.connected = false,
          outString = "..."
      }
      this.set_applet_label(outString);
    })
    promise_return.catch((e) => { global.logError(e); this.set_applet_label("..."); })

  },

  _update_loop: function () {
    this._get_status();
    this._updateLoopID = Mainloop.timeout_add(this.update_interval, Lang.bind(this, this._update_loop));
  },

};


function main(metadata, orientation, panel_height, instance_id) {
  return new NordVPNApplet(orientation, panel_height, instance_id);
}
