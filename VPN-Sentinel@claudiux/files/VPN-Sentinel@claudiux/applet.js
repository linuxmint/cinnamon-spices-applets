/**
 * VPN Sentinel
 * Author: claudiux (Github id: @claudiux)
 * VPN Sentinel
 *   - watches over the VPN link,
 *   - displays the VPN link status,
 *   - allows to connect at start-up to the last VPN used,
 *   - allows to reconnect the VPN link if it incidentally drops,
 *   - can launch or quit Internet apps according to the state of the VPN.
 */


/** Imports
 */
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Extension = imports.ui.extension;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
//const {SignalManager} = imports.misc.signalManager;
const Util = imports.misc.util;
const CMenu = imports.gi.CMenu;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Lang = imports.lang;

const {to_string} = require("./lib/to-string");

/** Constants
 */
const {
  NAME,
  UUID,
  HOME_DIR,
  APPLET_DIR,
  SCRIPTS_DIR,
  ICONS_DIR,
  IFACES_DIR,
  SOUNDS_DIR,
  SETTINGS_SCHEMA,
  DEFAULT_SYMBOLIC_ICON,
  _,
  DEBUG,
  RELOAD,
  exists,
  log,
  logError
} = require("./lib/constants");

const TITLE = _("VPN Sentinel");

const DEFAULT_APPLET_LABEL = "     "; // 5 blank characters

const OLD_DOMAINS_FILE = "%s/.cinnamon/configs/%s/domains2bypass.txt".format(HOME_DIR, UUID);

const DOMAINS_DIR = "%s/.config/%s".format(HOME_DIR, NAME);
if (!exists(DOMAINS_DIR)) GLib.spawn_command_line_async("bash -c 'mkdir -p "+DOMAINS_DIR+"'");
const DOMAINS_FILE = DOMAINS_DIR + "/domains2bypass.txt";
if (exists(OLD_DOMAINS_FILE) && exists(DOMAINS_DIR)) GLib.spawn_command_line_async("bash -c 'mv -u "+OLD_DOMAINS_FILE+ " " + DOMAINS_FILE +"'");

const {
  IpGateway
} = require("./lib/ipgateway");

/** dummy variable for translations
 */
let dummy = _("Timestamp");
dummy = _("Date and Time");
dummy = _("Message");

/**
 * Activity logging
 */
const ActivityLogging = require("./lib/activityLogging");

/**
 * Dependencies checking
 */
const CheckDependencies = require("./lib/checkDependencies");
let Dependencies = CheckDependencies.Dependencies;

const FilesCsv = require("./lib/filesCsv");

/**
 * killall:
 * @processName: a process name
 *
 * Kills @processName. If no process with the given name is found,
 * this will fail silently.
 */
function killall(processName) {
  log("killall "+processName);
  let ret = true;
  try {
    // pkill is more portable than killall, but on Linux at least
    // it won't match if you pass more than 15 characters of the
    // process name... However, if you use the '-f' flag to match
    // the entire command line, it will work, but we have to be
    // careful in that case that we can match
    // '/usr/bin/processName' but not 'gedit processName.c' or
    // whatever...

    //~ let argv = ['pkill', '-f', '^([^ ]*/)?' + processName + '($| )'];
    let argv = ["%s/kill_all_pids_of.sh".format(SCRIPTS_DIR), processName];
    ret = GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
    // It might be useful to return success/failure, but we'd need
    // a wrapper around WIFEXITED and WEXITSTATUS. Since none of
    // the current callers care, we don't bother.
  } catch (e) {
    //~ logError(e, 'Failed to kill ' + processName);
    ret = false
  }
  return ret
}

/**
 * class VPNSentinel
 */
