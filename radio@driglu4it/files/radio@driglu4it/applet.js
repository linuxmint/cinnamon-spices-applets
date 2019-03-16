const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
// l10n support
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const UUID = "radio@driglu4it";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")
function _(str) {
    let customTranslation = Gettext.dgettext(UUID, str);
    if(customTranslation != str) {
        return customTranslation;
    }
    return Gettext.gettext(str);
}

function MyApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}
MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,
  _init: function(orientation, panel_height, instance_id) {
    Main.Util.spawnCommandLine("mocp");
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.set_applet_icon_symbolic_path(GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/icons/radio.svg");
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.settings = new Settings.AppletSettings(this, "radio@driglu4it", instance_id);
    this.settings.bind("tree", "name", this.on_settings_changed);
    this.currentMenuItem = null;
    this._connect_signals();
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
        if (this.name[i].inc == true) {
      let title = this.name[i].name;
      let id = this.name[i].url;
      let menuitem = new PopupMenu.PopupMenuItem(title, false);
      menuitem.connect('activate', Lang.bind(this, function() {
        if (this.currentMenuItem != menuitem) {
            this.set_applet_tooltip(title);
            this.startCM(id);
            Main.notify(_("Playing %s").format(title));
            this.activeMenuItemChanged(menuitem);
        }
      }));
      this.menu.addMenuItem(menuitem); }
    }
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    let stopitem = new PopupMenu.PopupMenuItem(_("Stop"), false);
    stopitem.connect('activate', Lang.bind(this, function() {
      this.set_applet_tooltip(_("Radio++"));
      this.activeMenuItemChanged(stopitem);
      Main.Util.spawnCommandLine("mocp -s");
      Main.notify(_("Stop") + ' Radio++');
    }));
    this.menu.addMenuItem(stopitem);
    this.activeMenuItemChanged(stopitem);
  },
  activeMenuItemChanged: function(activatedMenuItem) {
    if(this.currentMenuItem == null) {
        this.currentMenuItem = activatedMenuItem;
    } else {
        this.currentMenuItem.setShowDot(false);
        this.currentMenuItem = activatedMenuItem;
    }
    this.currentMenuItem.setShowDot(true);
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
},
_connect_signals: function() {
        try {
            this.actor.connect('scroll-event', Lang.bind(this, this.on_mouse_scroll));
        }
        catch(e) {
            global.log("Error while connecting signals: " + e);
        }
    },
  on_mouse_scroll: function(actor, event) {

            let direction = event.get_scroll_direction();
            if (direction == Clutter.ScrollDirection.UP) {
                Main.Util.spawnCommandLine("mocp -v +5");
            }
            else {
                Main.Util.spawnCommandLine("mocp -v -5");
            }

    },

};

function main(metadata, orientation, panel_height, instance_id) { // Make sure you collect and pass on instanceId
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}
