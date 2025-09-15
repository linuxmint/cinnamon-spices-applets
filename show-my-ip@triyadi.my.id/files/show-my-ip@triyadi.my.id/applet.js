const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

function MyApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.TextApplet.prototype,

  _init: function(orientation, panel_height, instance_id) {
    Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.set_applet_label("IP: ...");
    this.set_applet_tooltip("Click to refresh");
    this.timeout = Mainloop.timeout_add_seconds(5, Lang.bind(this, this.update_ip));
    this.update_ip();
  },

  update_ip: function() {
    try {
      let [res, out] = GLib.spawn_command_line_sync("ip -o -4 addr show | awk '{print $2 \" : \" $4}' | cut -d/ -f1");
      if (res) {
        let output = String.fromCharCode.apply(null, out).trim();
        let lines = output.split("\n");
        let label = "";
        for (let i = 0; i < lines.length; i++) {
          let parts = lines[i].split(" : ");
          let iface = parts[0];
          let ip = parts[1];
          if (iface === "lo") iface = "lo";
          else if (iface.startsWith("eth")) iface = "eth0";
          else if (iface.startsWith("wlan") || iface.startsWith("wlp")) iface = "wifi";
          label += iface + " : " + ip + "\n";
        }
        this.set_applet_label(label.trim());
      }
    } catch (e) {
      global.logError("ShowMyIP: " + e);
    }
    return true; // agar timeout terus berjalan
  },

  on_applet_clicked: function() {
    this.update_ip();
  },

  on_applet_removed_from_panel: function() {
    if (this.timeout) {
      Mainloop.source_remove(this.timeout);
      this.timeout = null;
    }
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(orientation, panel_height, instance_id);
}
