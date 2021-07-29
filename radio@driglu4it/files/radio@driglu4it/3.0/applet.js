const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext; // l10n support
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

const UUID = "radio@driglu4it";

//const ICONS_DIR = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/icons";

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
  __proto__: Applet.IconApplet.prototype,
  _init: function(orientation, panel_height, instance_id) {
//    Util.spawnCommandLine("mocp");
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    if(this.setAllowedLayout) this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    //Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bindProperty(Settings.BindingDirection.IN, "icon-type", "icon_type", this.on_icon_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "color-on", "color_on", this.get_moc_status, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "tree", "names", this.on_tree_changed, null);
    this.oldNames = "{}";
    this.currentMenuItem = null;
    this._connect_signals();
    this.mocStatus = "STOP";
    this.radioId = "";
    this.get_moc_status();
    this.on_icon_changed();
    this.on_tree_changed(true);
    this.oldNames = JSON.stringify(this.names);
  },

  on_streamurl_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://streamurl.link");
  },

  on_radiolist_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://wiki.ubuntuusers.de/Internetradio/Stationen");
  },

  get_default_icon_color() {
    try {
      let themeNode = this.actor.get_theme_node(); // get_theme_node() fails in constructor! (cause: widget not on stage)
      let icon_color = themeNode.get_icon_colors();
      this.defaultColor = icon_color.foreground.to_string();
    } catch(e) {
      this.defaultColor = "white";
    }
  },

  set_color: function() {
    if (this.mocStatus == "STOP") {
      this.get_default_icon_color();
      this.actor.style = "color: %s".format(this.defaultColor);
      return
    }
    this.actor.style = "color: %s;".format(this.color_on);
  },

  get_moc_status: function() {
    Util.spawn_async(['/usr/bin/mocp', '-Q %state,%r,%file,%title'], Lang.bind(this, function(out) {
      let [state, rate, file, title] = out.trim().split(",");
      this.mocStatus = state;
      this.radioId = file;
      if (state === "PLAY") {
        for (let i = 0; i < this.names.length; i++) {
          let id = this.names[i].url;
          if (this.radioId === id) {
            this.set_applet_tooltip(this.names[i].name);
            break;
          }
        }
      } else {
        this.set_applet_tooltip(_("Radio++"));
      }
      this.set_color();
    }));
  },

  on_icon_changed: function() {
    if (this.icon_type === "SYMBOLIC") {
      this.set_applet_icon_symbolic_name('radioapplet');
    } else if (this.icon_type === "FULLCOLOR") {
      this.set_applet_icon_name('radioapplet-fullcolor');
    } else { // BICOLOR
      this.set_applet_icon_name('radioapplet-bicolor');
    }
  },

  on_tree_changed: function(force=false) {
    if (force || this.oldNames != JSON.stringify(this.names)) {
      this.set_applet_tooltip(_("Radio++"));
      this.currentMenuItem = null;
      this.menu.removeAll();
      for (let i = 0; i < this.names.length; i++) {
        let title = this.names[i].name;
        let id = this.names[i].url;
        if (this.names[i].inc === true) {
          let menuitem = new PopupMenu.PopupMenuItem(title, false);
          this.menu.addMenuItem(menuitem);
          menuitem.connect('activate', Lang.bind(this, function() {
            if (this.currentMenuItem != menuitem) {
              this.set_applet_tooltip(title);
              this.startCM(id);
              Main.notify(_("Playing %s").format(title));
              this.radioId = id;
              this.activeMenuItemChanged(menuitem);
            }
          }));
          if (force && this.radioId === id) menuitem.setShowDot(true);
        }
        if (this.radioId === id) this.set_applet_tooltip(title);
      }
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      let stopitem = new PopupMenu.PopupMenuItem(_("Stop"), false);
      this.menu.addMenuItem(stopitem);
      stopitem.connect('activate', Lang.bind(this, function() {
        this.set_applet_tooltip(_("Radio++"));
        this.activeMenuItemChanged(stopitem);
        Util.spawnCommandLine("mocp -s");
        this.mocStatus = "STOP";
        this.radioId = "";
        this.set_color();
        Main.notify(_("Stop Radio++"));
      }));
      if (force && this.mocStatus == "STOP") {
        stopitem.setShowDot(true);
        this.set_applet_tooltip(_("Radio++"));
      }
      this.oldNames = JSON.stringify(this.names);
    }
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
    Util.spawnCommandLine("mocp -S");
    Util.spawnCommandLine('mocp -c -a -p ' + id);
    this.mocStatus = "PLAY";
    this.set_color();
  },

  notify_send: function(notification) {
    var iconPath = this.appletPath + '/icon.png';
    Util.spawnCommandLine('notify-send --hint=int:transient:1 "' + notification + '" -i ' + iconPath);
  },

  notify_installation: function(packageName) {
    this.notify_send(_("Please install the '%s' package.").format(packageName));
  },

  check_dependencies: function() {
    if(!Gio.file_new_for_path("/usr/bin/mocp").query_exists(null)) {
        this.notify_installation('moc');
        Util.spawnCommandLine("apturl apt://moc");
        return false;
    }
    return true;
  },

  on_applet_clicked: function(event) {
    if(this.check_dependencies()) {
        this.on_tree_changed(true);
        this.menu.toggle();
    }
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
      Util.spawnCommandLine("mocp -v +5");
    }
    else {
      Util.spawnCommandLine("mocp -v -5");
    }
  }
};

function main(metadata, orientation, panel_height, instance_id) { // Make sure you collect and pass on instanceId
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}