class VPNSentinel extends Applet.TextIconApplet {
  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);
    this.orientation = orientation;
    this.instanceId = instance_id;
    this.versionNumber = metadata.version;

    // Both types of panel: horizontal and vertical.
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    Util.spawnCommandLineAsync("bash -c 'cd "+ SCRIPTS_DIR + " && chmod 755 *.sh *.py *.js'");
    Util.spawnCommandLineAsync("bash -c 'cd "+ APPLET_DIR + "/po && chmod 755 makepot'");

    // Menu
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);

    // Check dependencies
    this.dependencies = new Dependencies();
    this.interval = 0;
    if (!this.dependencies.are_dependencies_installed()) {
      this.applet_running = false;
      this.interval = setInterval(() => this.dependencies.check_dependencies(), 10000);
    } else {
      this.applet_running = true;
    }

    let FlagsCsv = new FilesCsv.FlagsFileCsv();
    this.flags = FlagsCsv.get_json();
    log(JSON.stringify(this.flags, null, "\t"));

    this.set_applet_label(DEFAULT_APPLET_LABEL);

    // Add path to flag icons
    this.icon_theme = Gtk.IconTheme.get_default();
    this.icon_theme.append_search_path(ICONS_DIR);
    // Tooltip:
    this.set_applet_tooltip(TITLE);
    // Default Icon:
    this.set_applet_icon_symbolic_name(DEFAULT_SYMBOLIC_ICON);
    // Style:
    this.actor.set_style_class_name("vpn-transient");
    // Settings:
    this.vpnStatus = "transient";
    this.vpnOldStatus = null;

    this.vpnName = "";
    this.vpnOldName = null;

    this.vpnDevice = "";
    this.vpnOldDevice = null;

    this.vpnType = "";
    this.vpnOldType = "";

    this.vpnUUID = "";
    this.vpnOldUUID = "";

    this.vpnAutoconnect = "";
    this.vpnOldAutoconnect = "";

    this.vpnTimestamp = 0;
    this.vpnOldTimestamp = 0;

    this.other_active_VPN = [];

    //this.disconnectedByUser = false;
    this.useFlags = true;
    this.get_user_settings(); // get settings defined in settings-schema.json
    this.timeout = 0;
    this.allInterfaces = [];
    this.vpnDevices = [];
    this.monitors = [];
    this.netMonitor = null;
    this.netMonitorId = 0;
    this.sysclassnetMonitor = null;
    this.sysclassnetMonitorId = 0;

    let settingsSchema = JSON.parse(to_string(GLib.file_get_contents(SETTINGS_SCHEMA)[1]));
    this.tabNumberOfVPNPolicy = 1*settingsSchema["layout"]["pages"].indexOf("VPNpolicy");
    this.tabNumberOfInternetPolicy = 1*settingsSchema["layout"]["pages"].indexOf("InternetPolicy");
    this.tabFlags = 1*settingsSchema["layout"]["pages"].indexOf("CountryFlags");

    // Keybinding:
    Main.keybindingManager.addHotKey(UUID, this.keybinding, () => this.on_shortcut_used());

    // System Apps:
    this.appSystem = Cinnamon.AppSystem.get_default();
    this.get_internet_apps();
    // Window Tracker:
    this.tracker = Cinnamon.WindowTracker.get_default();

    // Logging activity:
    this.activityLog = new ActivityLogging.ActivityLogging(metadata, this.logLifetime, this.doLogActivity);
    this.activityLog.truncate_log_file();
    this.next_truncation = 86400;

    // Network:
    IpGateway.init();
    this.monitor_interfaces();
    this.on_network_changed();
    //if (!this.disconnectedByUser || this.connectAtStartup)
    if (this.connectAtStartup)
      this.try_to_reconnect_to_latest_vpn();

    this.activityLog.log(_("VPN-Sentinel has just started."));
    if (this.vpnStatus === "on") {
      let message = "";
      if (this.vpnType === "vpn") {
        message = _("Connected to VPN: %s").format(this.vpnName)
      } else if (this.vpnType === "wireguard") {
        message=_("Connected to WIREGUARD: %s").format(this.vpnName)
      } else {
        message = _("Connected to: %s").format(this.vpnName)
      }
      this.activityLog.log(message)
    }

    settingsSchema = null;

    // Loop:
    this.knownPids = [];
    this.loopId = 0;
    this.monitor_vpn_only_apps(); // Run the loop
  } // End of constructor

  /** Settings
   */
  get_user_settings() {
    this.s = new AppletSettings(this, UUID, this.instanceId);
    //// Notifications tab
    //             Key (settings-schema.json) Property (this.)            Callback                    Callback data
    // Sound Alert section
    this.s.bind(  "useSoundAlert",            "useSoundAlert",            this.on_settings_changed,   null);
    this.s.bind(  "useSoundAlertAtBeginning", "useSoundAlertAtBeginning", this.on_settings_changed,   null);
    this.alertIssued = !this.useSoundAlertAtBeginning; // Flag saying alert has been tripped to avoid repeat notifications

    // Flags section
    this.s.bind(  "showCountryFlag",          "useFlags",                 this.update_icon,   null);
    this.s.bind(  "labelWhenVPNisOff",        "labelWhenVPNisOff",        this.update_icon,   null);
    this.s.bind(  "sortFlagListBy",           "sortFlagListBy",           (...args) => this.sort_flaglist(...args), null);

    //// VPN tab
    // VPN section
    //this.s.bind(  "vpnDevice",             "vpnDevice",             this.on_settings_changed,   null);
    //this.s.bind(  "vpnName",                  "vpnName",                  this.on_settings_changed,   null);
    this.s.bind(  "connectAtStartup",         "connectAtStartup",         this.on_settings_changed,   null);
    this.s.bind(  "disconnectedByUser",      "disconnectedByUser",      null,                       null);
    //this.s.bind(  "deactivateAtStartup",      "deactivateAtStartup",      null,                       null);
    //if (this.connectAtStartup === true) this.deactivateAtStartup = false;
    this.s.bind(  "reconnect",                "reconnect",                this.on_settings_changed,   null);
    this.s.bind(  "respectUserRequest",       "respectUserRequest",       this.on_settings_changed,   null);
    this.s.bind(  "bypassList",               "bypassList",               (...args) => this.on_bypass_list_changed(...args),   null);

    // Activity Logs section
    this.s.bind(  "doLogActivity",            "doLogActivity",            this.on_settings_changed,   null);
    this.s.bind(  "logLifetime",              "logLifetime",              this.on_settings_changed,   null);

    //// Keybinding tab
    this.s.bind(  "keybinding",               "keybinding",               this.on_shortcut_changed,   null);


    //// Internet Apps tab
    this.s.bind(  "manageClients",            "manageClients",            this.on_manage_clients_changed,   null);
    this.s.bind(  "clientsList",              "clientsList",              this.on_clients_list_changed,   null);

    //// Generic
    //this.s.bind(  "reactivationRequested",    "reactivationRequested",    null,                       null);
    this.s.bind(  "lastVpnInterfaceUsed",     "lastVpnInterfaceUsed",     null,                       null);
    this.s.bind(  "lastVpnNameUsed",          "lastVpnNameUsed",          null,                       null);
    this.s.bind(  "vpnNames",                 "vpnNames",                 this.make_menu,                       null);
  } // End of get_user_settings

  on_settings_changed() {
    this.activityLog.set_active(this.doLogActivity);
    if (this.doLogActivity === true) {
      this.activityLog.set_lifetime(this.logLifetime);
      this.activityLog.truncate_log_file();
      this.next_truncation = 86400; // 86400 seconds = 1 day
    }

    //if (this.connectAtStartup === true) this.deactivateAtStartup = false;
    if (!this.useSoundAlert) this.useSoundAlertAtBeginning = false;
    this.alertIssued = !this.useSoundAlertAtBeginning;

    //if (this.manageClients) this.monitor_vpn_only_apps();
  } // End of on_settings_changed

  on_manage_clients_changed() {
    if (this.s.getValue("manageClients") === true)
      this.on_clients_list_changed();
  } // End of on_manage_clients_changed

  on_clients_list_changed() {
    if (this.loopId === 0)
      this.monitor_vpn_only_apps();
  } // End of on_clients_list_changed

  on_bypass_list_changed() {
    //~ log("on_bypass_list_changed()", true);
    if (this.bypassTreatment !== undefined) {
      return
    }

    this.bypassTreatment = true;
    var domains_to_bypass = [];
    for (let b of this.bypassList) {
      //~ log("Element of bypassList: "+b.domain, true);
      domains_to_bypass.push(""+b.domain);
    }

    GLib.file_set_contents(DOMAINS_FILE, domains_to_bypass.join(" "));

    let Id = Util.setTimeout( Lang.bind(this, () => {
      this.bypassTreatment = undefined
    }), 5000); // 5 seconds
  } // End of on_bypass_list_changed

  /** Internet Apps
   */

  get_internet_apps() {
    const apps_sort = arr => arr.sort(
      (a, b) => a.name.localeCompare(
        b.name, undefined,
        {sensitivity: "base", ignorePunctuation: true}
      )
    );
    const dirs = [];
    const iter = this.appSystem.get_tree().get_root_directory().iter();

    let nextType;
    while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
      if (nextType === CMenu.TreeItemType.DIRECTORY) {
        dirs.push(iter.get_directory());
      }
    }

    dirs.forEach(dir => {
      if (!dir.get_is_nodisplay()) {
        const dirId = dir.get_menu_id();
        //log("dirId: "+dirId, true);
        if (dirId === "Internet") {
          this.internetApps = [];

          //this.appsByCategory[dirId] = [];
          this._loadAppCategories(dir, null, dirId);
          apps_sort(this.internetApps);

          //~ log("this.internetApps.length: "+this.internetApps.length, true);
        }
      }
    });
  } // End of get_internet_apps

  _loadAppCategories(dir, rootDir, dirId) {
    const iter = dir.iter();
    let nextType;
    while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
      if (nextType === CMenu.TreeItemType.ENTRY) {
        const entry = iter.get_entry();
        const appInfo = entry.get_app_info();
        if (appInfo && !appInfo.get_nodisplay()) {
          const id = entry.get_desktop_file_id();
          const app = this.appSystem.lookup_app(id);
          let found = false;
          if (rootDir && typeof rootDir.get_menu_id === 'function') {
            const rootDirId = rootDir.get_menu_id();
            if (rootDirId) {
                this.internetApps.push(app);
                found = true;
            }
          } else {
            if (dirId) {
                this.internetApps.push(app);
                found = true;
            }
          }
          if (found) {
            app.name = app.get_name();
            app.description = app.get_description();
            app.isApplication = true;
            app.id = app.get_id();
          }
          //~ if (this.knownApps.indexOf(id) < 0) {//unknown app
            //~ if (!this.newInstance) {
              //~ app.newAppShouldHighlight = true;
            //~ }
            //~ this.knownApps.push(id);
          //~ }
        }
      } else if (nextType === CMenu.TreeItemType.DIRECTORY) {
        if (rootDir) {
          this._loadAppCategories(iter.get_directory(), rootDir, null);
        } else {
          this._loadAppCategories(iter.get_directory(), dir, dirId);
        }
      }
    }
  }

  on_button_populate_clicked() {
    var clientsList = this.s.getValue("clientsList");
    var names = [];
    for (let client of clientsList) {
      names.push(client.name)
    }
    this.get_internet_apps();
    for (let app of this.internetApps) {
      let appName = app.get_name();
      if (names.indexOf(appName) === -1) {
        clientsList.push({"name": ""+appName})
      }
      //log("app name: "+appName, true);
      //let appInfo = app.get_app_info();
      //let command = appInfo.get_commandline();
      //log("app command: "+command, true);
      //let pids = app.get_pids();
      //for (let p of pids)
        //log("pid: "+p, true);
      //if (appName=="Joal")
        //app.request_quit();
    }
    this.s.setValue("clientsList", clientsList);
    let id = Util.setTimeout( () => {
      clientsList = null;
      Util.clearTimeout(id)
    }, 300) // 300 ms
  }

  /** Colors
   */
  _get_rgb_and_rgba(settings_id, opacity) {
    // settings_id must be one of these values:
    //   'connectedColor', 'disconnectedColor', 'transitionColor'
    let rgba_color = new Gdk.RGBA();
    let rgb_color_string, rgba_color_string;
    let color = this.s.getValue(settings_id);
    let parseable = rgba_color.parse(color);

    if (parseable) {
      rgba_color.alpha = 1.0;
      rgb_color_string = ""+rgba_color.to_string();
      //~ log("rgb_color_string: "+rgb_color_string, true);
      rgba_color.alpha = opacity;
      rgba_color_string = ""+rgba_color.to_string();
      //~ log("rgba_color_string: "+rgba_color_string, true);
      return [rgb_color_string, rgba_color_string]
    } else {
      return [null, null]
    }
  } // End of _get_rgb_and_rgba

  on_apply_colors() {
    log("on_apply_colors()");
    let borderOpacity = this.s.getValue("borderOpacity");

    // connectedColor:
    let [CONNECTED_COLOR_RGB, CONNECTED_COLOR_RGBA] = this._get_rgb_and_rgba("connectedColor", borderOpacity);

    // disconnectedColor:
    let [DISCONNECTED_COLOR_RGB, DISCONNECTED_COLOR_RGBA] = this._get_rgb_and_rgba("disconnectedColor", borderOpacity);

    // transitionColor:
    let [TRANSITION_COLOR_RGB, TRANSITION_COLOR_RGBA] = this._get_rgb_and_rgba("transitionColor", borderOpacity);

    let template = ""+to_string(GLib.file_get_contents(APPLET_DIR+"/data/stylesheet.css.template")[1]);

    let css = template.replace(/TRANSITION_COLOR_RGBA/g, TRANSITION_COLOR_RGBA);
    css = css.replace(/TRANSITION_COLOR_RGB/g, TRANSITION_COLOR_RGB);
    css = css.replace(/DISCONNECTED_COLOR_RGBA/, DISCONNECTED_COLOR_RGBA);
    css = css.replace(/DISCONNECTED_COLOR_RGB/, DISCONNECTED_COLOR_RGB);
    css = css.replace(/CONNECTED_COLOR_RGBA/, CONNECTED_COLOR_RGBA);
    css = css.replace(/CONNECTED_COLOR_RGB/, CONNECTED_COLOR_RGB);

    if (GLib.file_set_contents(APPLET_DIR+"/stylesheet.css", css)) {
      //FIXME! Find another method than reloading to apply new stylesheet.
      this._on_reload_this_applet_pressed();

      //let file = Gio.file_new_for_path(APPLET_DIR+"/stylesheet.css");

      //try {
        //let ext = Extension.getExtension(UUID);
        //ext.loadStylesheet(file);
      //} catch(e) { logError("Load Stylesheet error! "+e) }

      //if (this.vpnStatus === "on") {
        //this.actor.set_style_class_name("vpn-on");
      //} else if (this.vpnStatus === "off") {
        //this.actor.set_style_class_name("vpn-off");
      //} else {
        //this.actor.set_style_class_name("vpn-transient");
      //}
    }

  } // End of on_apply_colors

  /** Network
   */
  monitor_interfaces() {
    if (this.netMonitor != null || !this.applet_running) return;
    log("monitor_interfaces()");
    try {
      this.netMonitor = Gio.network_monitor_get_default();
      this.netMonitorId = this.netMonitor.connect('network-changed',
                                                  (monitor, network_available) => this.on_network_changed());
      this.monitors.push([this.netMonitor, this.netMonitorId]);
      log("this.monitors.length: "+(this.monitors.length));
    } catch(e) {
      logError("Unable to monitor the network interfaces!", e)
    }
  } // End of monitor_interfaces

  disconnect_monitors() {
    while (this.monitors.length > 0) {
      let [mon, Id] = this.monitors.pop();
      mon.disconnect(Id)
    }
  } // End of disconnect_monitors

  async on_network_changed() {
    log("on_network_changed");
    if (!this.applet_running) return;
    // Check dependencies
    if (!this.dependencies.are_dependencies_installed()) {
      this.applet_running = false;
      this.actor.set_style_class_name("vpn-transient");
      this.disconnect_monitors();
      this.interval = setInterval(() => this.dependencies.check_dependencies(), 10000);
    }
    if (!this.applet_running) return;

    this.get_vpn_status().then( () => {

      this.update_icon();
      if (this.menu.isOpen)
        this.menu.toggle();

      if (!this.s.getValue("manageClients"))
        return;
      // In devhelp : CinnamonAppState :
      // Cinnamon.AppState.STOPPED:  0
      // Cinnamon.AppState.STARTING: 1
      // Cinnamon.AppState.RUNNING:  2
      this.get_internet_apps();
      let clientsList = this.s.getValue("clientsList");
      log("VPN status: "+this.vpnStatus);
      if (this.vpnStatus === "on") {
        if (this.loopId > 0) {
          Mainloop.source_remove(this.loopId);
          this.loopId = 0
        }
        for (let app of this.internetApps) {
          for (let client of clientsList) {
            if (""+app.name === ""+client.name && client.launch === true) {
              let app_state = app.get_state();
              //~ log("app: "+app.name+" ... "+app_state, true);
              if (app_state === Cinnamon.AppState.STOPPED) {
                //~ log("state: "+ app.get_state(), true);
                app.launch(5000, [], -1);
                //app.activate_full(-1, 1000);
                //app.activate();
                let id = Util.setTimeout( Lang.bind(this, function() {
                  //~ let kw = this.keyword_for_pkill(app);
                  //~ log("app command: "+command, true);
                  this.activityLog.log(_("%s has just been launched.").format(""+client.name));
                  Util.clearTimeout(id);
                }), 2000); // 2000 ms
                break
              }
            }
          }
          //~ if (client.quit) {
            //~ for (let app of this.internetApps) {
              //~ if (""+app.name === ""+client.name && app.get_state() === Cinnamon.AppState.RUNNING) {
                //~ let pids = app.get_pids();
                //~ if (pids.length > 0) {
                  //~ //client["pids"] = pids;
                  //~ //app["pids"] = pids;
                  //~ for (let pid of pids)
                    //~ log("%s : pid: %s".format(client.name, ""+pid), true);
                //~ }
                //~ break
              //~ }
            //~ }
          //~ }
        }
        //~ this.s.setValue("clientsList", clientsList);
      } else if (this.vpnStatus === "off") {
        this.audible_alert();
        //~ for (let client of clientsList) {
          //~ if (client.quit) {
            //~ for (let app of this.internetApps) {
              //~ if (""+app.name === ""+client.name) {
                //~ this.super_kill(app);
                //~ try {
                  //~ app.request_quit();
                //~ } catch(e) {
                  //~ // Nothing to do.
                //~ }
                //~ break
              //~ }
            //~ }
          //~ }
        //~ }
        log("reconnect: "+this.reconnect);
        log("respectUserRequest: "+this.respectUserRequest);
        log("disconnectedByUser: "+this.disconnectedByUser);
        if (this.reconnect && !(this.respectUserRequest && this.disconnectedByUser))
          this.try_to_reconnect_to_latest_vpn();
        this.monitor_vpn_only_apps()
      }
      clientsList = null
    })
  } // End of on_network_changed

  async super_kill(app) {
    let app_name = app.get_name();
    let kw = this.keyword_for_pkill(app);
    let result = killall(kw);
    if (result) {
      this.activityLog.log(_("%s has just been stopped.").format(""+app_name))
    }

  } // End of super_kill

  monitor_vpn_only_apps() {
    if (!this.s.getValue("manageClients") || !this.applet_running) {
      if (this.loopId > 0) {
        Mainloop.source_remove(this.loopId);
      }
      this.loopId = 0;
      return false;
    }
    log("VPN status: "+this.vpnStatus);
    if (this.vpnStatus === "off") {
      this.get_internet_apps();
      let clientsList = this.s.getValue("clientsList");
      for (let client of clientsList) {
        if (client.vpnOnly) {
          for (let app of this.internetApps) {
            if (""+app.name === ""+client.name) {
              this.super_kill(app);
              this.activityLog.log(_("%s stopped because the VPN link is idle.").format(""+client.name));
              break
            }
          }
        }
      }
      clientsList = null
    }

    if (this.applet_running)
      this.loopId = Mainloop.timeout_add_seconds(10, Lang.bind(this, this.monitor_vpn_only_apps));

    return false;
  } // End of monitor_vpn_only_apps

  keyword_for_pkill(app) {
    let appInfo = app.get_app_info();
    let executable = appInfo.get_executable(); // Devhelp: GAppInfo
    //~ log("%s: executable: %s".format(app.get_name(), executable), true);
    return ""+executable
  }

  async get_vpn_status() {
    let monitor = this.netMonitor;
    let network_available = monitor.get_network_available();
    log("on_network_changed(%s, %s)".format(Util.getGObjectPropertyValues(monitor, 2), network_available));
    log("Connectivity: %s".format(monitor.get_connectivity()));
    log("Network metered: %s".format(monitor.get_network_metered()));

    this.vpnOldType = ""+this.vpnType;
    this.vpnOldDevice = ""+this.vpnDevice;
    this.vpnOldUUID = ""+this.vpnUUID;
    this.vpnOldAutoconnect = ""+this.vpnAutoconnect;
    this.vpnOldTimestamp = 0+this.vpnTimestamp;
    this.vpnOldName = ""+this.vpnName;

    this.vpnOldStatus = ""+this.vpnStatus;

    let command = `bash -c '%s/vpn_status_sentinel.sh'`.format(SCRIPTS_DIR);

    let subProcess = Util.spawnCommandLineAsyncIO(command, Lang.bind(this, function(stdout, stderr, exitCode) {
      let out = (typeof stdout === "object") ? to_string(stdout) : stdout;
      let actives = out.trim().split(";");
      let data = actives[0].split(":");
      // TYPE:DEVICE:UUID:AUTOCONNECT:TIMESTAMP:NAME;etc
      // vpn:enp2s0:30c15256-2838-4aa0-888e-4544f4d7cbff:yes:1658929072:Czech_Republic-Prague (IPv6);wireguard:Es-Madrid(W):6711baa7-4137-477d-856c-a2cd5736812d:no:1658929090:Es-Madrid(W)
      //~ log("interface: %s; name: %s; status: %s".format(data[0], data[1], data[2]));

      [this.vpnType, this.vpnDevice, this.vpnUUID, this.vpnAutoconnect, this.vpnTimestamp, this.vpnName] = data;
      this.vpnTimestamp = 0+this.vpnTimestamp;

      this.vpnStatus = (this.vpnType.length === 0) ? "off" : "on";
      //~ [this.vpnDevice, this.vpnName, this.vpnStatus] = data
      //~ this.vpnStatus = data[2];
      //~ this.vpnName = data[1];
      //~ this.vpnDevice = data[0];
      if (this.vpnStatus === "on" && this.vpnName !=="" && this.vpnDevice !== "") {
        this.lastVpnInterfaceUsed = this.vpnDevice;
        this.lastVpnNameUsed = this.vpnName;
        this.alertIssued = false;
        this.disconnectedByUser = false;
      }

      this.other_active_VPN = [];
      for (let i=1; i<actives.length; i++) {
        let o_data = actives[i].split(":");
        this.other_active_VPN.push(""+o_data[5]); // NAME field.
      }
      this.update_icon();
      subProcess.send_signal(9);
    }));

    //this.update_icon();
  } // End of get_vpn_status

  async try_to_reconnect_to_latest_vpn() {
    log("try_to_reconnect_to_latest_vpn()");
    log("this.vpnStatus: "+this.vpnStatus);
    this.get_vpn_status().then( () => {
      if (!this.reconnect ||
          this.vpnStatus === "on" ||
          this.lastVpnNameUsed === "" ||
          this.lastVpnInterfaceUsed === ""
      ) {
        log("reconnection useless");
        if (this.vpnStatus === "on") {
          log("update icon requested");
          this.update_icon();
        }
        return;
      }
      log("reconnection useful");
      this.activityLog.log(_("Connection lost. Attempt to reconnect to: %s").format(this.lastVpnNameUsed));
      this.connect_vpn(this.lastVpnNameUsed);
      this.update_icon();
    })
  }  // End of try_to_reconnect_to_latest_vpn

  connect_vpn(name) {
    this.set_transient();
    let command = `bash -c '/usr/bin/nmcli -w 4 connection up "%s" > /dev/null'`.format(name);
    //log("command: "+command, true);
    this.activityLog.log(_("Connection to: ") + name);
    //~ GLib.spawn_command_line_async(""+command); // FIXME: analyze the return of this command!
    let subProcess = Util.spawnCommandLineAsyncIO(command, Lang.bind(this, function(stdout, stderr, exitCode) {
      log("connect_vpn("+name+") - exitCode: "+exitCode, true);
      if (exitCode === 0) {
        this.disconnectedByUser = false;
        this.vpnStatus = "on";
        this.activityLog.log(_("Connected to: ") + name);
      }
      subProcess.send_signal(9)
    }))
  } // End of connect_vpn

  disconnect_vpn(name) {
    this.disconnectedByUser = true;
    this.set_transient();
    let command = `bash -c '/usr/bin/nmcli -w 4 connection down "%s" > /dev/null'`.format(name);
    //log("command: "+command, true);
    GLib.spawn_command_line_async(""+command);
    //~ this.vpnStatus = "off";
    let id = Util.setTimeout( Lang.bind(this, function() {
      this.activityLog.log(_("Disconnected from: ") + name);
      Util.clearTimeout(id)
    }), 1000); // 1000 ms
  } // End of disconnect_vpn

  change_connection(new_co) {
    let old_co = ""+this.vpnName;
    if (this.is_deactivated) this.switch_activation();
    let l=this.SMCItems.length;
    for (let i=0; i<l; i++) {
      this.SMCItems[i].setSensitive(false)
    }

    //~ if (this.vpnStatus === "on") {
    if (this.vpnStatus !== "off") {
      this.disconnect_vpn(old_co);
    }

    this.activityLog.log(_("Switching to: ") + new_co);

    this.connect_vpn(new_co);

    for (let i=0; i<l; i++) {
        if (this.SMCItems[i].label.text == new_co) {
            this.SMCItems[i].setShowDot(true);
        } else {
            this.SMCItems[i].setShowDot(false);
            this.SMCItems[i].setSensitive(true)
        }
    }
  } // End of change_connection

  set_transient() {
    this.vpnStatus = "transient";
    this.setup_status_info();
    this.actor.set_style_class_name("vpn-transient");
  } // End of set_transient


  on_applyBypassListButton_clicked() {
    log("applyBypassListButton clicked!", true);
    Util.spawnCommandLineAsync("bash -c '%s/apply-bypass-list.sh'".format(SCRIPTS_DIR))
  }

  /** Icon of this applet
   */
  update_icon() {
    this.setup_status_info();
    this.set_applet_icon_symbolic_name(DEFAULT_SYMBOLIC_ICON);
    this.set_flag();
  } // End of update_icon

  /** Flags
   */
  set_flag() {
    log("set_flag() (this.useFlags = %s; this.vpnStatus = %s; this.vpnName = %s; this.labelWhenVPNisOff = %s)".format(this.useFlags, this.vpnStatus, this.vpnName, ""+this.labelWhenVPNisOff));
    if (this.useFlags === false) {
      this.hideLabel();
      return
    }

    let flagList = this.s.getValue("flagList");
    this.showLabel();

    if (this.vpnStatus === "off") {
      switch(this.labelWhenVPNisOff) {
        case "NoLabel":
          this.hideLabel();
          return;
        case "LabelWithoutFlag": {
          this.set_applet_label(DEFAULT_APPLET_LABEL);
          return;
        }
        case "LabelWithFlag": {
          for (let fl of flagList) {
            if ((""+fl.vpnName == _("(None)")) && (fl.confirmed === true)) {
              this.set_applet_label(""+fl.flag);
              return
            }
          }
          IpGateway.getCountryCodeInfo( (countryCode) => this.update_flag_info(countryCode));
          return;
        }
      }
    } else {
      if (this.vpnStatus === "on") {
        for (let fl of flagList) {
          if ((""+fl.vpnName == ""+this.vpnName) && (fl.confirmed === true)) {
            this.set_applet_label(""+fl.flag);
            return
          }
        }
      }
    }
    IpGateway.getCountryCodeInfo( (countryCode) => this.update_flag_info(countryCode));
  } // End of set_flag

  update_flag_info(countryCode) {
    //log("update_flag_info(%s)".format(countryCode) + ": this.vpnName: "+this.vpnName);
    let vpn_name = this.vpnName;
    if (vpn_name.length === 0) vpn_name = _("(None)");

    const flags_sort_by_vpnName = arr => arr.sort(
      (a, b) => a.vpnName.localeCompare(
        b.vpnName, undefined,
        {sensitivity: "base", ignorePunctuation: false}
      )
    )

    const flags_sort_by_countryCode = arr => arr.sort(
      (a, b) => a.countryCode.localeCompare(
        b.countryCode, undefined,
        {sensitivity: "base", ignorePunctuation: true}
      )
    )

    let _countryCode = countryCode.toUpperCase();
    //~ log("_countryCode: %s".format(_countryCode));

    if (this.flags[_countryCode] !== undefined) {
      //~ if (this.vpnStatus === "on") {
        //~ log("%s:%s:%s".format(this.vpnName, _countryCode, this.flags[_countryCode].emoji), true);
        let flagList = this.s.getValue("flagList");
        var newFlagList = [];
        var found = false;
        for (let fl of flagList) {
          if (fl.vpnName == ""+vpn_name) {
            found = true;
            if (fl.confirmed) {
              newFlagList.push(fl)
            } else {
              newFlagList.push({"vpnName": ""+vpn_name, "countryCode": _countryCode, "flag": this.flags[_countryCode].emoji, "confirmed": false})
            }
          } else {
            newFlagList.push(fl)
          }
        }
        if (!found) {
          newFlagList.push({"vpnName": ""+vpn_name, "countryCode": _countryCode, "flag": this.flags[_countryCode].emoji, "confirmed": false})
        }

        let sortBy = this.sortFlagListBy;
        if (sortBy === "vpnName") {
          flags_sort_by_vpnName(newFlagList);
        } else if (sortBy === "countryCode") {
          flags_sort_by_countryCode(newFlagList);
        }

        this.s.setValue("flagList", newFlagList);
      //~ }
      this.set_applet_label(this.flags[_countryCode].emoji);
    } else {
      this.set_applet_label(DEFAULT_APPLET_LABEL);
    }
    return;
  } // End of update_flag_info

  is_flag_confirmed() {
    let vpn_name = this.vpnName;
    if (vpn_name.length === 0) vpn_name = _("(None)");

    let flagList = this.s.getValue("flagList");
    for (let fl of flagList) {
      if (""+fl.vpnName === ""+vpn_name && fl.confirmed) {
        return true
      }
    }
    return false
  } // End of is_flag_confirmed

  confirm_flag(vpn_name) {
    //~ log("vpn_name: "+vpn_name, true);
    let _vpn_name = vpn_name;
    if (_vpn_name.length === 0) _vpn_name = _("(None)");
    //~ log("_vpn_name: "+_vpn_name, true);

    let flagList = this.s.getValue("flagList");
    var newFlagList = [];
    for (let fl of flagList) {
      if (""+fl.vpnName == ""+_vpn_name) {
        newFlagList.push({"vpnName": ""+_vpn_name, "countryCode": ""+fl.countryCode, "flag": ""+fl.flag, "confirmed": true})
      } else {
        newFlagList.push(fl)
      }
    }
    this.s.setValue("flagList", newFlagList)
  } // End of confirm_flag

  sort_flaglist(reload_settings_window=true) {
    let sortBy = this.sortFlagListBy;
    if (sortBy === "None") return;

    const flags_sort_by_vpnName = arr => arr.sort(
      (a, b) => a.vpnName.localeCompare(
        b.vpnName, undefined,
        {sensitivity: "base", ignorePunctuation: false}
      )
    )

    const flags_sort_by_countryCode = arr => arr.sort(
      (a, b) => a.countryCode.localeCompare(
        b.countryCode, undefined,
        {sensitivity: "base", ignorePunctuation: true}
      )
    )

    if (reload_settings_window) {
      let app = this.tracker["focus-app"];
      let instanceId = this.instanceId;
      let tabFlags = this.tabFlags;
    }

    let flagList = this.s.getValue("flagList");
    if (sortBy === "vpnName") {
      flags_sort_by_vpnName(flagList);
    } else if (sortBy === "countryCode") {
      flags_sort_by_countryCode(flagList);
    }

    this.s.setValue("flagList", flagList);


    //~ log("App name: "+app.get_name(), true);
    if (!reload_settings_window) return;

    if (app) app.request_quit();

    let id = Util.setTimeout( Lang.bind(this, () => {
      Util.spawnCommandLine("cinnamon-settings applets %s -t %s %s".format(UUID, ""+tabFlags, ""+instanceId));
      Util.clearTimeout(id);
    }), 500); // 500 ms
  } // End of sort_flaglist

  /** Audible alert
   */
  audible_alert() {
    if (!this.alertIssued && this.vpnStatus !== "on") {
      if ((this.useSoundAlert && this.vpnOldStatus === "on")
      || (this.useSoundAlertAtBeginning)) {
        //~ log("Playing audible alert!");
        GLib.spawn_command_line_async('play -V0 -q "%s/vpn-dropped.oga"'.format(SOUNDS_DIR));
        this.alertIssued = true;
      }
    }
  } // End of audible_alert

  /** Menu (left click)
   */

  make_menu() {
    this.menu.removeAll();
    // Head
    let menuitemHead1 = new PopupMenu.PopupMenuItem(TITLE+" "+this.versionNumber, {
      reactive: false
    });
    this.menu.addMenuItem(menuitemHead1);

    // Status Info (alterable)
    this.menuitemInfo2 = new PopupMenu.PopupMenuItem("  ", {
      reactive: false
    });
    this.menu.addMenuItem(this.menuitemInfo2);
    this.setup_status_info();

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // button connect/disconnect
    this.button_connect = new PopupMenu.PopupSwitchMenuItem(
      (this.vpnStatus === "on") ? _("ENABLED") : (this.vpnStatus === "off") ? _("DISABLED") : _("TRANSIENT"),
      false
    );
    this.button_connect.connect("toggled", () => this.on_button_connect());
    this.menu.addMenuItem(this.button_connect);
    this.button_connect.setToggleState(this.vpnStatus === "on");
    log("vpnOldDevice: %s ; vpnOldName: %s ; vpnStatus: %s".format(this.vpnOldDevice, this.vpnOldName, this.vpnStatus));
    // this button must appear only if auto-reconnect is inactive
    //if (this.vpnOldDevice == "" || this.vpnOldName == "" || (this.reconnect && !this.respectUserRequest)) {
    if (this.lastVpnInterfaceUsed == "" || this.lastVpnNameUsed == "" || (this.reconnect && !this.respectUserRequest)) {
      this.button_connect.actor.hide()
    } else {
      this.button_connect.setStatus(""+this.lastVpnNameUsed);
      this.button_connect.actor.show()
    }

    if (this.other_active_VPN.length > 0) {
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      let menuItemOtherVPN = new PopupMenu.PopupMenuItem(_("Other active VPN links (select to disable):"), {
        reactive: false
      });
      this.menu.addMenuItem(menuItemOtherVPN);
      let otherVPNItems = [];
      for (let oa of this.other_active_VPN) {
        let it = new PopupMenu.PopupIndicatorMenuItem(""+oa);
        it.connect('activate', (event) => {
          Util.spawnCommandLineAsync('nmcli connection down "%s"'.format(""+oa));
        });
        otherVPNItems.push(it);
        this.menu.addMenuItem(otherVPNItems[otherVPNItems.length - 1])
      }
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    // ++ Set up sub menu for Connections Items
    this.subMenuConnections = new PopupMenu.PopupSubMenuMenuItem(_("Connections"));
    this.menu.addMenuItem(this.subMenuConnections);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.SMCItems = []; // Items of subMenuConnections (SMC)
    let l=this.vpnNames.length;
    for (let i=0; i<l ; i++) {
      let name=this.vpnNames[i];
      this.SMCItems[i] = new PopupMenu.PopupIndicatorMenuItem(name);
      this.SMCItems[i].connect('activate', (event) => this.change_connection(""+name));
      if (name===this.vpnName) {
        this.SMCItems[i].setShowDot(true);
        this.SMCItems[i].setSensitive(false)
      }
      this.subMenuConnections.menu.addMenuItem(this.SMCItems[i]);
    };
    // Display this submenu only if there are more than one connection
    if (this.SMCItems.length > 1) {
        this.subMenuConnections.actor.show()
    } else {
        this.subMenuConnections.actor.hide()
    }

    // checkbox Connect at start-up
    this.checkbox_connectAtStartup = new PopupMenu.PopupSwitchMenuItem(
      _("Connect to VPN as soon as this applet starts."),
      this.connectAtStartup
    );
    this.checkbox_connectAtStartup.connect("toggled", () => this.on_checkbox_connectAtStartup_changed());
    this.menu.addMenuItem(this.checkbox_connectAtStartup);

    // checkbox reconnect
    this.checkbox_reconnect = new PopupMenu.PopupSwitchMenuItem(
      _("Try to reconnect to VPN when it shuts down incidentally."),
      this.reconnect
    );
    this.checkbox_reconnect.connect("toggled", () => this.on_checkbox_reconnect_changed());
    this.menu.addMenuItem(this.checkbox_reconnect);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // button VPN Policy...
    let configure1 = new PopupMenu.PopupIconMenuItem(_("VPN Policy") + "...", "system-run", St.IconType.SYMBOLIC);
    configure1.connect("activate", () => {
      Util.spawnCommandLine("cinnamon-settings applets %s -t %s %s".format(UUID, ""+this.tabNumberOfVPNPolicy, ""+this.instanceId));
    });
    this.menu.addMenuItem(configure1);

    // button Internet Apps Manager...
    let configure2 = new PopupMenu.PopupIconMenuItem(_("Internet Apps Manager") + "...", "system-run", St.IconType.SYMBOLIC);
    configure2.connect("activate", () => {
      Util.spawnCommandLine("cinnamon-settings applets %s -t %s %s".format(UUID, ""+this.tabNumberOfInternetPolicy, ""+this.instanceId));
    });
    this.menu.addMenuItem(configure2);

    if (this.doLogActivity) {
      // view log file
      let view_log = new PopupMenu.PopupIconMenuItem(_("Open Activity Logs"), "folder-documents-symbolic", St.IconType.SYMBOLIC);
      view_log.connect('activate', (event) => {
        this.activityLog.display_logs();
      });
      this.menu.addMenuItem(view_log);
    }

    // Button 'Reload Flag'
    if (this.useFlags) {
      let _reload_flag_button = new PopupMenu.PopupIconMenuItem(_("Reload Country Flag"), "flag-sentinel", St.IconType.SYMBOLIC);
      _reload_flag_button.connect("activate", (event) => this.set_flag());
      let _confirm_flag_button = new PopupMenu.PopupIconMenuItem(_("Confirm this Country Flag"), "user-bookmarks", St.IconType.SYMBOLIC);
      _confirm_flag_button.connect("activate", (event) => this.confirm_flag(this.vpnName));
      //~ if (this.vpnStatus === "off" || (this.vpnStatus === "on" && !this.is_flag_confirmed())) {
        //~ this.menu.addMenuItem(_reload_flag_button);
        //~ if (this.vpnStatus === "on")
          //~ this.menu.addMenuItem(_confirm_flag_button);
      //~ }
      if (this.labelWhenVPNisOff === "LabelWithFlag" && !this.is_flag_confirmed()) {
        this.menu.addMenuItem(_reload_flag_button);
        this.menu.addMenuItem(_confirm_flag_button);
      }
    }

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Access to System Network Settings
    this.menu.addSettingsAction(_("Network Settings"), 'network');
    //this.menu.addSettingsAction(_("Connection Info"),'connections-read');

    // Access to Network Manager: Connection editor
    this.menu.addAction(_("Network Connections"), () => {
      Util.spawnCommandLine("nm-connection-editor -t vpn");
    });

    if (DEBUG() || RELOAD()) {
      // button 'Reload this applet'
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      let _reload_button = new PopupMenu.PopupIconMenuItem("Reload this applet", "edit-redo", St.IconType.SYMBOLIC);
      _reload_button.connect("activate", (event) => this._on_reload_this_applet_pressed());
      this.menu.addMenuItem(_reload_button);
    }
  } // End of make_menu

  setup_status_info() {
    let status = ""+this.vpnStatus;
    this.actor.set_style_class_name("vpn-%s".format(status));
    let statusInfo;
    if (status === "on") {
      if (this.vpnType === "vpn") {
        statusInfo = _("VPN: %s\n Device: %s\n Since: %s").format(
          this.vpnName,
          this.vpnDevice,
          GLib.DateTime.new_from_unix_local(this.vpnTimestamp).format("%X")
        );
      } else if (this.vpnType === "wireguard") {
        statusInfo = _("WIREGUARD: %s\n Device: %s\n Since: %s").format(
          this.vpnName,
          this.vpnDevice,
          GLib.DateTime.new_from_unix_local(this.vpnTimestamp).format("%X")
        );
      }
    } else if (status === "off") {
      statusInfo = _("Disconnected");
    } else if (status === "transient") {
      statusInfo = _("Transient");
    } else {
      statusInfo = _("Deactivated");
    }
    this.set_applet_tooltip(TITLE + "\n" + statusInfo);
    if (this.menuitemInfo2 !== undefined)
      this.menuitemInfo2.label.set_text("  "+statusInfo);
  } // End of setup_status_info

  on_button_connect() {
    if (this.menu.isOpen) this.menu.toggle(); // closes the opened menu
    //~ let status = this.vpnStatus;
    //~ this.vpnStatus = "transient";
    //~ if (status !== "on" && this.lastVpnNameUsed) {
    if (this.vpnStatus !== "on" && this.lastVpnNameUsed) {
      this.connect_vpn(this.lastVpnNameUsed);
    } else if (this.vpnStatus !== "off") {
      this.disconnect_vpn(this.vpnName);
    }
    //this.update_icon();
  } // End of on_button_connect

  get_vpn_names() {
    let command = `bash -c '%s/vpn_names.sh'`.format(SCRIPTS_DIR);
    let subProcess = Util.spawnCommandLineAsyncIO(command, Lang.bind(this, function (stdout, stderr, exitCode) {
      let out = (typeof stdout === "object") ? to_string(stdout) : stdout;
      let list_vpn_names=[];
      if (stdout && exitCode == 0) {
        list_vpn_names=out.split(";");
      } else {
        if (this.vpnName.length !== 0) {
          list_vpn_names.push(this.vpnName);
        }
      }
      this.vpnNames = list_vpn_names;
      subProcess.send_signal(9);
    }));
  } // End of get_vpn_names

  //on_enter() {
    //log("on_enter");
    //this.actor.add_style_pseudo_class('hover');
    //if (this.interval === 0)
        //this.interval = setInterval(null, 10);
    //return true;
  //} // End of on_enter

  //on_leave() {
    //log("on_leave");
    //if (this.menu.isOpen)
      //this.menu.toggle();
    //if (this.interval === 0)
        //this.interval = setInterval(null, 0);
    //return true;
  //} // End of on_leave

  /** Actions
   */
  _on_reload_this_applet_pressed() {
    // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
    this.applet_running = false;

    if (this.loopId > 0) {
      Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;

    this.disconnect_monitors();

    // Reload this applet
    Extension.reloadExtension(UUID, Extension.Type.APPLET);
  }; // End of _on_reload_this_applet_pressed

  on_checkbox_connectAtStartup_changed() {
    this.connectAtStartup = !this.connectAtStartup;
    this.checkbox_connectAtStartup.setToggleState(this.connectAtStartup);
  } // End of on_checkbox_connectAtStartup_changed

  on_checkbox_reconnect_changed() {
    this.reconnect = !this.reconnect;
    if (this.reconnect) {
        if (this.respectUserRequest) {
            // The Connect button is then useful.
            this.button_connect.actor.show();
        } else {
            // The Connect button is then useless.
            this.button_connect.actor.hide();
        }
    } else {
        // The Connect button is then useful.
        this.button_connect.actor.show();
    }
    // Update checbox
    this.checkbox_reconnect.setToggleState(this.reconnect);
  } // End of on_checkbox_reconnect_changed

  on_open_activity_log_requested() {
    this.activityLog.display_logs();
  } // End of on_view_activity_log_requested

  on_clear_activity_log_requested() {
    this.activityLog.clear_log_file();
  } // End of on_clear_activity_log_requested


  /** Keybinding
   */
  on_shortcut_changed() {
    try{
      Main.keybindingManager.removeHotKey(UUID);
    } catch(e) {}
    if (this.keybinding != null) {
      Main.keybindingManager.addHotKey(UUID, this.keybinding, () => this.on_shortcut_used())
    }
  } // End of on_shortcut_changed

  on_shortcut_used() {
    if (this.vpnStatus !== "transient") {
      this.on_button_connect()
    }
  } // End of on_shortcut_used


  /** Applet System
   * Note: When reloading of this applet is requested,
   *       the three functions below are executed in this order:
   *         1. on_applet_reloaded()
   *         2. on_applet_removed_from_panel()
   *         3. on_applet_added_to_panel().
   */

  on_applet_reloaded() {
    this.activityLog.log(_("VPN-Sentinel re-loading requested."))
  } // End of on_applet_reloaded

  on_applet_removed_from_panel() {
    this.activityLog.set_active(false);
    this.disconnect_monitors();

    if (this.loopId > 0) {
      Mainloop.source_remove(this.loopId);
    }
    this.loopId = 0;

    Main.keybindingManager.removeHotKey(UUID);
    this.activityLog.log(_("VPN-Sentinel was stopped."));
    let message = "";
    if (this.vpnStatus === "on") {
      if (this.vpnType === "vpn") {
        message = _("Still connected to VPN: %s").format(this.vpnName)
      } else if (this.vpnType === "wireguard") {
        message=_("Still connected to WIREGUARD: %s").format(this.vpnName)
      } else {
        message = _("Still connected to: %s").format(this.vpnName)
      }
    } else if (this.vpnStatus === "off") {
      message=_("No VPN/WIREGUARD link.")
    } else {
      message=_("VPN/WIREGUARD Status: Transient.")
    }
    this.activityLog.log(message)
  } // End of on_applet_removed_from_panel

  on_applet_added_to_panel() {
    this.get_vpn_names()
  } // End of on_applet_added_to_panel

  // Handle click on applet icon
  on_applet_clicked(event) {
    this.make_menu();
    this.menu.toggle();
  } // End of on_applet_clicked

  on_applet_middle_clicked(event) {
    this.on_shortcut_used()
  } // End of on_applet_middle_clicked

  // Null function called when Generic (internal) Setting changed
  on_generic_changed() {
      // Nothing to do
  } // End of on_generic_changed
} // End of class VPNSentinel

function main(metadata, orientation, panelHeight, instance_id) {
    return new VPNSentinel(metadata, orientation, panelHeight, instance_id);
}
