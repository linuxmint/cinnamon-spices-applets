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

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")
function _(str) {
  let customTranslation = Gettext.dgettext(UUID, str);
  if (customTranslation != str) {
    return customTranslation;
  }
  return Gettext.gettext(str);
}

function MyApplet(orientation, panel_height, instance_id) {
  this._init(orientation, panel_height, instance_id);
}
MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: async function (orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    if (this.setAllowedLayout) this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);

    // bind properties 
    this.settings.bindProperty(Settings.BindingDirection.IN, "icon-type", "icon_type", this.set_icon, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "color-on", "color_on", this.on_color_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "tree", "channel_list", this.on_channel_list_update, null);

    this.appletPath = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${UUID}`;
    this.mpvMprisPluginPath = this.appletPath + '/.mpris.so';

    // getting the channel which is running at start of applet (e.g. when restarting cinnamon)
    const channel = await this.getRunningChannel()
    this.createUpdateMenu({ currentChannel: channel })

    this.actor.connect('scroll-event', Lang.bind(this, this.on_mouse_scroll));
    this.volume = (channel) ? await this.getVolume() : 50

    // The radio needs to be restarted so that we can change the color and tooltip
    // when radio gets stopped from outside the applet via MPRIS 
    if (channel) this.startChangeRadioChannel(channel)

  },

  on_streamurl_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://streamurl.link");
  },

  on_radiolist_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://wiki.ubuntuusers.de/Internetradio/Stationen");
  },

  on_color_changed: async function () {
    const channel = await this.getRunningChannel()
    this.setIconColor({ radioPlaying: channel })
  },

  on_channel_list_update: async function () {
    const channel = await this.getRunningChannel()
    this.createUpdateMenu({ currentChannel: channel })
  },

  /**
   * default icon color is the color of the icon when no stream is running
   * TODO: when is it not white?
   */
  get_default_icon_color: function () {
    let defaultColor;

    try {
      let themeNode = this.actor.get_theme_node(); // get_theme_node() fails in constructor! (cause: widget not on stage)
      let icon_color = themeNode.get_icon_colors();
      defaultColor = icon_color.foreground.to_string();
    } catch (e) {
      defaultColor = "white";
    }

    return defaultColor;

  },

  setIconColor: function ({ radioPlaying }) {
    const color = (radioPlaying) ? this.color_on : this.get_default_icon_color();
    this.actor.style = "color: %s;".format(color)
  },

  set_icon: function () {
    if (this.icon_type === "SYMBOLIC") {
      this.set_applet_icon_symbolic_name('radioapplet');
    } else if (this.icon_type === "FULLCOLOR") {
      this.set_applet_icon_name('radioapplet-fullcolor');
    } else { // BICOLOR
      this.set_applet_icon_name('radioapplet-bicolor');
    }
  },


  on_radio_channel_clicked: function (e, channel) {
    if (this.currentMenuItem != e) {
      this.changeSetCurrentMenuItem({ activatedMenuItem: e, channel: channel })
      this.startChangeRadioChannel(channel)
    }
  },

  // create the full popup menu including the icon
  createUpdateMenu: function ({ currentChannel }) {

    this.menu.removeAll();
    this.set_icon();

    this.channel_list.forEach(channel => {
      if (channel.inc === true) {
        const menuitem = new PopupMenu.PopupMenuItem(channel.name, false);
        this.menu.addMenuItem(menuitem);
        menuitem.connect('activate', (e) => {
          this.on_radio_channel_clicked(e, channel)
        });
        if (channel === currentChannel) this.changeSetCurrentMenuItem(
          { activatedMenuItem: menuitem, channel: channel })
      }
    });

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this.stopitem = new PopupMenu.PopupMenuItem(_("Stop"), false);
    this.menu.addMenuItem(this.stopitem);

    this.stopitem.connect('activate', () => {
      this.on_stop_item_clicked();
    });
  },

  // TODO: actually it should only be stopped the instance of mpv playing the current channel
  on_stop_item_clicked: function () {
    Util.spawnCommandLine("playerctl --player=mpv stop");
  },

  // The function is responsible for: 
  // - indicating the current Menu Item with a dot 
  // - setting the text in the tooltip to the current running channel name or "Radio++" if no radio is running.
  // - setting the color of the icon 
  // - Send notification 
  changeSetCurrentMenuItem: function ({ activatedMenuItem, channel }) {
    activatedMenuItem.setShowDot(true);
    if (this.currentMenuItem) this.currentMenuItem.setShowDot(false)
    this.currentMenuItem = activatedMenuItem;

    let tooltipText;
    let radioPlaying;
    let notificationText;

    if (activatedMenuItem === this.stopitem) {
      tooltipText = "Radio++";
      radioPlaying = false;
      notificationText = "Stop Radio++"
    } else {
      tooltipText = channel.name;
      radioPlaying = true
      notificationText = `Playing ${channel.name}`
    }

    this.set_applet_tooltip(_(tooltipText));
    this.setIconColor({ radioPlaying: radioPlaying });
    Main.notify(_(notificationText));

  },

  // Stops all running media outputs (which can be controlled via MPRIS) - not only potentially running radio streams
  startChangeRadioChannel: async function (channel) {

    // TODO: error handling
    Util.spawnCommandLineAsyncIO(`playerctl -a stop & mpv --script=${this.mpvMprisPluginPath} \
      ${channel.url} --volume=${this.volume} & wait; echo 'stop'`, () => {
      // this callback function is either called when the stream has been closed or the radio channel has changed
      // When the radio stream has been closed, it shall be indicated in the applet. It is not sufficient to just
      // call a function when the stop button is clicked as the radio stream can also be closed with MPRIS control
      setTimeout(async () => {
        const newChannel = await this.getRunningChannel();
        if (!newChannel) { this.changeSetCurrentMenuItem({ activatedMenuItem: this.stopitem }) }
      }, 100);
    })
  },


  /**
   * returns an channel object when: 
   *  - a stream with url is running with MPV(using the MPRIS plugin) 
   *  - the stream url is included in the channel list
   *  - the "show in list" checkbox in the setting is activated for the running channel
   * 
   * If one of the above options is not fullyfilled, the function returns false 
   * 
   *  Be aware that when the radio channel has changed, there is a short period during 
   *  which the radio is actually playing but the playerctl request returns no radio 
   *  anyway.  
   *
   * TODO: Error Handling
   */
  getRunningChannel: function () {
    return new Promise((resolve, reject) => {

      Util.spawnCommandLineAsyncIO("playerctl --player=mpv metadata --format '{{ xesam:url }}'", (stdout, stderr) => {
        if (stderr.trim() == "No players found") {
          resolve(false)
        } else {
          // This is important when somebody is doing the follwoing
          // 1. starting the radio, 2. open something else in mpv (using the mpris script) 3. turn off radio with mpris control 
          // In this case the first condition is not met but still it should be returned "false"
          const channel = this.channel_list.find(channel => channel.url === stdout.trim())
          if (channel && channel.inc === false) channel = false
          resolve(channel)
        }
      })
    })
  },

  // TODO: only get the volume for the mpv instance playing the radio
  // TODO: error Handling
  getVolume: function () {
    return new Promise((resolve, reject) => {
      Util.spawnCommandLineAsyncIO(`playerctl --player=mpv volume`, (volume) => {
        // for mpv the volume is between 0 and 100 and for playerctl between 0 and 1
        resolve(Number(volume) * 100)
      })
    })
  },

  notify_send: function (notification) {
    var iconPath = this.appletPath + '/icon.png';
    Util.spawnCommandLine('notify-send --hint=int:transient:1 "' + notification + '" -i ' + iconPath);
  },

  notify_installation: function (packageName) {
    this.notify_send(_("Please install the '%s' package.").format(packageName));
  },

  check_dependencies: function () {
    if (!Gio.file_new_for_path(this.mpvMprisPluginPath).query_exists(null)) {
      Util.spawn_async(['python3', this.appletPath + '/download-dialog.py'], Lang.bind(this, function (out) {
        if (out.trim() == 'Continue') {
          Util.spawnCommandLineAsyncIO(`wget https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so -O ${this.mpvMprisPluginPath}`);
        }
      }));
      return false;
    } else if (!Gio.file_new_for_path("/usr/bin/mpv").query_exists(null)) {
      this.notify_installation('mpv');
      Util.spawnCommandLine("apturl apt://mpv");
      return false;
    } else if (!Gio.file_new_for_path("/usr/bin/playerctl").query_exists(null)) {
      this.notify_installation('playerctl');
      Util.spawnCommandLine("apturl apt://playerctl");
      return false;
    }
    return true;
  },

  on_applet_clicked: function (event) {
    if (this.check_dependencies()) {
      this.menu.toggle();
    }
  },

  on_applet_removed_from_panel: function () {
    this.settings.finalize();
  },


  on_mouse_scroll: function (actor, event) {
    let direction = event.get_scroll_direction();
    direction === Clutter.ScrollDirection.UP ? this.volume += 5 : this.volume -= 5
    Util.spawnCommandLine(`playerctl --player=mpv volume ${this.volume / 100}`)
  }
};

function main(metadata, orientation, panel_height, instance_id) { // Make sure you collect and pass on instanceId
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}
