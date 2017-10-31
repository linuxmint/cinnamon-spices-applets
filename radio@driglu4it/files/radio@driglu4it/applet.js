const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;

function MyApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}
MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,
  _init: function(orientation, panel_height, instance_id) {
    Main.Util.spawnCommandLine("mocp");
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.settings = new Settings.AppletSettings(this, "radio@driglu4it", instance_id);
    this.settings.bind("tree", "name", this.on_settings_changed);
    this.on_settings_changed();
  },
  on_settings_changed: function() {
    this.set_applet_tooltip(_("Radio++"));
    this.set_applet_icon_name('radio');
    this.menu.removeAll();
    this.menuManager.addMenu(this.menu);
    var i;
    var j = this.name.length;
    for (i = 0; i < j; i++) {
      let title = this.name[i].name;
      let id = this.name[i].url;
      let menuitem = new PopupMenu.PopupMenuItem(title);
      menuitem.connect('activate', Lang.bind(this, function() {
        this.startCM(id);
        Main.notify(_("Playing") + ' ' + title);
      }));
      this.menu.addMenuItem(menuitem);
    }
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this.menu.addAction(_("Stop"), function(event) {
      Main.Util.spawnCommandLine("mocp -s");
      Main.notify(_("Stop") + ' Radio++');
    });
  },
  startCM: function(id) {
    //Make sure that the MOC-Server is running before playing a stream
    Main.Util.spawnCommandLine("mocp -S")
    Main.Util.spawnCommandLine('mocp -c -a -p ' + id);
  },
  on_applet_clicked: function(event) {
    this.menu.toggle();
  },
  on_applet_removed_from_panel: function() {
    this.settings.finalize();
  }
};

function main(metadata, orientation, panel_height, instance_id) { // Make sure you collect and pass on instanceId
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}
