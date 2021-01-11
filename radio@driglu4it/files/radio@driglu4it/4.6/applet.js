const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem } = imports.ui.popupMenu;
const { AppletSettings } = imports.ui.settings;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext; // l10n support
const GLib = imports.gi.GLib;
const { Clipboard, ClipboardType } = imports.gi.St;
const Gio = imports.gi.Gio;

const { MpvPlayerHandler } = require('./mpvPlayerHandler')

// for i18n
let UUID;
function _(str) {
  let customTranslation = Gettext.dgettext(UUID, str);
  if (customTranslation != str) {
    return customTranslation;
  }
  return Gettext.gettext(str);
}

class CinnamonRadioApplet extends TextIconApplet {
  constructor(orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);

    // TODO: what is this for?
    if (this.setAllowedLayout) this.setAllowedLayout(AllowedLayout.BOTH);

    // for i18n
    UUID = __meta.uuid;
    Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
    // Settings
    this.settings = new AppletSettings(this, __meta.uuid, instance_id);
    // bind properties 
    this.settings.bind("icon-type", "icon_type", this.set_icon);
    this.settings.bind("color-on", "color_on", this.on_color_changed);
    this.settings.bind("tree", "channel_list", this.on_channel_list_update);
    this.settings.bind("initial-volume", "initial_volume", this.on_initial_volume_changed);
    this.settings.bind("channel-on-panel", "channel_on_panel", this.on_channel_on_panel_changed)

    this.channel_list.forEach(channel => channel.url = channel.url.trim())

