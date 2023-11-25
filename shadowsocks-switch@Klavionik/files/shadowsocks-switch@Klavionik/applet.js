const Applet = imports.ui.applet
const Util = imports.misc.util
const PopupMenu = imports.ui.popupMenu
const Main = imports.ui.main
const Settings = imports.ui.settings
const GLib = imports.gi.GLib
const Gettext = imports.gettext

const UUID = "shadowsocks-switch@Klavionik"

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(string) {
  return Gettext.dgettext(UUID, string)
}

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
}

function fileURItoPath(uri) {
  return uri.slice(7) // Remove file:// scheme.
}

function notify(msg) {
  const title = _("Shadowsocks Switch")
  Main.notify(title, msg)
}

class ShadowsocksAppletMenu extends Applet.AppletPopupMenu {
  constructor(launcher, orientation) {
    super(launcher, orientation)
    this.toggleRef = this._makeToggle()
    this.addMenuItem(this.toggleRef)
  }

  _makeToggle() {
    const toggle = new PopupMenu.PopupSwitchMenuItem(_("Enable Shadowsocks"), false)
    toggle.connect("toggled", () => (this.emit("toggle-proxy")))
    return toggle
  }
}

class ShadowsocksAppletError extends Error {}

class ShadowsocksApplet extends Applet.IconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id)
    this._metadata = metadata
    this._ssConfigFileURI = ""
    this._host = "localhost"
    this._port = -1
    this._savedMode = ""
    this._savedHost = ""
    this._savedPort = -1
    this._clientPid = -1
    this._connected = false
    this._settingsProvider = undefined

    this._configureApplet()
    this.menu = this._createMenu(orientation)
  }

  _configureApplet() {
    this.set_applet_icon_path(this._metadata.path + "/icon.png")
    this.set_applet_tooltip(_("Toggle Shadowsocks proxy"))

    this._settingsProvider = new Settings.AppletSettings(this, this._metadata.uuid)
    this._settingsProvider.bindProperty(
      Settings.BindingDirection.IN,
      "config",
      "_ssConfigFileURI",
      () => {}
    )
  }

  _configureConnection() {
    const {port} = this._loadConfig()
    this._port = port
  }

  _createMenu(orientation) {
    const menuManager = new PopupMenu.PopupMenuManager(this)
    const menu = new ShadowsocksAppletMenu(this, orientation)

    menu.connect("toggle-proxy", this._onToggleProxy.bind(this))
    menuManager.addMenu(menu)
    return menu
  }

  _onToggleProxy() {
    this._connected ? this._disconnect() : this._connect()
  }

  _loadConfig() {
    let content

    try {
      const [_, buffer] = GLib.file_get_contents(fileURItoPath(this._ssConfigFileURI))
      content = buffer
    } catch (e) {
      const msg = _(`Cannot read Shadowsocks config.`)
      notify(`${msg} ${String(e)}`)
      throw new ShadowsocksAppletError(msg)
    }

    const config = JSON.parse(content)

    if (!config.hasOwnProperty("local_port")) {
      const msg = _("Shadowsocks config is missing local port.")
      notify(msg)
      throw new ShadowsocksAppletError(msg)
    }

    return {port: config.local_port}
  }

  _connect() {
    try {
      this._configureConnection()
      this._saveProxySettings()
      this._clientPid = this._runClient()
      this._setupProxy()
    } catch (e) {
      this.menu.toggleRef.setToggleState(false)
      this._restoreProxySettings()

      if (this._clientPid !== -1) {
        this._stopClient()
      }

      logError(String(e))
      throw e
    }

    this._connected = true
    this.set_applet_icon_path(this._metadata.path + "/icon-connected.png")
    notify(_("Connection established."))
  }

  _runClient() {
    const cmd = `ss-local -c ${fileURItoPath(this._ssConfigFileURI)}`
    return Util.trySpawnCommandLine(cmd)
  }

  _stopClient() {
    const cmd = `kill -s SIGINT ${this._clientPid}`
    Util.spawnCommandLine(cmd)
    this._clientPid = -1
  }

  _saveProxySettings() {
    Util.spawnCommandLineAsyncIO("gsettings get org.gnome.system.proxy mode", (stdout) => {
      this._savedMode = stdout
    })

    Util.spawnCommandLineAsyncIO("gsettings get org.gnome.system.proxy.socks host", (stdout) => {
      this._savedHost = stdout
    })

    Util.spawnCommandLineAsyncIO("gsettings get org.gnome.system.proxy.socks port", (stdout) => {
      this._savedPort = stdout
    })
  }

  _restoreProxySettings() {
    const restoreMode = `gsettings set org.gnome.system.proxy mode ${this._savedMode}`
    const restoreHost = `gsettings set org.gnome.system.proxy.socks host ${this._savedHost}`
    const restorePort = `gsettings set org.gnome.system.proxy.socks port ${this._savedPort}`

    const cmd = `sh -c "${restoreMode} ${restoreHost} ${restorePort}"`
    Util.trySpawnCommandLine(cmd)
  }

  _setupProxy() {
    const setMode = "gsettings set org.gnome.system.proxy mode 'manual'"
    const setHost = `gsettings set org.gnome.system.proxy.socks host ${this._host}`
    const setPort = `gsettings set org.gnome.system.proxy.socks port ${this._port}`

    const cmd = `sh -c "${setMode}; ${setHost}; ${setPort}"`
    Util.trySpawnCommandLine(cmd)
  }

  _disconnect() {
    this._restoreProxySettings()
    this._stopClient()

    this._connected = false
    notify(_("Disconnected."))
    this.set_applet_icon_path(this._metadata.path + "/icon.png")
  }

  on_applet_clicked() {
    this.menu.toggle()
  }

  on_applet_removed_from_panel(deleteConfig) {
    if (this._connected) {
      this._disconnect()
    }
  }
}


function main(metadata, orientation, panel_height, instance_id) {
  return new ShadowsocksApplet(metadata, orientation, panel_height, instance_id)
}
