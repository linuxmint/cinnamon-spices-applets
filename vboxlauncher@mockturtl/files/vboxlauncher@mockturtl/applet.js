const Applet = imports.ui.applet
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk
const Lang = imports.lang
const PopupMenu = imports.ui.popupMenu
const Settings = imports.ui.settings
const Util = imports.misc.util

const UUID = "vboxlauncher@mockturtl"
const ICON = "virtualbox"

const CMD_VBOX = "virtualbox"
const CMD_VBOX_VM = CMD_VBOX + " --startvm "
const CMD_VBOX_LIST = "vboxmanage list vms"

const CMD_VMPLAYER = "vmplayer"
const VMWARE_DIR = GLib.get_home_dir() + "/vmware"
const CMD_VMPLAYER_LIST = "find " + VMWARE_DIR + " -iname *.vmx"

var PROGRAMS = [ CMD_VBOX, CMD_VMPLAYER ]
var INSTALLED_PROGRAMS = {} // key: CMD, value: `which CMD` == 0

const SIGNAL_ACTIVATE = "activate"

const KEY_UPDATE = "autoUpdate"
const AUTOUPDATE = "_" + KEY_UPDATE

function MyApplet(metadata, orientation, panelHeight, instanceId) {
  this.settings = new Settings.AppletSettings(this, UUID, instanceId)
  this._init(orientation, panelHeight, instanceId)
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype

,  _init: function(orientation, panelHeight, instanceId) {
    Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId)

    try {
      this.set_applet_icon_name(ICON)
      
      this.menuManager = new PopupMenu.PopupMenuManager(this)
      this.menu = new Applet.AppletPopupMenu(this, orientation)
      this.menuManager.addMenu(this.menu)

      this.settings.bindProperty(Settings.BindingDirection.IN, KEY_UPDATE, AUTOUPDATE,
                                 this.onSwitchAutoUpdate, null)

      this.settingsApiCheck()
      this.checkPrograms()
      this.updateMenu()
    }
    catch (e) {
      global.logError(UUID + "::_init: " + e)
    }
  }
  
  // configuration via context menu is automatically provided in Cinnamon 2.0+
, settingsApiCheck: function() {
    const Config = imports.misc.config
    const SETTINGS_API_MIN_VERSION = 2
    const CMD_SETTINGS = "cinnamon-settings applets " + UUID


    let cinnamonVersion = Config.PACKAGE_VERSION.split('.')
    let majorVersion = parseInt(cinnamonVersion[0])
    //global.log("cinnamonVersion=" + cinnamonVersion +  "; majorVersion=" + majorVersion)

    if (majorVersion >= SETTINGS_API_MIN_VERSION)
      return

    // for Cinnamon 1.x, build a menu item
    let mi = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, function() {
      Util.spawnCommandLine(CMD_SETTINGS)
    }))
    this._applet_context_menu.addMenuItem(mi)
  }

// determine which VM programs are installed
, checkPrograms: function() {
    for (let i = 0; i < PROGRAMS.length; i++) {
      let p = PROGRAMS[i] 
      INSTALLED_PROGRAMS[p] = false
      try {
        let [res, list, err, status] = GLib.spawn_command_line_sync("which " + p)
        //global.log(UUID + "::checkPrograms: " + [res, list, err, status])
        if (parseInt(status) == 0)
          INSTALLED_PROGRAMS[p] = true
        //global.log(UUID + "::checkPrograms: system has `" + p + "`? " + INSTALLED_PROGRAMS[p])
      } catch(e) {
        global.logError(UUID + "::checkPrograms: " + e)
      }
    }
  }

// check if a command is available, using a bool hash created during init
, isInstalled: function(cmd) {
    return INSTALLED_PROGRAMS[cmd]
  }

, addLauncher: function(label, callback) {
    let i = new PopupMenu.PopupMenuItem(label)
    i.connect(SIGNAL_ACTIVATE, Lang.bind(this, callback))
    this.menu.addMenuItem(i)
  }