    this.init(orientation)

  }

  // this function is used as await is not allowed in constructor
  async init(orientation) {

    const initialChannel = this.getChannel({ channelUrl: await MpvPlayerHandler.getRunningRadioUrl() })
    const configPath = `${GLib.get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;

    this.mpvPlayer = new MpvPlayerHandler({
      mprisPluginPath: configPath + '/.mpris.so',
      initialChannelUrl: initialChannel.url,
      handleRadioStopped: () => { this.changeSetCurrentMenuItem({ activatedMenuItem: this.stopitem }) },
      initialVolume: this.initial_volume
    })

    this.initGui(orientation, initialChannel)
    // The radio needs to be restarted so that we can change the color and tooltip when the radio gets stopped from outside the applet via MPRIS 
    if (initialChannel) await this.mpvPlayer.startChangeRadioChannel(initialChannel.url)
  }

  initGui(orientation, initialChannel) {
    const menuManager = new PopupMenuManager(this);
    this.menu = new AppletPopupMenu(this, orientation);
    menuManager.addMenu(this.menu);

    this.createContextMenu()
    this.set_icon();
    this.set_label({ currentChannel: initialChannel })
    this.setIconColor({ radioPlaying: initialChannel })
    this.setTooltip({ channel: initialChannel })
    this.createMenu({ currentChannel: initialChannel })
    this.actor.connect('scroll-event', (actor, event) => this.on_mouse_scroll(event));
  }

  on_streamurl_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://streamurl.link");
  }

  on_radiolist_button_pressed() {
    Main.Util.spawnCommandLine("xdg-open https://wiki.ubuntuusers.de/Internetradio/Stationen");
  }

  on_color_changed() {
    this.setIconColor({ radioPlaying: this.mpvPlayer.channelUrl })
  }

  on_channel_list_update() {
    this.menu.removeAll();
    this.currentMenuItem = null;
    const currentChannel = this.getChannel({ channelUrl: this.mpvPlayer.channelUrl })
    this.createMenu({ currentChannel: currentChannel })
  }

  setIconColor({ radioPlaying }) {
    const color = radioPlaying ? this.color_on : "white"
    this.actor.style = `color: ${color}`
  }

  set_icon() {
    if (this.icon_type === "SYMBOLIC") this.set_applet_icon_symbolic_name('radioapplet')
    else this.set_applet_icon_name(`radioapplet-${this.icon_type.toLowerCase()}`)
  }

  set_label({ currentChannel }) {
    if (currentChannel && this.channel_on_panel) this.set_applet_label(" " + currentChannel.name)
    else this.hide_applet_label(true)
  }

  on_channel_on_panel_changed() {
    const currentChannel = this.getChannel({ channelUrl: this.mpvPlayer.channelUrl })
    this.set_label({ currentChannel: currentChannel })
  }

  getChannel({ channelUrl }) {
    let channel = this.channel_list.find(cnl => cnl.url === channelUrl)
    if (!channel || channel.inc === false) channel = false
    return channel
  }

  async on_radio_channel_clicked(e, channel) {
    if (!this.currentMenuItem || this.currentMenuItem != e) {
      this.changeSetCurrentMenuItem({ activatedMenuItem: e, channel: channel })
      try {
        await this.mpvPlayer.startChangeRadioChannel(channel.url)
      } catch (error) {
        this.notify_send(_("Can't play  %s").format(channel.name) + ". " + _("Make sure that the URL is valid and you have a stable internet connection. Don't hestitate to open an Issue on Github if the problem persists."))
        global.logError(error)
        return
      }
    }
  }

  createMenu({ currentChannel }) {
    this.channel_list.forEach(channel => {
      if (channel.inc === true) {
        const channelItem = new PopupMenuItem(channel.name, false);
        this.menu.addMenuItem(channelItem);
        channelItem.connect('activate', (e) => { this.on_radio_channel_clicked(e, channel) });
        if (channel === currentChannel) this.setDotToMenuItem({ menuItemWithDot: channelItem })
      }
    });
    this.menu.addMenuItem(new PopupSeparatorMenuItem());

    // stop Item
    this.stopitem = new PopupMenuItem(_("Stop"), false);
    this.menu.addMenuItem(this.stopitem);
    if (!currentChannel) { this.setDotToMenuItem({ menuItemWithDot: this.stopitem }) }
    this.stopitem.connect('activate', () => { this.on_stop_item_clicked(); });
  }

  createContextMenu() {
    const copyTitleItem = new PopupMenuItem(_("Copy current song title"));
    copyTitleItem.connect('activate', () => { this.on_copy_song(); });
    this._applet_context_menu.addMenuItem(copyTitleItem, 0)
    this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
  }

  async on_copy_song() {
    try {
      const currentSong = await MpvPlayerHandler.getCurrentSong()
      Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, currentSong);
    } catch (e) {
      this.notify_send(_("Can't copy current Song. Is the Radio playing?"))
    }
  }

  on_stop_item_clicked() {
    this.mpvPlayer.stopRadio()
  }

  setDotToMenuItem({ menuItemWithDot }) {
    menuItemWithDot.setShowDot(true);
    if (this.currentMenuItem) this.currentMenuItem.setShowDot(false)
    this.currentMenuItem = menuItemWithDot;
  }

  setTooltip({ channel }) {
    const tooltipText = channel ? channel.name : "Radio++";
    this.set_applet_tooltip(tooltipText);
  }

  changeSetCurrentMenuItem({ activatedMenuItem, channel }) {
    this.setDotToMenuItem({ menuItemWithDot: activatedMenuItem })
    this.setTooltip({ channel: channel })
    this.set_label({ currentChannel: channel })

    const radioPlaying = activatedMenuItem === this.stopitem ? false : true
    this.setIconColor({ radioPlaying: radioPlaying });
  }

  on_initial_volume_changed() {
    this.mpvPlayer.initialVolume = this.initial_volume
  }

  // sends a notification but only if there hasn't been already the same notification in the last 10 seks
  notify_send(notificationMsg) {
    const currentTime = Date.now()

    // preventing "reference to ... is undefined" in log
    if (!this.timeLastNotification) this.timeLastNotification = 0
    if (!this.lastNotificationMsg) this.lastNotificationMsg = null

    const timeDiff = currentTime - this.timeLastNotification
    if (timeDiff < 10000 && this.lastNotificationMsg === notificationMsg) return

    const iconPath = `${__meta.path}/icon.png`;
    Util.spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notificationMsg + '" -i ' + iconPath);

    this.timeLastNotification = currentTime
    this.lastNotificationMsg = notificationMsg
  }

  check_dependencies() {
    if (!Gio.file_new_for_path(this.mpvPlayer.mprisPluginPath).query_exists(null)) {
      const parentDir = __meta.path.split('/').slice(0, -1).join('/')
      Util.spawn_async(['python3', parentDir + '/download-dialog.py'], (stdout) => {
        if (stdout.trim() == 'Continue') {
          Util.spawnCommandLineAsyncIO(`wget https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so -O ${this.mpvPlayer.mprisPluginPath}`);
        }
      })
      return false;
    }

    else {
      ["playerctl", "mpv"].forEach(packageName => {
        if (!Gio.file_new_for_path(`/usr/bin/${packageName}`).query_exists(null)) {
          this.notify_send(_("Please install the '%s' package.").format(packageName));
          Util.spawnCommandLine(`apturl apt://${packageName}`);
          return false;
        }
      })
    }
    return true;
  }

  on_applet_clicked() {
    if (this.check_dependencies()) {
      this.menu.toggle();
    }
  }

  on_applet_removed_from_panel() {
    this.settings.finalize();
  }

  async on_mouse_scroll(event) {
    const direction = event.get_scroll_direction();
    const volumeChange = direction === Clutter.ScrollDirection.UP ? 5 : -5
    const volumeChangeable = await this.mpvPlayer.increaseDecreaseVolume(volumeChange)

    if (!volumeChangeable) this.notify_send(_("Can't increase Volume. Volume already at maximum."))
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamonRadioApplet(orientation, panel_height, instance_id);
}
