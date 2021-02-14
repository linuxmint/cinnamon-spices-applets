const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
const { AppletSettings } = imports.ui.settings;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { ScrollDirection } = imports.gi.Clutter;
const Gettext = imports.gettext; // l10n support
const { get_home_dir } = imports.gi.GLib;
const { Clipboard, ClipboardType } = imports.gi.St;
const { file_new_for_path } = imports.gi.Gio;

const { MpvPlayerHandler } = require('./mpvPlayerHandler')
const { PlayPauseIconMenuItem } = require('./playPauseIconMenuItem')

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
    this._trimChannelList()

    this._initMpvPlayer()
    const initialChannelName = this._getChannelName({ channelUrl: this.mpvPlayer.getRunningRadioUrl() })
    this._initGui(orientation, initialChannelName)
  }

  _initSettings() {
    // bind properties 
    this.settings.bind("icon-type", "icon_type", this.set_icon);
    this.settings.bind("color-on", "color_on", this._setIconColor);
    this.settings.bind("tree", "channel_list", this.on_channel_list_update);
    this.settings.bind("channel-on-panel", "show_channel_on_panel", this.on_show_channel_on_panel_changed)
    this.settings.bind("initial-volume", "custom_initial_volume");
    this.settings.bind("keep-volume-between-sessions", "keep_volume_between_sessions")
    this.settings.bind("last-volume", "last_volume")
  }

  _initMpvPlayer() {
    const configPath = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
    const mprisPluginPath = configPath + '/.mpris.so'

    this.mpvPlayer = new MpvPlayerHandler({
      mprisPluginPath: mprisPluginPath,
      _handleRadioStopped: (...args) => this._handleRadioStopped(args),
      _getInitialVolume: () => this._getInitialVolume(),
      _handleRadioChannelChangedPaused: (...args) => this._handleRadioChannelChangedPaused(...args),
      _handleVolumeChanged: (...args) => this.set_applet_tooltip(...args)

    })

    this.mpvPlayer.init()

  }

  _handleRadioChannelChangedPaused(channelUrl) {
    const menuItem = this._getChannelMenuItem(channelUrl)
    if (menuItem) this._changeSetCurrentMenuItem(menuItem)
  }

  _handleRadioStopped(volume) {
    if (this.keep_volume_between_sessions) this.last_volume = volume
    this._changeSetCurrentMenuItem(this.stopitem)
  }

  _initGui(orientation, initialChannelName) {
    this.set_icon();
    this._createMenu({ currentChannelName: initialChannelName, orientation })
    this._createContextMenu()
    this.actor.connect('scroll-event', (actor, event) => this._on_mouse_scroll(event));
  }

  _setIconColor() {
    const color = (this.mpvPlayer.getPlayPauseStatus() === "Playing") ? this.color_on : this._getThemeIconColor()
    this.actor.style = `color: ${color}`
  }

  _getThemeIconColor() {

    let iconThemeColor

    try {
      iconThemeColor = this.actor.get_theme_node().get_icon_colors().foreground.to_string()
    } catch (error) {
      global.logError(`Couldn't set theme icon color. Using white instead. The following error occured: ${error}`)
      iconThemeColor = "white"
    }

    return iconThemeColor

  }

  set_icon() {
    if (this.icon_type === "SYMBOLIC") this.set_applet_icon_symbolic_name('radioapplet')
    else this.set_applet_icon_name(`radioapplet-${this.icon_type.toLowerCase()}`)
  }

  set_applet_label(nameCurrentMenuItem) {
    const text = (this.mpvPlayer.getPlayPauseStatus() === "Playing" && this.show_channel_on_panel)
      ? " " + nameCurrentMenuItem : ""
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

  on_channel_list_update() {
    this._trimChannelList()
    this.menu.removeAll();
    this.currentMenuItem = null;
    const currentChannelName = this._getChannelName({ channelUrl: this.mpvPlayer.getRunningRadioUrl() })
    this._createMenu({ currentChannelName: currentChannelName })
  }

  on_show_channel_on_panel_changed() {
    const currentChannelName = this._getChannelName({ channelUrl: this.mpvPlayer.getRunningRadioUrl() })
    this.set_applet_label(currentChannelName)
  }

  // TODO: what is when two Channels have the same Name? :O
  _getChannelName({ channelUrl }) {
    let channel = this.channel_list.find(cnl => cnl.url === channelUrl)
    if (!channel || channel.inc === false) channel = false

    return channel.name
  }

  _getInitialVolume() {
    return this.keep_volume_between_sessions ? this.last_volume : this.custom_initial_volume
  }

  async _on_radio_channel_clicked(e, channel) {
    //this._changeSetCurrentMenuItem(e)
    try {
      await this.mpvPlayer.startChangeRadioChannel(channel.url)
    } catch (error) {
      this._notify_send(_("Can't play  %s").format(channel.name) + ". " + _("Make sure that the URL is valid and you have a stable internet connection. Don't hestitate to open an Issue on Github if the problem persists."))
      global.logError(error)
      return
    }
  }

  _createMenu({ currentChannelName, orientation }) {

    if (!this.menu) {
      const menuManager = new PopupMenuManager(this);
      this.menu = new AppletPopupMenu(this, orientation);
      menuManager.addMenu(this.menu);
    }

    this.radioListSubMenu = this._createRadioSubMenu({ currentChannelName: currentChannelName })
    this.menu.addMenuItem(this.radioListSubMenu)

    // stop Item
    this.stopitem = new PopupMenuItem(_("Stop"));
    this.menu.addMenuItem(this.stopitem);
    if (!currentChannelName) this._changeSetCurrentMenuItem(this.stopitem)
    this.stopitem.connect('activate', () => { this._on_stop_item_clicked(); });
  }

  _createRadioSubMenu({ currentChannelName }) {
    const radioListSubMenu = new PopupSubMenuMenuItem(_("List of stations"))

    this.channel_list.forEach(channel => {
      if (channel.inc !== true) return

      const channelItem = new PlayPauseIconMenuItem(channel.name);
      if (channel.name === currentChannelName) this._changeSetCurrentMenuItem(channelItem)
      radioListSubMenu.menu.addMenuItem(channelItem);
      channelItem.connect('activate', (e) => { this._on_radio_channel_clicked(e, channel) });
    });

    return radioListSubMenu
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
      //global.logError(e)
    }
  }


  _getChannelMenuItem(channelUrl) {

    const menuItems = this.radioListSubMenu.menu._getMenuItems()
    const channel = this.channel_list.find(channel => channel.url === channelUrl)

    // For some reason this method is sometimes called when a url is change in another play than mpv... TODO: proper fix
    if (!channel) return

    const channelName = channel.name
    const menuItem = menuItems.find(menuItem => menuItem.label.text === channelName)

    return menuItem
  }

  _on_stop_item_clicked() {
    this.mpvPlayer.stopRadio()
  }

  _setIconToMenuItem({ menuItem }) {

    if (this.currentMenuItem) {
      this.currentMenuItem.setShowDot(false)
      if (this.currentMenuItem !== this.stopitem) {
        this.currentMenuItem.changePlayPauseOffStatus("OFF")
      }
    }

    if (menuItem === this.stopitem) {
      menuItem.setShowDot(true);
    } else {
      menuItem.changePlayPauseOffStatus(this.mpvPlayer.getPlayPauseStatus())
    }
  }

  set_applet_tooltip(stop, volume) {
    const text = (stop) ? "Radio++" : _("Volume: ") + volume.toString() + "%"
    super.set_applet_tooltip(text)
  }

  _changeSetCurrentMenuItem(activatedMenuItem) {

    const nameCurrentMenuItem = activatedMenuItem.label.text

    this._setIconToMenuItem({ menuItem: activatedMenuItem })

    if (nameCurrentMenuItem === "Stop") this.set_applet_tooltip(true)

    this.set_applet_label(nameCurrentMenuItem)
    this._setIconColor();

    this.currentMenuItem = activatedMenuItem;

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
      this.radioListSubMenu.menu.open(true);
    }
  }

  on_applet_removed_from_panel() {
    this.mpvPlayer.stopRadio()
    this.settings.finalize();
  }

  _on_mouse_scroll(event) {
    const direction = event.get_scroll_direction();
    const volumeChange = direction === ScrollDirection.UP ? 5 : -5
    const volumeChanged = this.mpvPlayer.increaseDecreaseVolume(volumeChange)

    if (!volumeChanged && volumeChange > 0) this._notify_send(_("Can't increase Volume. Volume already at maximum."))
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamonRadioApplet(orientation, panel_height, instance_id);
}