, addSeparator: function() {
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
  }

, addLaunchers: function() {
    let launchers = 0
    launchers += this.launcherFor("Virtualbox", CMD_VBOX, this.startVbox)
    launchers += this.launcherFor("VMware Player", CMD_VMPLAYER, this.startVmplayer)

    this.addSeparator()

    if (launchers == 0)
      this.addErrorMessage("ERROR. No compatible virtual machine programs found.")
  }

, launcherFor: function(title, cmd, callback) {
    if (!this.isInstalled(cmd))
      return 0

    this.addLauncher(title, callback)
    return 1
  }

// add menu items for all Virtualbox images
, parseVboxImages: function(out) {
    if (!this.isInstalled(CMD_VBOX))
      return

    let [res, list, err, status] = GLib.spawn_command_line_sync(CMD_VBOX_LIST)
    if (list.length != 0) {
      let machines = list.toString().split("\n")
      for (let i = 0; i < machines.length; i++) {
        let machine = machines[i]
        if (machine == "") continue
        this.addVboxImage(machine)
      }
    }
  }

, addVboxImage: function(instance) {
    let info = instance.split('" {')
    let name = info[0].replace('"', '')
    let id = info[1].replace('}', '')
    this.addLauncher(name, Lang.bind(this, function() { this.startVboxImage(id) }))
  }

// add menu items for all VMWare Player images
, parseVmplayerImages: function(out) {
    if (!this.isInstalled(CMD_VMPLAYER))
      return

    this.addSeparator()

    let [res, list, err, status] = GLib.spawn_command_line_sync(CMD_VMPLAYER_LIST)
    //global.log(UUID + "#parseVmplayerImages: list=" + list)
    if (list.length != 0) {
      let paths = list.toString().split("\n")
      paths = paths.slice(0, paths.length - 1) // chomp final \n
      //global.log("\t" + paths.length + " paths: " + paths)
      for (let i = 0; i < paths.length; i++) {
        let path = paths[i]
        if (path == "") continue
        this.addVmplayerImage(path)
      }
    }
  }

, addVmplayerImage: function(path) {
    let imageFile = path.split("/")
    imageFile = imageFile[imageFile.length - 1]
    //global.log(UUID + "#addVmplayerImage: imageFile=" + imageFile)
    let name = imageFile.split(".vmx")[0]
    this.addLauncher(name, Lang.bind(this, function() { this.startVmplayerImage(path) }))
  }

, addErrorMessage: function(msg) {
    this.menu.addMenuItem(new PopupMenu.PopupMenuItem(msg, { reactive: false }))
  }

, addUpdater: function() {
    if (!this[AUTOUPDATE]) {
      this.addSeparator()
      this.addLauncher("Update list", Lang.bind(this, this.updateMenu))
    }
  }

,  updateMenu: function() {
    this.menu.removeAll()
    try {
      this.addLaunchers()
      this.parseVboxImages()
      this.parseVmplayerImages()
    } catch(e) {
      global.logError(UUID + "::updateMenu: " + e)
    }
    this.addUpdater()
  }
  
,  startVboxImage: function(id) {
    Util.spawnCommandLine(CMD_VBOX_VM + id)
  }
  
,  startVbox: function() {
    Util.spawnCommandLine(CMD_VBOX)
  }

,  startVmplayer: function() {
    Util.spawnCommandLine(CMD_VMPLAYER)
  }

,  startVmplayerImage: function(path) {
    Util.spawnCommandLine(CMD_VMPLAYER + " " + path)
  }

,  on_applet_clicked: function(event) {
    if (this[AUTOUPDATE] && !this.menu.isOpen) {
      this.updateMenu()
    }
    this.menu.toggle()
  }
  
,  onSwitchAutoUpdate: function() {
    if (!this[AUTOUPDATE]) {
      this.updateMenu() // Needed to make update button reappear if setting switched to off
    }
  }
  
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new MyApplet(metadata, orientation, panelHeight, instanceId)
}
