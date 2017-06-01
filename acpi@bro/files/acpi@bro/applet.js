const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const UUID = "acpi@bro";
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
  this._init(orientation);
}
 
MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(orientation) {
    Applet.TextIconApplet.prototype._init.call(this, orientation);
    try {
      this.update_periodic();
    } catch (e) {
      global.logError(e);
    }
  },

  get_battery_state: function(){
    let state = Cinnamon.get_file_contents_utf8_sync("/sys/class/power_supply/BAT0/status");
    let full = Cinnamon.get_file_contents_utf8_sync("/sys/class/power_supply/BAT0/energy_full");
    let now = Cinnamon.get_file_contents_utf8_sync("/sys/class/power_supply/BAT0/energy_now");
    return {
      state: state.substr(0, state.length-1),
      full: parseInt(full),
      now: parseInt(now)
    };
  },

  update_periodic: function(){
    this.update();
    this._periodicTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this.update_periodic));
  },

  update: function(){
    let state = this.get_battery_state();
    let percentage = Math.round((state.now*100)/state.full);
    this.set_applet_icon_name(this.get_icon(state.state, percentage));
    this.set_applet_label(percentage + "%");
    this.set_applet_tooltip(this.get_tooltip());
  },

  get_tooltip: function(){
    let [res, out, err, status] = GLib.spawn_command_line_sync('acpi -b');
    out = out.toString();
    out = out.substr(0, out.length-1);
    return out;
  },

  get_icon: function(state, percentage){
    if (state==_("Unknown")){
      return ac-adapter;
    } else if (state==_("Charging")){
      if (percentage<20) return battery-caution-charging;
      else if (percentage<50) return battery-low-charging;
      else if (percentage<90) return battery-good-charging;
      else return battery-full-charging;
    } else if (state==_("Discharging")){
      if (percentage<20) return battery-caution;
      else if (percentage<50) return battery-low;
      else if (percentage<90) return battery-good;
      else return battery-full;
    }
  }

};

function main(metadata, orientation) {
  let myApplet = new MyApplet(orientation);
  return myApplet;
}
