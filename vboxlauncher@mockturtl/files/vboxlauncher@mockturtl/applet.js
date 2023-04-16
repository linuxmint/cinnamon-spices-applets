const Applet = imports.ui.applet
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk
const Gettext = imports.gettext;
const Lang = imports.lang
const PopupMenu = imports.ui.popupMenu
const Settings = imports.ui.settings
const Util = imports.misc.util

const UUID = "vboxlauncher@mockturtl"
const ICON = "virtualbox"

const CMD_VBOX = "virtualbox"
const CMD_VBOXMANAGE = "vboxmanage"

const CMD_VBOX_VM = CMD_VBOXMANAGE + " startvm "
const CMD_VBOX_LIST = CMD_VBOXMANAGE + " list vms"
const CMD_VBOX_LIST_RUN = CMD_VBOXMANAGE + " list runningvms"
const CMD_VBOX_VERSION = CMD_VBOXMANAGE + " -v"
var VBOX_ISRUNNING = "0"

const CMD_VMPLAYER = "vmplayer"
const VMWARE_DIR = GLib.get_home_dir() + "/vmware"
const CMD_VMPLAYER_LIST = "find " + VMWARE_DIR + " -iname *.vmx"

var PROGRAMS = [ CMD_VBOX, CMD_VMPLAYER ]
var INSTALLED_PROGRAMS = {} // key: CMD, value: `which CMD` == 0

const SIGNAL_ACTIVATE = "activate"

const KEY_UPDATE = "autoUpdate"
const AUTOUPDATE = "_" + KEY_UPDATE
const KEY_SHOWHEADLESS = "showHeadlessMode"
const SHOWHEADLESS = "_" + KEY_SHOWHEADLESS

// l10n/translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const to_string = function(data) {
  return ""+stringFromUTF8Array(data);
}

const stringFromUTF8Array = function(data) {
  const extraByteMap = [ 1, 1, 1, 1, 2, 2, 3, 0 ];
  var count = data.length;
  var str = "";
  for (var index = 0;index < count;)
  {
    var ch = data[index++];
    if (ch & 0x80)
    {
      var extra = extraByteMap[(ch >> 3) & 0x07];
      if (!(ch & 0x40) || !extra || ((index + extra) > count))
        return null;
      ch = ch & (0x3F >> extra);
      for (;extra > 0;extra -= 1)
      {
        var chx = data[index++];
        if ((chx & 0xC0) != 0x80)
          return null;
        ch = (ch << 6) | (chx & 0x3F);
      }
    }
    str += String.fromCharCode(ch);
  }
  return str;
}


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

      this.settings.bindProperty(Settings.BindingDirection.IN, KEY_SHOWHEADLESS, SHOWHEADLESS,
                                 this.onSwitchShowHeadless, null)

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
      INSTALLED_PROGRAMS[p] = GLib.find_program_in_path(""+p) != null;
    }
  }

// check if a command is available, using a bool hash created during init
, isInstalled: function(cmd) {
    return INSTALLED_PROGRAMS[cmd]
  }

, addLauncher: function(label, callback, callbackHeadless) {
    let i;
    if (callbackHeadless) {
      i = new PopupMenu.PopupSubMenuMenuItem(label)
      i.menu.addAction(_("Display"), callback)
      i.menu.addAction(_("Headless"), callbackHeadless)
    } else {
      i = new PopupMenu.PopupMenuItem(label)
      i.connect(SIGNAL_ACTIVATE, Lang.bind(this, callback))
    }

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
      this.addErrorMessage(_("ERROR. No compatible virtual machine programs found."))
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

    var machines = []
    var machinesrun = []

    Util.spawnCommandLineAsyncIO(CMD_VBOX_LIST, Lang.bind(this, (list, err, status) => {
      if (list.length != 0) {
        machines = list.split("\n")
        //global.log("machines: "+ list)
        Util.spawnCommandLineAsyncIO(CMD_VBOX_LIST_RUN, Lang.bind(this, (listrun, errrun, statusrun) => {
          //if (listrun.length != 0) {
            machinesrun = listrun.split("\n")
            //global.log("machinesrun: "+ listrun)
            if (machines.length != 0) {
              for (let i = 0; i < machines.length; i++) {
                let machine = machines[i]
                if (machine.length === 0) continue
                for (let j = 0; j < machinesrun.length; j++) {
                  let machinerun = machinesrun[j]
                  if (machinerun.length === 0) continue
                  if (machine == machinerun) {
                      VBOX_ISRUNNING = "1";
                  }
                }
                this.addVboxImage(machine);
                VBOX_ISRUNNING = "0"
              }
            }
          //}
        }))
      }
    }))
  }

, addVboxImage: function(instance) {
    let info = instance.split('" {')
    let name = info[0].replace('"', '')
    if (VBOX_ISRUNNING == "1") {
      //diffrent indicators
      //25C9,25C6,E226,2B22,2B24
      name = (name+"   \uE226");
    }
    let id = info[1].replace('}', '')
    if (this[SHOWHEADLESS]) {
      this.addLauncher(name,
        Lang.bind(this, function() { this.startVboxImage(id) }),
        Lang.bind(this, function() { this.startVboxImageHeadless(id) })
      )
    } else {
      this.addLauncher(name,
        Lang.bind(this, function() { this.startVboxImage(id) }),
        null
      )
    }
  }

// add menu items for all VMWare Player images
, parseVmplayerImages: function(out) {
    if (!this.isInstalled(CMD_VMPLAYER))
      return

    this.addSeparator()

    Util.spawnCommandLineAsyncIO(CMD_VMPLAYER_LIST, Lang.bind(this, (list, err, status) => {
      if (list.length != 0) {
        let paths = to_string(list).split("\n")
        paths = paths.slice(0, paths.length - 1) // chomp final \n
        //global.log("\t" + paths.length + " paths: " + paths)
        for (let i = 0; i < paths.length; i++) {
          let path = paths[i]
          if (path == "") continue
          this.addVmplayerImage(path)
        }
      }
    }))
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
      this.addLauncher(_("Update list"), Lang.bind(this, this.updateMenu))
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
    //~ let cmd = this.vboxMajorVersion() >= 6 ? CMD_VBOX6_VM : CMD_VBOX_VM
    //~ Util.spawnCommandLine(cmd + id)
    Util.spawnCommandLineAsync(CMD_VBOX_VM + id)
  }

,  startVboxImageHeadless: function(id) {
    //~ let cmd = this.vboxMajorVersion() >= 6 ? CMD_VBOX6_VM : CMD_VBOX_VM
    //~ Util.spawnCommandLine(cmd + id + " --type headless")
    Util.spawnCommandLineAsync(CMD_VBOX_VM + id + " --type headless")
  }

,  startVbox: function() {
    Util.spawnCommandLineAsync(CMD_VBOX)
  }

,  startVmplayer: function() {
    Util.spawnCommandLineAsync(CMD_VMPLAYER)
  }

,  startVmplayerImage: function(path) {
    Util.spawnCommandLineAsync(CMD_VMPLAYER + " '" + path + "' ")
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
,  onSwitchShowHeadless: function() {
    this.updateMenu() // Whether or not to show headless modes
  }

}

function main(metadata, orientation, panelHeight, instanceId) {
  return new MyApplet(metadata, orientation, panelHeight, instanceId)
}
