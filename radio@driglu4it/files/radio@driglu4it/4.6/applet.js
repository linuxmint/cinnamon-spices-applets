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

const { MpvPlayerHandler } = require('./mpvPlayerHandler')


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
    // Be aware that when one setting is changed, all binded methods are called (e.g. if a channel is added in the settings, also the method for setting the symbolic icon color is called)
    this.settings.bind("icon-type", "icon_type", this.set_icon);
    this.settings.bind("color-on", "color_on", this.on_color_changed);
    this.settings.bind("tree", "channel_list", this.on_channel_list_update);
    this.settings.bind("max-volume", "max_volume", this.on_max_volume_changed);
    this.settings.bind("initial-volume", "initial_volume", this.on_initial_volume_changed);

    this.appletPath = `${GLib.get_home_dir()}/.local/share/cinnamon/applets/${UUID}`;
    const configPath = `${GLib.get_home_dir()}/.cinnamon/configs/${UUID}`;

    // getting the channel which is running at start of applet (e.g. when restarting cinnamon)
    const runningChannelUrl = await MpvPlayerHandler.getRunningRadioUrl()
    const initialChannel = this.getChannel({ channelUrl: runningChannelUrl })

    // create Gui
    this.set_icon();
    this.setIconColor({ radioPlaying: initialChannel })
    this.setTooltip({ channel: initialChannel })
    this.createMenu({ currentChannel: initialChannel })
    this.actor.connect('scroll-event', Lang.bind(this, this.on_mouse_scroll));

    this.mpvPlayer = new MpvPlayerHandler({
      mprisPluginPath: configPath + '/.mpris.so',
      initialChannelUrl: initialChannel.url,
      onRadioStopped: () => { this.changeSetCurrentMenuItem({ activatedMenuItem: this.stopitem }) },
      initialVolume: this.initial_volume,
      maxVolume: this.max_volume
    })

    // The radio needs to be restarted so that we can change the color and tooltip when the radio gets stopped from outside the applet via MPRIS 
    if (initialChannel) await this.mpvPlayer.startChangeRadioChannel(initialChannel.url)
  },

  on_streamurl_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://streamurl.link");
  },

  on_radiolist_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://wiki.ubuntuusers.de/Internetradio/Stationen");
  },

  on_color_changed: async function () {
    this.setIconColor({ radioPlaying: this.mpvPlayer.channelUrl })
  },

  on_channel_list_update: async function () {
    this.menu.removeAll();
    const currentChannel = this.getChannel({ channelUrl: this.mpvPlayer.channelUrl })
    this.createMenu({ currentChannel: currentChannel })
  },

  setIconColor: function ({ radioPlaying }) {
    // default icon color is the color of the icon when no stream is running
    let color;
    if (radioPlaying) {
      color = this.color_on
    } else {
      try {
        let themeNode = this.actor.get_theme_node(); // get_theme_node() fails in constructor! (cause: widget not on stage)
        let icon_color = themeNode.get_icon_colors();
        clor = icon_color.foreground.to_string();
      } catch (e) {
        color = "white";
      }
    }

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

  getChannel({ channelUrl }) {
    let channel = this.channel_list.find(cnl => cnl.url === channelUrl)
    if (!channel || channel.inc === false) channel = false
    return channel
  },

  on_radio_channel_clicked: async function (e, channel) {
    if (!this.currentMenuItem || this.currentMenuItem != e) {
      this.changeSetCurrentMenuItem({ activatedMenuItem: e, channel: channel })
      try {
        await this.mpvPlayer.startChangeRadioChannel(channel.url)
      } catch (error) {
        this.notify_send(_("Can't play  %s").format(channel.name) + ". " + _("Make sure that the URL is valid and you have a stable internet connection. Don't hestitate to open an Issue on Github if the problem persists."))
        global.log(error)
        return
      }
    }
  },

  createMenu: function ({ currentChannel }) {
    this.channel_list.forEach(channel => {
      if (channel.inc === true) {
        const channelItem = new PopupMenu.PopupMenuItem(channel.name, false);
        this.menu.addMenuItem(channelItem);
        channelItem.connect('activate', (e) => { this.on_radio_channel_clicked(e, channel) });
        if (channel === currentChannel) this.setDotToMenuItem({ menuItemWithDot: channelItem })
      }
    });
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // stop Item
    this.stopitem = new PopupMenu.PopupMenuItem(_("Stop"), false);
    this.menu.addMenuItem(this.stopitem);
    if (!currentChannel) { this.setDotToMenuItem({ menuItemWithDot: this.stopitem }) }
    this.stopitem.connect('activate', () => { this.on_stop_item_clicked(); });
  },

  on_stop_item_clicked: function () {
    this.mpvPlayer.stopRadio()
  },

  setDotToMenuItem: function ({ menuItemWithDot }) {
    menuItemWithDot.setShowDot(true);
    if (this.currentMenuItem) this.currentMenuItem.setShowDot(false)
    this.currentMenuItem = menuItemWithDot;
  },

  setTooltip: function ({ channel }) {
    const tooltipText = channel ? channel.name : "Radio++";
    this.set_applet_tooltip(_(tooltipText));
  },

  // The function is responsible for: 
  // - indicating the current Menu Item with a dot 
  // - setting the text in the tooltip to the current running channel name or "Radio++" if no radio is running.
  // - setting the color of the icon 
  changeSetCurrentMenuItem: function ({ activatedMenuItem, channel }) {
    this.setDotToMenuItem({ menuItemWithDot: activatedMenuItem })
    this.setTooltip({ channel: channel })

    const radioPlaying = activatedMenuItem === this.stopitem ? false : true
    this.setIconColor({ radioPlaying: radioPlaying });
  },

  on_max_volume_changed: async function () {
    this.mpvPlayer.maxVolume = this.max_volume
    await this.mpvPlayer.increaseDecreaseVolume(0)
  },

  on_initial_volume_changed: function () {
    if (this.initial_volume > this.max_volume) {
      this.initial_volume = this.max_volume
    }
  },

  notify_send: function (notification) {
    var iconPath = this.appletPath + '/icon.png';
    Util.spawnCommandLine('notify-send --hint=int:transient:1 "' + notification + '" -i ' + iconPath);
  },

  notify_installation: function (packageName) {
    this.notify_send(_("Please install the '%s' package.").format(packageName));
  },

  check_dependencies: function () {
    if (!Gio.file_new_for_path(this.mpvPlayer.mprisPluginPath).query_exists(null)) {
      Util.spawn_async(['python3', this.appletPath + '/download-dialog.py'], Lang.bind(this, function (out) {
        if (out.trim() == 'Continue') {
          Util.spawnCommandLineAsyncIO(`wget https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so -O ${this.mpvPlayer.mprisPluginPath}`);
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

  on_mouse_scroll: async function (actor, event) {
    let direction = event.get_scroll_direction();
    const volumeChange = direction === Clutter.ScrollDirection.UP ? 5 : -5
    const volumeChangeable = await this.mpvPlayer.increaseDecreaseVolume(volumeChange)

    if (!volumeChangeable) this.notify_send(_("Can't increase Volume. Volume already at maximum. Change the Maximum Volume in the Settings to further increase the Volume."))
  },
};

function main(metadata, orientation, panel_height, instance_id) { // Make sure you collect and pass on instanceId
  let myApplet = new MyApplet(orientation, panel_height, instance_id);
  return myApplet;
}
