const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem } = imports.ui.popupMenu;
const { AppletSettings } = imports.ui.settings;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { ScrollDirection } = imports.gi.Clutter;
const Gettext = imports.gettext; // l10n support
const { get_home_dir } = imports.gi.GLib;
const { Clipboard, ClipboardType } = imports.gi.St;
const { file_new_for_path } = imports.gi.Gio;

const { MpvPlayerHandler } = require('./mpvPlayerHandler')
const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so"

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

    // Allow Applet to be used on vertical and horizontal panels. By default only horizontal panels are allowed
    this.setAllowedLayout(AllowedLayout.BOTH);

    // for i18n
    UUID = __meta.uuid;
    Gettext.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale");

    this.settings = new AppletSettings(this, __meta.uuid, instance_id);
    this._initSettings()

    const initialChannel = this._initMpvPlayer()
    this._initGui(orientation, initialChannel)
  }

  _initSettings() {
    // bind properties 
    this.settings.bind("icon-type", "icon_type", this.set_icon);
    this.settings.bind("color-on", "color_on", this.on_color_changed);
    this.settings.bind("tree", "channel_list", this.on_channel_list_update);
    this.settings.bind("initial-volume", "initial_volume", this.on_initial_volume_changed);
    this.settings.bind("channel-on-panel", "show_channel_on_panel", this.on_show_channel_on_panel_changed)

    this._trimChannelList()
  }

  _initMpvPlayer() {

    const configPath = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;

    this.mpvPlayer = new MpvPlayerHandler({
      mprisPluginPath: configPath + '/.mpris.so',
      handleRadioStopped: () => { this._changeSetCurrentMenuItem({ activatedMenuItem: this.stopitem }) },
      initialVolume: this.initial_volume
    })

    const initialChannel = this._getChannel({ channelUrl: this.mpvPlayer.getRunningRadioUrl() })

    return initialChannel
  }

  _initGui(orientation, initialChannel) {
    const menuManager = new PopupMenuManager(this);
    this.menu = new AppletPopupMenu(this, orientation);
    menuManager.addMenu(this.menu);

    this._createContextMenu()
    this.set_icon();
    this.set_applet_label({ currentChannel: initialChannel })
    this._setIconColor({ radioPlaying: initialChannel })
    this.set_applet_tooltip({ channel: initialChannel })
    this._createMenu({ currentChannel: initialChannel })
    this.actor.connect('scroll-event', (actor, event) => this._on_mouse_scroll(event));
  }

  _setIconColor({ radioPlaying }) {
    const color = radioPlaying ? this.color_on : "white"
    this.actor.style = `color: ${color}`
  }

  set_icon() {
    if (this.icon_type === "SYMBOLIC") this.set_applet_icon_symbolic_name('radioapplet')
    else this.set_applet_icon_name(`radioapplet-${this.icon_type.toLowerCase()}`)
  }

  set_applet_label({ currentChannel }) {
    const text = (currentChannel && this.show_channel_on_panel) ? " " + currentChannel.name : ""
    super.set_applet_label(text)
  }

  _trimChannelList() {
    this.channel_list.forEach(channel => channel.url = channel.url.trim())
  }

  on_streamurl_button_pressed() {
    spawnCommandLine("xdg-open https://streamurl.link");
  }

  on_radiolist_button_pressed() {
    spawnCommandLine("xdg-open https://wiki.ubuntuusers.de/Internetradio/Stationen");
  }

  on_color_changed() {
    this._setIconColor({ radioPlaying: this.mpvPlayer.channelUrl })
  }

  on_channel_list_update() {
    this._trimChannelList()
    this.menu.removeAll();
    this.currentMenuItem = null;
    const currentChannel = this._getChannel({ channelUrl: this.mpvPlayer.getRunningRadioUrl() })
    this._createMenu({ currentChannel: currentChannel })
  }

  on_show_channel_on_panel_changed() {
    const currentChannel = this._getChannel({ channelUrl: this.mpvPlayer.getRunningRadioUrl() })
    this.set_applet_label({ currentChannel: currentChannel })
  }

  _getChannel({ channelUrl }) {
    let channel = this.channel_list.find(cnl => cnl.url === channelUrl)
    if (!channel || channel.inc === false) channel = false
    return channel
  }

  async _on_radio_channel_clicked(e, channel) {
    if (!this.currentMenuItem || this.currentMenuItem != e) {
      this._changeSetCurrentMenuItem({ activatedMenuItem: e, channel: channel })
      try {
        await this.mpvPlayer.startChangeRadioChannel(channel.url)
      } catch (error) {
        this._notify_send(_("Can't play  %s").format(channel.name) + ". " + _("Make sure that the URL is valid and you have a stable internet connection. Don't hestitate to open an Issue on Github if the problem persists."))
        global.logError(error)
        return
      }
    }
  }

  _createMenu({ currentChannel }) {
    this.channel_list.forEach(channel => {
      if (channel.inc === true) {
        const channelItem = new PopupMenuItem(channel.name, false);
        this.menu.addMenuItem(channelItem);
        channelItem.connect('activate', (e) => { this._on_radio_channel_clicked(e, channel) });
        if (channel === currentChannel) this._setDotToMenuItem({ menuItemWithDot: channelItem })
      }
    });
    this.menu.addMenuItem(new PopupSeparatorMenuItem());

    // stop Item
    this.stopitem = new PopupMenuItem(_("Stop"), false);
    this.menu.addMenuItem(this.stopitem);
    if (!currentChannel) { this._setDotToMenuItem({ menuItemWithDot: this.stopitem }) }
    this.stopitem.connect('activate', () => { this._on_stop_item_clicked(); });
  }

  _createContextMenu() {
    const copyTitleItem = new PopupMenuItem(_("Copy current song title"));
    copyTitleItem.connect('activate', () => { this._on_copy_song(); });
    this._applet_context_menu.addMenuItem(copyTitleItem, 0)
    this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
  }

  _on_copy_song() {
    try {
      const currentSong = this.mpvPlayer.getCurrentSong()
      Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, currentSong);
    } catch (e) {
      this._notify_send(_("Can't copy current Song. Is the Radio playing?"))
      global.logError(e)
    }
  }

  _on_stop_item_clicked() {
    this.mpvPlayer.stopRadio()
  }

  _setDotToMenuItem({ menuItemWithDot }) {
    menuItemWithDot.setShowDot(true);
    if (this.currentMenuItem) this.currentMenuItem.setShowDot(false)
    this.currentMenuItem = menuItemWithDot;
  }

  set_applet_tooltip({ channel }) {
    const text = channel ? channel.name : "Radio++";
    super.set_applet_tooltip(text)

  }

  _changeSetCurrentMenuItem({ activatedMenuItem, channel }) {
    this._setDotToMenuItem({ menuItemWithDot: activatedMenuItem })
    this.set_applet_tooltip({ channel: channel })
    this.set_applet_label({ currentChannel: channel })

    const radioPlaying = activatedMenuItem === this.stopitem ? false : true
    this._setIconColor({ radioPlaying: radioPlaying });
  }

  on_initial_volume_changed() {
    this.mpvPlayer.initialVolume = this.initial_volume
  }

  // sends a notification but only if there hasn't been already the same notification in the last 10 seks
  _notify_send(notificationMsg) {
    const currentTime = Date.now()

    // preventing "reference to ... is undefined" in log
    if (!this.timeLastNotification) this.timeLastNotification = 0
    if (!this.lastNotificationMsg) this.lastNotificationMsg = null

    const timeDiff = currentTime - this.timeLastNotification
    if (timeDiff < 10000 && this.lastNotificationMsg === notificationMsg) return

    const iconPath = `${__meta.path}/icon.png`;
    spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notificationMsg + '" -i ' + iconPath);

    this.timeLastNotification = currentTime
    this.lastNotificationMsg = notificationMsg
  }

  _check_dependencies() {
    if (!file_new_for_path(this.mpvPlayer.mprisPluginPath).query_exists(null)) {
      const parentDir = __meta.path.split('/').slice(0, -1).join('/')

      spawnCommandLineAsyncIO(`python3  ${parentDir}/download-dialog.py`, (stdout) => {
        if (stdout.trim() == 'Continue') {
          spawnCommandLineAsyncIO(`wget ${MPRIS_PLUGIN_URL} -O ${this.mpvPlayer.mprisPluginPath}`);
        }
      })
      return false;
    }

    else {

      if (!file_new_for_path(`/usr/bin/mpv`).query_exists(null)) {
        this._notify_send(_("Please install the '%s' package.").format("mpv"));
        spawnCommandLine(`apturl apt://mpv`);
        return false;
      }

    }
    return true;
  }

  on_applet_clicked() {
    if (this._check_dependencies()) {
      this.menu.toggle();
    }
  }

  on_applet_removed_from_panel() {
    this.settings.finalize();
  }

  _on_mouse_scroll(event) {
    const direction = event.get_scroll_direction();
    const volumeChange = direction === ScrollDirection.UP ? 5 : -5
    const volumeChanged = this.mpvPlayer.increaseDecreaseVolume(volumeChange)

    if (!volumeChanged) this._notify_send(_("Can't increase Volume. Volume already at maximum."))
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamonRadioApplet(orientation, panel_height, instance_id);
}
