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
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    if(this.setAllowedLayout) this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    //Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bindProperty(Settings.BindingDirection.IN, "icon-type", "icon_type", this.on_icon_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "color-on", "color_on", this.set_color(), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "tree", "names", this.on_tree_changed, null);
    this.oldNames = "{}";
    this.currentMenuItem = null;
    this._connect_signals();
    this.radioId = "";
    this.on_icon_changed();
    this.on_tree_changed(true);
    this.oldNames = JSON.stringify(this.names);
    this.appletPath = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${UUID}`;
    this.mpvMprisPluginPath = this.appletPath + '/.mpris.so';
    this.volume = 50; // for mpv the volume is between 0 and 100 and for playerctl between 0 and 1

    // Keep radio running when it is alreay playing when starting the applet (e.g. when restarting cinnamon)
    this.get_playing_radio_channel(radioUrl => {
      if (radioUrl) {
        this.radioStatus = "PLAY";
        // We start the radio again because othwerilse we couldn't refresh the applet (icon color etc.) 
        // when stream is stopped from other app via mpris. 
        Util.spawnCommandLineAsyncIO(`playerctl --player=mpv volume`, (volume) => {
          this.volume = Number(volume) * 100
          this.startCM(radioUrl)
          this.set_color()
        })
      } else {
        this.radioStatus = "STOP";
      }
    })
  },

  on_streamurl_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://streamurl.link");
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
    if (this.radioStatus == "STOP") {
      this.get_default_icon_color();
      this.actor.style = "color: %s".format(this.defaultColor);
      return
    }
    this.actor.style = "color: %s;".format(this.color_on);
  },

  on_icon_changed: function () {
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
      this.stopitem = new PopupMenu.PopupMenuItem(_("Stop"), false);
      this.menu.addMenuItem(this.stopitem);

      this.stopitem.connect('activate', () => {
        this.stopRadio();
      });

      if (force && this.radioStatus == "STOP") {
        this.stopitem.setShowDot(true);
        this.set_applet_tooltip(_("Radio++"));
      }
      this.oldNames = JSON.stringify(this.names);
    }
  },

  stopRadio: function () {
    this.set_applet_tooltip(_("Radio++"));
    this.changeCurrentMenuItem(this.stopitem);
    Util.spawnCommandLine("playerctl --player=mpv stop");
    this.radioStatus = "STOP";
    this.radioId = "";
    this.set_color();
    Main.notify(_("Stop Radio++"));
  },

  changeCurrentMenuItem: function (activatedMenuItem) {
    activatedMenuItem.setShowDot(true);
    if (this.currentMenuItem) currentMenuItem.setShowDot(false)
    this.currentMenuItem = activatedMenuItem;
  },

  startCM: async function (id) {
    Util.spawnCommandLineAsyncIO(`playerctl -a stop & mpv --script=${this.mpvMprisPluginPath} \
      ${id} --volume=${this.volume} & wait; echo 'stop'`, () => {
      // this callback function is either called when the stream has been closed or the radio channel has changed
      setTimeout(() => {
        this.get_playing_radio_channel(radioPlaying => {
          if (!radioPlaying) {
            this.stopRadio();
          }
        })
      }, 100);
    })
    this.get_default_icon_color();
    this.radioStatus = "PLAY";
    this.set_color();
  },


  /**
   * 
   * @param {*} callback (function): always called. Has one argument: the name of the radio channel
   * if a radio channel listed in the applet settings is running with mpv and false if not
   * 
   * Be aware that when the radio channel has changed, there is a short period during 
   * which the radio is actually playing but the playerctl request returns no radio 
   * anyway.  
   * 
   */
  get_playing_radio_channel: function (callback) {
    Util.spawnCommandLineAsyncIO("playerctl --player=mpv metadata --format '{{ xesam:url }}'", (stdout, stderr) => {
      if (stderr.trim() == "No players found") {
        callback(false)
      } else {
        // This is important when somebody is doing the follwoing
        // 1. starting the radio, 2. open something else in mpv (using the mpris script) 3. turn off radio with mpris control 
        // In this case the first condition is not met but still it should be returned "false"
        const CHANNEL_LIST = this.names
        CHANNEL_LIST.some(channel => channel.url === stdout.trim()) ? callback(stdout.trim()) : callback(false)
      }
    })
  },

  notify_send: function(notification) {
    var iconPath = this.appletPath + '/icon.png';
    Util.spawnCommandLine('notify-send --hint=int:transient:1 "' + notification + '" -i ' + iconPath);
  },

  notify_installation: function(packageName) {
    this.notify_send(_("Please install the '%s' package.").format(packageName));
  },

  check_dependencies: function() {
    if(!Gio.file_new_for_path(this.mpvMprisPluginPath).query_exists(null)) {
        Util.spawn_async(['python3', this.appletPath + '/download-dialog.py'], Lang.bind(this, function(out) {
            if(out.trim() == 'Continue') {
                Util.spawnCommandLineAsyncIO(`wget https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so -O ${this.mpvMprisPluginPath}`);
            }
        }));
        return false;
    } else if(!Gio.file_new_for_path("/usr/bin/mpv").query_exists(null)) {
        this.notify_installation('mpv');
        Util.spawnCommandLine("apturl apt://mpv");
        return false;
    } else if(!Gio.file_new_for_path("/usr/bin/playerctl").query_exists(null)) {   
        this.notify_installation('playerctl');
        Util.spawnCommandLine("apturl apt://playerctl");
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
    direction === Clutter.ScrollDirection.UP ? this.volume += 5 : this.volume -= 5
    Util.spawnCommandLine(`playerctl --player=mpv volume ${this.volume / 100}`)
  }
};

function main(metadata, orientation, panel_height, instance_id) { // Make sure you collect and pass on instanceId
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}
