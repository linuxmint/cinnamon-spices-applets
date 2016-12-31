const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;

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

  check_usb_dev: function(){
    let dev_a = Gio.file_new_for_path("/dev/usb/lp0");
    let dev_b = Gio.file_new_for_path("/dev/usblp0");
    return (dev_a.query_exists(null) || dev_b.query_exists(null));
  },

  get_ink_state: function(){
    let cmd = "ink -p usb";
    let [res, out, err, state] = GLib.spawn_command_line_sync(cmd);
    return this.parse(out);
  },

  clear_output: function(out){
    out = out.substr(0, out.length-1);
    let lines = out.toString().split("\n");
    lines.splice(0, 2);
    return lines;
  },

  parse: function(content){
    content = this.clear_output(content.toString());
    return {
      name: content[0],
      black: this.extract_number(content[2]),
      cyan: this.extract_number(content[3]),
      magenta: this.extract_number(content[4]),
      yellow: this.extract_number(content[5])
    };
  },

  extract_number: function(line){
    var match = line.match(/\d+/);
    return match[0];
  },

  update_periodic: function(){
    this.update();
    this._periodicTimeoutId = Mainloop.timeout_add_seconds(10, Lang.bind(this, this.update_periodic));
  },

  update: function(){
    if (this.check_usb_dev()){
      let state = this.get_ink_state();
      let label = state.name;
      let tooltip = "Black: " + state.black + "%\n"
        + "Cyan: " + state.cyan + "%\n"
        + "Magenta: " + state.magenta + "%\n"
        + "Yellow: " + state.yellow + "%";
      this.set_applet_label(label);
      this.set_applet_tooltip(tooltip);
    } else {
      this.set_applet_label("");
      this.set_applet_tooltip("");
    }
  }

};

function main(metadata, orientation) {
  let myApplet = new MyApplet(orientation);
  return myApplet;
}
