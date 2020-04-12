/* This is a VPN Look-Out Applet.
It is not only useful in its own right
but is also provides a 'tutorial' framework for other more
complex applets - for example it provides a settings screen
and a 'standard' right click (context) menu which opens
the settings panel and a submenu.
Items with a ++ in the comment are useful for re-use
*/
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const St = imports.gi.St; // ++
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang; //  ++ Needed for menus
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop; // Needed for timer update loop
const Extension = imports.ui.extension; // Needed to reload applets
//const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert
const Gettext = imports.gettext; // ++ Needed for translations
const Main = imports.ui.main; // ++ Needed for notify()
const MessageTray = imports.ui.messageTray; // ++ Needed for the criticalNotify() function in this script
const Util = imports.misc.util; // Needed for spawnCommandLine()
const Cinnamon = imports.gi.Cinnamon; // Needed to read/write into a file

// ++ Always needed if you want localization/translation support
// New l10n support thanks to ideas from @Odyseus, @lestcape and @NikoKrause

const UUID = "vpnLookOut@claudiux";
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const ICONS_DIR = APPLET_DIR + "/icons";

/**
 * Returns true only when the DEBUG file is present in this applet directory ($ touch DEBUG).
 * Useful to log messages in ~/.xsession-errors.
 */
function DEBUG() {
  let _debug = Gio.file_new_for_path(APPLET_DIR + "/DEBUG");
  return _debug.query_exists(null);
};

// ++ Always needed if you want localization/translation support
Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
};

// ++ Useful for logging in .xsession_errors
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG() returns true.
 * log("Any message here", true) to log the message even if DEBUG() returns false.
 * logError("Any error message") log the error message regardless of the DEBUG() return.
 */
function log(message, alwaysLog=false) {
  if (DEBUG() || alwaysLog) global.log("\n[" + UUID + "]: " + message + "\n");
}

function logError(error) {
  global.logError("\n[" + UUID + "]: " + error + "\n")
}

/**
 * criticalNotify:
 * (Code from imports.ui.main ; modified to return notification, to allow to destroy it.)
 * @msg: A critical message
 * @details: Additional information
 */
var messageTray = new MessageTray.MessageTray();
function criticalNotify(msg, details, icon) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, { icon: icon });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.CRITICAL);
    source.notify(notification);
    return notification
};

class ActivityLogging {
    constructor(metadata, nbdays=30, active=true) {
        this.metadata = metadata;
        //this.uuid = metadata.uuid;
        this.set_active(active);
        this.set_lifetime(nbdays); // to cut logfile
        this.time_options = {year: "numeric", month: "numeric", day: "numeric",
           hour: "numeric", minute: "numeric", second: "numeric",
           hour12: !this._get_system_use24h(), timeZone: this._get_timezone(), timeZoneName: "short"};

        GLib.spawn_command_line_async("bash -c 'touch "+ this.log_file_path() +"'");
    } // End of constructor

    log_file_path() {
        let ret = GLib.get_home_dir() + "/.cinnamon/configs/" + UUID + "/vpn_activity.log";
        return ret
    } // End of log_file_path

    _get_epoch(d) {
        return Math.round(Date.parse(d)/1000);
    } // End of _get_epoch

    _get_system_use24h() {
        let _SETTINGS_SCHEMA='org.cinnamon.desktop.interface';
        let _SETTINGS_KEY = 'clock-use-24h';
        let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
        let ret = _interface_settings.get_boolean(_SETTINGS_KEY);
        return ret
    } // End of get_system_icon_theme

    _get_timezone() {
        let [res, out, err, status] = GLib.spawn_command_line_sync('bash -c "%s/getTZ.sh"'.format(SCRIPTS_DIR));
            // res is a boolean : true if command line has been correctly executed
            // out is the return of the script (as that is sent by 'echo' command in a bash script)
            // err is the error message, if an error occured
            // status is the status code (as that is sent by an 'exit' command in a bash script)
        let tz = out.toString().trim();
        return tz;
    } // End of _get_timezone

    _get_user_language() {
        return GLib.getenv("LANG").split(".")[0].replace("_","-")
    } // End of get_user_language

    set_active(active) {
        this.is_active = active
    } // End of set_active

    set_lifetime(days) {
        this.lifetime = 86400 * days; // 1 day = 84600 seconds
    } // End of set_lifetime

    truncate_log_file() {
        if (this.is_active) {
            let date = new Date();
            let limit = this._get_epoch(date)-this.lifetime;
            // Read file contents:
            let contents = Cinnamon.get_file_contents_utf8_sync(this.log_file_path()).split("\n");
            var line;
            var epoch_date, new_contents = [];
            // keep recent lines:
            for (line of contents) {
                if (line != '') {
                    epoch_date = eval(line.split(" - ")[0].valueOf());
                    if (epoch_date > limit) new_contents.push(line.trim());
                }
            }
            // Write new contents in log file
            if (new_contents.length !== contents.length) {
                let file = Gio.file_new_for_path(this.log_file_path());
                let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                let out = Gio.BufferedOutputStream.new_sized (raw, 4096);
                for (line of new_contents) {
                    Cinnamon.write_string_to_stream(out, line + "\n")
                }
                out.close(null);
            }
            contents = []; new_contents = [];
        }
    } // End of truncate_log_file

    display_logs() {
        let command;
        /*
        if (GLib.find_program_in_path("gnome-system-log-pkexec")) {
            command = "gnome-system-log-pkexec " + this.log_file_path();
        } else {
            command = "bash -c 'gnome-system-log " + this.log_file_path() + "'";
        }
        */
        command = this.metadata.path + '/egSpawn.js';
        GLib.spawn_command_line_async(command);
    } // End of display_logs

    log(s) {
        if (this.is_active) {
            let d = new Date();
            //global.log("d.toTimeString()="+d.toTimeString());
            //let date_string = d.toISOString();
            let date_string = new Intl.DateTimeFormat(this._get_user_language(), this.time_options).format(d);
            let command = "\"echo '"+ this._get_epoch(d).toString() + " - " + date_string + " - " + s + "' >> " + this.log_file_path() + "\"";
            //global.log("command=" + command);
            GLib.spawn_command_line_async("bash -c " + command);
        }
    } // End of log
}; //End of class ActivityLogging

// ++ Always needed
class vpnLookOut extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        //try {
            // Fixes an issue in Cinnamon 3.6.x, setting right permissions to script files
            GLib.spawn_command_line_async("bash -c 'cd "+ SCRIPTS_DIR + " && chmod 755 *.sh *.py'");
            GLib.spawn_command_line_async("bash -c 'cd "+ metadata.path + " && chmod 755 egSpawn.js'");

            // ++ Settings
            this.settings = new Settings.AppletSettings(this, UUID, instance_id); // ++ Picks up UUID from metadata for Settings

            if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
                 this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            }

            this.instanceId = instance_id;

            this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
                "refreshInterval-spinner", // The setting key
                "refreshInterval", // The property to manage (this.refreshInterval)
                this.on_settings_changed, // Callback when value changes
                null); // Optional callback data

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "doLogActivity",
                "doLogActivity",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "logLifetime",
                "logLifetime",
                this.on_settings_changed,
                null);

            // Logging activity:
            this.activityLog = new ActivityLogging(metadata, this.logLifetime, this.doLogActivity);
            this.activityLog.truncate_log_file();
            this.next_truncation = 86400;

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "vpnInterface",
                "vpnInterface",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "vpnName",
                "vpnName",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "displayType",
                "displayType",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "use_symbolic_icons",
                "use_symbolic_icons",
                this.set_icons,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useSoundAlert",
                "useSoundAlert",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "connectAtStartup",
                "connectAtStartup",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "deactivateAtStartup",
                "deactivateAtStartup",
                null,
                null);
            if (this.connectAtStartup === true) this.deactivateAtStartup = false;

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "reactivationRequested",
                "reactivationRequested",
                null,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "reconnect",
                "reconnect",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "respectUserRequest",
                "respectUserRequest",
                this.on_settings_changed,
                null);

            this.disconnectedByUser = false;

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useSoundAlertAtBeginning",
                "useSoundAlertAtBeginning",
                this.on_settings_changed,
                null);

            //this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                //"stopTransmission",
                //"stopTransmission",
                //this.on_settings_changed,
                //null);

            //this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                //"restartTransmission",
                //"restartTransmission",
                //this.on_settings_changed,
                //null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "keybinding",
                "keybinding",
                this.on_shortcut_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "manageClients",
                "manageClients",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "clientsList",
                "clientsList",
                this.on_settings_changed,
                null);

            this.clientStoppedByApplet = {};
            if (this.manageClients===true) {
                let client;
                for (var i=0; i < this.clientsList.length; i++) {
                    client = this.clientsList[i];
                    this.clientStoppedByApplet[client["command"]] = false
                }
            }

            // Keybinding:
            Main.keybindingManager.addHotKey(UUID, this.keybinding, () => this.on_shortcut_used());

            this.instance_id = instance_id;
            // ++ Make metadata values available within applet for context menu.
            this.appletName = metadata.name;
            this.appletPath = metadata.path;
            //this.cssfile = metadata.path + "/stylesheet.css"; // No longer required
            this.changelog = APPLET_DIR + "/CHANGELOG.md";
            this.helpfile = APPLET_DIR + "/help.html";
            this.vpnscript = SCRIPTS_DIR + "/vpn_status.sh";
            this.vpnifacedetect = SCRIPTS_DIR + "/vpn_iface_detect.sh";

            //this.use_symbolic_icons = true;
            this.set_icons();
            //this._applet_icon.style = "color: grey;"

            this.stopClientScript = SCRIPTS_DIR + "/stop_client.sh";
            this.startClientScript = SCRIPTS_DIR + "/start_client.sh";

            this.homedir = GLib.get_home_dir();
            this.localePath = this.homedir + '/.local/share/locale';

            // Set initial value
            //this.set_applet_icon_path(this.vpnwait);

            // Make sure the temp files are created
            GLib.spawn_command_line_async('touch /tmp/.vpn_status /tmp/.vpn_name');

            // No interface in settings ?
            if (this.vpnInterface=="") {
                this.vpn_interface_detect();
            }

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel
            this.is_deactivated = false;
            this.active_status_message = _("Deactivate vpnLookOut");
            this.active_status_icon = "media-playback-pause-symbolic";
            if (this.deactivateAtStartup && this.reactivationRequested === false) {
                this.switch_activation();
            }
            this.reactivationRequested = false;

            // Install Languages (from .po files)
            //this.execInstallLanguage(); // Removed to avoid Cinnamon crashes

            // ++ Part of new l10n support
            //UUID = metadata.uuid;
            //this.uuid = metadata.uuid;
            Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

            /* dummy vars for translation */
            let x = _("TRUE"); // in settings-schema
            x = _("FALSE");    // in settings-schema

            this.flashFlag = true; // flag for flashing background
            this.flashFlag2 = true; // flag for second flashing background
            this.vpnStatus = "waiting"; // Initialise lastBatteryPercentage
            this.vpnStatusOld = "invalid";
            this.alertFlag = !this.useSoundAlertAtBeginning; // Flag says alert has been tripped to avoid repeat notifications


            this.on_orientation_changed(orientation); // Initializes for panel orientation

            // get a terminal used on this system
            this.terminal = this.get_terminal();

            // Check that all dependencies are installed (by presence of sox, zenity and xdg-utils)

            if (this.are_dependencies_installed()) {
                 this.dependenciesMet = true;
            } else {
                 let icon = new St.Icon({ icon_name: 'error',
                 icon_type: St.IconType.FULLCOLOR,
                 icon_size: 36 });
                 let _isFedora = GLib.find_program_in_path("dnf");
                 let _ArchlinuxWitnessFile = Gio.file_new_for_path("/etc/arch-release");
                 let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
                 let _apt_update =  _isFedora ? "sudo dnf update" : _isArchlinux ? "" : "sudo apt update";
                 let _and = _isFedora ? " \\\\&\\\\& " : _isArchlinux ? "" : " \\\\&\\\\& ";
                 //var _apt_install = _isFedora ? "sudo dnf install zenity sox xdg-utils gnome-system-log" : _isArchlinux ? "sudo pacman -Syu zenity sox xdg-utils gnome-system-log" : "sudo apt install zenity sox libsox-fmt-mp3 xdg-utils gnome-system-log";
                 var _apt_install = _isFedora ? "sudo dnf install zenity sox xdg-utils" : _isArchlinux ? "sudo pacman -Syu zenity sox xdg-utils" : "sudo apt install zenity sox libsox-fmt-mp3 xdg-utils";
                 let _libsox = (_isFedora || _isArchlinux) ? "" : "libsox-fmt-mp3";
                 let criticalMessage = _("You appear to be missing some of the programs required for this applet to have all its features including notifications and audible alerts.")+"\n\n"+_("Please execute, in the just opened terminal, the commands:")+"\n "+ _apt_update +" \n "+ _apt_install +"\n\n";
                 this.notification = criticalNotify(_("Some dependencies are not installed!"), criticalMessage, icon);
                 // TRANSLATORS: The next message should not be translated.
                 if (this.terminal  != "")
                    GLib.spawn_command_line_async(this.terminal + " -e 'sh -c \"echo vpnLookOut Applet message: Some packages needed!; echo To complete the installation, please enter and execute the command: ; echo "+ _apt_update + _and + _apt_install + "; sleep 1; exec bash\"'");
                 this.dependenciesMet = false;
            }

            // ++ Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();
            // ++ Build (Left Click) Menu
            this.makeMenu()


            // Finally setup to start the update loop for the applet display running
            if (this.displayType == "compact") {
                this.set_applet_label("");
            } else {
                this.set_applet_label("VPN");
            }

            if (this.dependenciesMet) {
                if (this.is_deactivated)
                    this.set_applet_tooltip(_("vpnLookOut deactivated") + "\n\n" + this.keybinding + " " + _("or Middle-Click to activate"));
                else
                    this.set_applet_tooltip(_("Waiting"));
            } else {
                this.set_applet_tooltip(_apt_install);
            }

            // If required, connect on last VPN
            if (this.connectAtStartup && this.vpnName != "" && this.vpnInterface != "") {
                // Get VPN Status via asyncronous script
                //GLib.spawn_command_line_sync('sh ' + this.vpnscript + ' ' + this.vpnInterface);

                // Get the VPN Status ('on', 'off' or 'waiting')
                if (this.vpnInterface != "") {
                    let iface = Gio.file_new_for_path("/sys/class/net/%s".format(this.vpnInterface));
                    this.vpnStatus = iface.query_exists(null) ? "on" : "off";
                } else {
                    this.vpnStatus = "waiting"
                }

                if (this.vpnStatus != "on") {
                    GLib.spawn_command_line_async('bash -c \'/usr/bin/nmcli connection up "' + this.vpnName + '" > /dev/null \'')
                }
            }

            // Monitoring /var/lib/NetworkManager/timestamps file
            this.monitors = new Array();
            //this.monitorTimestamps();
            this.monitorTun0();

            this.loopId = 0;
            this.on_settings_changed()   // This starts the MainLoop timer loop
        //} catch (e) {
        //    global.logError('vpnLookOut'+e);
        //}
    }; // End of constructor

    are_dependencies_installed() {
        let soxmp3WitnessPath = "/usr/share/doc/libsox-fmt-mp3/copyright";
        let soxmp3WitnessFile = Gio.file_new_for_path(soxmp3WitnessPath);
        let soxmp3Installed = soxmp3WitnessFile.query_exists(null);
        if (!soxmp3Installed) {
            // for Fedora
            soxmp3WitnessPath = "/usr/lib64/sox/libsox_fmt_mp3.so";
            soxmp3WitnessFile = Gio.file_new_for_path(soxmp3WitnessPath);
            soxmp3Installed = soxmp3WitnessFile.query_exists(null);
        }
        if (!soxmp3Installed) {
            // for ArchLinux
            soxmp3WitnessPath = "/usr/lib/sox/libsox_fmt_mp3.so";
            soxmp3WitnessFile = Gio.file_new_for_path(soxmp3WitnessPath);
            soxmp3Installed = soxmp3WitnessFile.query_exists(null);
        }
        //return (soxmp3Installed && GLib.find_program_in_path("sox") && GLib.find_program_in_path("zenity") && GLib.find_program_in_path("xdg-open") && (GLib.find_program_in_path("gnome-system-log-pkexec") || GLib.find_program_in_path("gnome-system-log")))
        return (soxmp3Installed && GLib.find_program_in_path("sox") && GLib.find_program_in_path("zenity") && GLib.find_program_in_path("xdg-open"))
    }; // End of are_dependencies_installed

    execInstallLanguage() {
        let poPath = this.appletPath + "/../po";
        let poDir = Gio.file_new_for_path(poPath);
        let poEnum;
        try {
            poEnum = poDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null)
        } catch(e) {
            poEnum = null
        }

        let moExists = true;
        if (poEnum != null) {
            let info;
            let poFile;
            let language;
            let moPath, moFile;
            while (moExists && (info = poEnum.next_file(null)) != null) {
                let type = info.get_file_type();
                if (type == Gio.FileType.REGULAR) {
                    let name = info.get_name().toString();
                    poFile = poDir.get_child(name);
                    if (name.endsWith('.po')) {
                        language = name.substring(0, name.length - 3);
                        moPath = this.localePath + '/' + language + '/LC_MESSAGES/vpnLookOut@claudiux.mo';
                        moFile = Gio.file_new_for_path(moPath);
                        if (!moFile.query_exists(null)) { // .mo file doesn't exist
                            moExists = false
                        } else { // .mo file exists
                            // modification times
                            let poModified = poFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                            let moModified = moFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                            if (poModified > moModified) { // .po file is most recent than .mo file
                                moExists = false; // .mo file must be replaced.
                            }
                        }
                    }
                }
            }
        }

        if (!moExists) { // at least one .mo file is missing or is too old
            let generatemoPath = this.appletPath + '/../scripts/generate_mo.sh'; // script to generate .mo files
            GLib.spawn_command_line_async('bash -c "' + generatemoPath + '"'); // generate all .mo files
            // Reload this applet for changes to .mo files to take effect.
            // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
            this.on_applet_removed_from_panel();
            // Reload this applet with new .mo files installed
            GLib.spawn_command_line_async('sh ' + this.appletPath + '/../scripts/reload_ext.sh')
        }
    }; // End of execInstallLanguage

    get_system_icon_theme() {
        let _SETTINGS_SCHEMA='org.cinnamon.desktop.interface';
        let _SETTINGS_KEY = 'icon-theme';
        let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
        let _icon_theme = _interface_settings.get_string(_SETTINGS_KEY);
        return _icon_theme
    } // End of get_system_icon_theme

    _onButtonPressEvent(actor, event) {
        let buttonId = event.get_button();

        // On middle click: Connect to last VPN used / Disconnect from VPN.
        if (buttonId === 2) {
            if (this.is_deactivated) {
                this.reactivationRequested = true;
                this.switch_activation();
            } else if (this.vpnStatus !== "waiting") {
                this.on_button_connect(false)
            }
        }

        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    } // End of _onButtonPressEvent

    set_icons() {
        if (this.use_symbolic_icons) {
            //Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);
            //this.set_applet_icon_symbolic_name("vpnlookout");
            this.set_applet_icon_symbolic_name("network-vpn");
            return;
        }
        this.system_icon_theme = this.get_system_icon_theme();
        if (this.system_icon_theme.startsWith('Mint-X'))
            this.system_icon_theme = 'Mint-X';
        if (this.system_icon_theme.startsWith('Mint-Y'))
            this.system_icon_theme = 'Mint-Y';
        if (this.old_system_icon_theme == null || this.system_icon_theme != this.old_system_icon_theme) {
            this.old_system_icon_theme = this.system_icon_theme;
            this.icon_theme_path = this.appletPath + '/../icons/byTheme/' + this.system_icon_theme;
            let icon_theme_dir = Gio.file_new_for_path(this.icon_theme_path);
            let icon_theme_exists = icon_theme_dir.query_exists(null);
            if (!icon_theme_exists) {
                this.icon_theme_path = this.appletPath + '/../icons/default';
            }
            this.vpnon = this.icon_theme_path + "/vpn-on.png";
            this.vpnoff = this.icon_theme_path + "/vpn-off.png";
            this.vpnwait = this.icon_theme_path + "/vpn-wait.png";
        }
    } // End of set_icons

    vpn_interface_detect() {
        // Try to detect the VPN interface.
        let [res, out, err, status] = GLib.spawn_command_line_sync('sh ' + this.vpnifacedetect);
        // res is a boolean : true if command line has been correctly executed
        // out is the return of the script (as that is sent by 'echo' command in a bash script)
        // err is the error message, if an error occured
        // status is the status code (as that is sent by an 'exit' command in a bash script)
        if (res && status == 0) {
            this.vpnInterface=out.toString(); // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
        }
    } // End of vpn_interface_detect

    _witness( path) {
        let witnessFile = Gio.file_new_for_path(path);
        return witnessFile.query_exists(null);
    } //End of _witness

    get_distrib() {
        if (this._witness("/etc/arch-release")) return "Arch";
        if (this._witness("/etc/fedora-release")) return "Fedora";
        return "Mint"
    } // End of get_distrib

    get_terminal() {
        var term_found = "";
        var _terminals = ["gnome-terminal", "tilix", "konsole", "guake", "qterminal", "terminator", "uxterm", "xterm"];
        var t;
        for (t=0; t < _terminals.length ; t++) {
            if (GLib.find_program_in_path(_terminals[t])) {
                term_found = _terminals[t];
                break
            }
        }
        return term_found
    } // End of get_terminal

    get_vpn_names() {
        let [res, out, err, status] = GLib.spawn_command_line_sync('sh -c ' + SCRIPTS_DIR + "/vpn_names.sh");
        let list_vpn_names=[];
        if (res && status == 0) {
            list_vpn_names=out.toString().split(';');
        } else {
            if (this.vpnName != "") {
                list_vpn_names.push(this.vpnName);
            }
        }
        return list_vpn_names
    } // End of get_vpn_names

    on_orientation_changed (orientation) {
        this.orientation = orientation;
        if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
             if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
                 // vertical
                 this.isHorizontal = false;
             } else {
                 // horizontal
                 this.isHorizontal = true;
             }
         } else {
                this.isHorizontal = true;  // Do not check unless >= 3.2
         }
    } // End of on_orientation_changed


    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare(left, right) {
        if (typeof left + typeof right != 'stringstring')
            return false;
        var a = left.split('.'),
            b = right.split('.'),
            i = 0,
            len = Math.max(a.length, b.length);
        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }
        return 0;
    } // End of versionCompare

    // ++ Function called when settings are changed
    on_settings_changed() {
        this.activityLog.set_active(this.doLogActivity);
        if (this.doLogActivity === true) {
            this.activityLog.set_lifetime(this.logLifetime);
            this.activityLog.truncate_log_file();
            this.next_truncation = 86400; // 86400 seconds = 1 day
        }

        if (this.displayType === "compact") {
            this.set_applet_label("");
        } else {
            this.set_applet_label("VPN");
        }

        if (this.connectAtStartup === true) this.deactivateAtStartup = false;

        this.updateLoop();
    } // End of on_settings_changed

    // Keybinding
    on_shortcut_changed() {
        try{
            Main.keybindingManager.removeHotKey(UUID);
        } catch(e) {}
        if (this.keybinding != null) {
            Main.keybindingManager.addHotKey(UUID, this.keybinding, () => this.on_shortcut_used())
        }
    } // End of on_shortcut_changed

    on_shortcut_used() {
        if (this.is_deactivated) {
            this.reactivationRequested = true;
            this.switch_activation();
        } else if (this.vpnStatus !== "waiting") {
            this.on_button_connect(false)
        }
    } // End of on_shortcut_used

    // ++ Null function called when Generic (internal) Setting changed
    on_generic_changed() {}

    on_checkbox_connectAtStartup_changed() {
        this.connectAtStartup = !this.connectAtStartup; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
        this.checkbox_connectAtStartup.setToggleState(this.connectAtStartup);
        this.checkbox_connectAtStartup2.setToggleState(this.connectAtStartup)
    } // End of on_checkbox_connectAtStartup_changed

    on_checkbox_reconnect_changed() {
        this.reconnect = !this.reconnect ; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
        if (this.reconnect) {
            if (this.respectUserRequest) {
                // The Connect button is then useful.
                this.button_connect.actor.show();
                this.button_connect2.actor.show()
            } else {
                // The Connect button is then useless.
                this.button_connect.actor.hide();
                this.button_connect2.actor.hide();
            }
        } else {
            // The Connect button is then useful.
            this.button_connect.actor.show();
            this.button_connect2.actor.show()
        }
        // Update checboxes
        this.checkbox_reconnect.setToggleState(this.reconnect); // in left-click menu
        this.checkbox_reconnect2.setToggleState(this.reconnect); // in right-click menu
    } // End of on_checkbox_reconnect_changed

    on_button_connect(toggleMenu=true) {
        if (this.is_deactivated) this.switch_activation();
        if (this.use_symbolic_icons) {
            this._applet_icon.style = "color: grey;"
        } else {
            this.vpnIcon = this.vpnwait ;
            this.set_applet_icon_path(this.vpnIcon);
        }

        let l=this.SMCItems.length;
        for (let i=0; i<l; i++) {
            this.SMCItems[i].setSensitive(false)
        }

        if (this.vpnInterface != "" && this.vpnName != "") {
            if (this.vpnStatus != "on") {
                //this.vpnIcon = this.vpnwait;
                //this.set_applet_icon_path(this.vpnIcon);
                this.vpnStatusOld = this.vpnStatus;
                this.vpnStatus = "waiting";
                GLib.spawn_command_line_async('bash -c \'/usr/bin/nmcli connection up "' + this.vpnName + '" > /dev/null \'');
                this.disconnectedByUser = false
            } else {
                GLib.spawn_command_line_async('bash -c \'/usr/bin/nmcli connection down "' + this.vpnName + '" > /dev/null \'');
                this.disconnectedByUser = true
            }
        }

        for (let i=0; i<l; i++) {
            if (this.SMCItems[i].label.text != this.vpnName) {
                this.SMCItems[i].setSensitive(true)
            }
        }
        if (toggleMenu) this.menu.toggle(); // closes the opened menu
    } // End of on_button_connect

    change_connection(new_co) {
        if (this.is_deactivated) this.switch_activation();
        let l=this.SMCItems.length;
        for (let i=0; i<l; i++) {
            this.SMCItems[i].setSensitive(false)
        }

        if (this.vpnStatus == "on") {
            if (this.use_symbolic_icons) {
                this._applet_icon.style = "color: grey;"
            } else {
                this.vpnIcon = this.vpnwait ;
                this.set_applet_icon_path(this.vpnIcon);
            }
            this.vpnStatusOld = "on";
            this.vpnStatus = "waiting";

            let [res, out, err, status] = GLib.spawn_command_line_sync('bash -c \'/usr/bin/nmcli connection down "' + this.vpnName + '" > /dev/null \'')
        }

        this.activityLog.log(_("Switching to: ") + new_co);
        GLib.spawn_command_line_async('bash -c \'/usr/bin/nmcli connection up "' + new_co + '" > /dev/null \'');

        for (let i=0; i<l; i++) {
            if (this.SMCItems[i].label.text == new_co) {
                this.SMCItems[i].setShowDot(true);
            } else {
                this.SMCItems[i].setShowDot(false);
                this.SMCItems[i].setSensitive(true)
            }
        }
        this.vpnName = new_co;
    } // End of change_connection

    monitorTimestamps() {
        let timestampsFile = Gio.file_new_for_path("/var/lib/NetworkManager/timestamps");
        if (timestampsFile.query_exists(null)) {
            try {
                let monitor = timestampsFile.monitor(0, null);
                let Id = monitor.connect('changed', () => this.updateLoop());
                this.monitors.push([monitor, Id]);
            } catch(e) {
                log("Unable to monitor the /var/lib/NetworkManager/timestamps file!", e)
            }
        }
    } // End of monitorTimestamps

    monitorTun0() {
        let sysClassNet = Gio.file_new_for_path("/sys/class/net");
        if (sysClassNet.query_exists(null)) {
            try {
                let monitor = sysClassNet.monitor_directory(0, null);
                let Id = monitor.connect('changed', () => this.updateLoop());
                this.monitors.push([monitor, Id]);
            } catch(e) {
                log("Unable to monitor the /sys/class/net directory!", e)
            }
        }
    } // End of monitorTun0

    // ++ Build the Right Click Context Menu
    buildContextMenu() {
        //try {
            this._applet_context_menu.removeAll();
            // Header
            this.contextmenuitemHead1 = new PopupMenu.PopupMenuItem(_("VPN Look-Out Applet"), {
                reactive: false
            });
            this._applet_context_menu.addMenuItem(this.contextmenuitemHead1);

            // Info: Connection Status
            let message = this.is_deactivated ? _("vpnLookOut is deactivated") : _("Waiting for VPN interface information");

            this.contextmenuitemInfo2 = new PopupMenu.PopupMenuItem("  " + message, {
                reactive: false
            });
            this._applet_context_menu.addMenuItem(this.contextmenuitemInfo2);

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            if (this.dependenciesMet) {

                // button connect/disconnect
                this.button_connect2 = new PopupMenu.PopupSwitchMenuItem(_("Connection ON/OFF"), false);
                this.button_connect2.connect("toggled", () => this.on_button_connect());
                this._applet_context_menu.addMenuItem(this.button_connect2);
                // this button must appear only if auto-reconnect is inactive
                if (this.vpnInterface == "" || this.vpnName == "" || (this.reconnect && !this.respectUserRequest)) {
                    this.button_connect2.actor.hide()
                } else {
                    this.button_connect2.actor.show()
                }

                this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // checkbox Connect at start-up
                this.checkbox_connectAtStartup2 = new PopupMenu.PopupSwitchMenuItem(_("Connect to VPN as this applet starts."), this.connectAtStartup);
                this.checkbox_connectAtStartup2.connect("toggled", () => this.on_checkbox_connectAtStartup_changed());
                this._applet_context_menu.addMenuItem(this.checkbox_connectAtStartup2);

                // checkbox Try to reconnect
                this.checkbox_reconnect2 = new PopupMenu.PopupSwitchMenuItem(_("Try to reconnect to VPN when it shuts down incidentally."), this.reconnect);
                this.checkbox_reconnect2.connect("toggled", () => this.on_checkbox_reconnect_changed());
                this._applet_context_menu.addMenuItem(this.checkbox_reconnect2);

                /*
                // checkboxes Transmission
                this.checkbox_stopTransmission2 = new PopupMenu.PopupSwitchMenuItem(_("Shut down properly Transmission as soon as VPN falls."), this.stopTransmission);
                // this.checkbox_stopTransmission2.connect("toggled", Lang.bind(this, this.on_checkbox_stopTransmission_changed));
                this.checkbox_stopTransmission2.connect("toggled", () => this.on_checkbox_stopTransmission_changed());
                this._applet_context_menu.addMenuItem(this.checkbox_stopTransmission2);

                this.checkbox_restartTransmission2 = new PopupMenu.PopupSwitchMenuItem(_("Try to restart Transmission as soon as VPN restarts."), this.restartTransmission);
                // this.checkbox_restartTransmission2.connect("toggled", Lang.bind(this, this.on_checkbox_restartTransmission_changed));
                this.checkbox_restartTransmission2.connect("toggled", () => this.on_checkbox_restartTransmission_changed());
                this._applet_context_menu.addMenuItem(this.checkbox_restartTransmission2);
                */

                this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // Help
                this.help2 = new PopupMenu.PopupIconMenuItem(_("Help..."), "folder-documents-symbolic", St.IconType.SYMBOLIC);
                this.help2.connect('activate', (event) => {
                    GLib.spawn_command_line_async('xdg-open ' + this.helpfile);
                    // GLib.spawn_command_line_async(this.textEd + ' ' + this.helpfile + ' &');
                    // if (this.textEd === "grip -b") GLib.spawn_command_line_async("bash -c 'sleep 60 && killall -15 grip'");
                });

                this._applet_context_menu.addMenuItem(this.help2);

            } else {
                this.contextmenuitemInfo2.label.text = "  " + _("Some dependencies are not installed!");
            }
        //} catch (e) {
        //  global.logError(e);
        //}
    } // End of buildContextMenu

    //++ Build the Left Click Menu
    makeMenu() {
        //try {
            this.menu.removeAll();

            // Head
            this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("VPN Look-Out Applet"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemHead1);

            this.menuitemInfo2 = new PopupMenu.PopupMenuItem("  ", {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo2);


            if (this.dependenciesMet) {
                // All dependencies are met, we can continue :

                let message = this.is_deactivated ? _("vpnLookOut is deactivated") : _("Waiting for VPN interface information");

                // Status Info
                this.menuitemInfo2.label.text = "  " + message ;

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                if (!this.is_deactivated) {
                    // button connect/disconnect
                    this.button_connect = new PopupMenu.PopupSwitchMenuItem(_("Connection ON/OFF"), false);
                    this.button_connect.connect("toggled", () => this.on_button_connect());
                    this.menu.addMenuItem(this.button_connect);
                    // this button must appear only if auto-reconnect is inactive
                    if (this.vpnInterface == "" || this.vpnName == "" || (this.reconnect && !this.respectUserRequest)) {
                        this.button_connect.actor.hide()
                    } else {
                        this.button_connect.actor.show()
                    }

                    // ++ Set up sub menu for Connections Items
                    this.subMenuConnections = new PopupMenu.PopupSubMenuMenuItem(_("Connections"));
                    this.menu.addMenuItem(this.subMenuConnections);

                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                    this.vpnNames = this.get_vpn_names();
                    this.SMCItems = []; // Items of subMenuConnections (SMC)
                    let l=this.vpnNames.length;
                    for (let i=0; i<l ; i++) {
                        let name=this.vpnNames[i];
                        this.SMCItems[i] = new PopupMenu.PopupIndicatorMenuItem(name);
                        this.SMCItems[i].connect('activate', (event) => this.change_connection(""+name));
                        if (name===this.vpnName) {
                            //this.SMCItems[i].setOrnament(PopupMenu.OrnamentType.CHECK, true);
                            this.SMCItems[i].setShowDot(true);
                            this.SMCItems[i].setSensitive(false)
                        }
                        this.subMenuConnections.menu.addMenuItem(this.SMCItems[i])
                    };
                    // Display this submenu only if there are more than one connection
                    if (this.SMCItems.length < 2) {
                        this.subMenuConnections.actor.hide()
                    } else {
                        this.subMenuConnections.actor.show()
                    }

                    // checkbox Connect at start-up
                    this.checkbox_connectAtStartup = new PopupMenu.PopupSwitchMenuItem(_("Connect to VPN as this applet starts."), this.connectAtStartup);
                    this.checkbox_connectAtStartup.connect("toggled", () => this.on_checkbox_connectAtStartup_changed());
                    this.menu.addMenuItem(this.checkbox_connectAtStartup);

                    // checkbox reconnect
                    this.checkbox_reconnect = new PopupMenu.PopupSwitchMenuItem(_("Try to reconnect to VPN when it shuts down incidentally."), this.reconnect);
                    this.checkbox_reconnect.connect("toggled", () => this.on_checkbox_reconnect_changed());
                    this.menu.addMenuItem(this.checkbox_reconnect);

                    /*
                    // checkboxes about Transmission
                    this.checkbox_stopTransmission = new PopupMenu.PopupSwitchMenuItem(_("Shut down properly Transmission as soon as VPN falls."), this.stopTransmission);
                    // this.checkbox_stopTransmission.connect("toggled", Lang.bind(this, this.on_checkbox_stopTransmission_changed));
                    this.checkbox_stopTransmission.connect("toggled", () => this.on_checkbox_stopTransmission_changed());
                    this.menu.addMenuItem(this.checkbox_stopTransmission);

                    this.checkbox_restartTransmission = new PopupMenu.PopupSwitchMenuItem(_("Try to restart Transmission as soon as VPN restarts."), this.restartTransmission);
                    // this.checkbox_restartTransmission.connect("toggled", Lang.bind(this, this.on_checkbox_restartTransmission_changed));
                    this.checkbox_restartTransmission.connect("toggled", () => this.on_checkbox_restartTransmission_changed());
                    this.menu.addMenuItem(this.checkbox_restartTransmission);
                    */
                }

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // button Torrent Clients Management...
                let configure = new PopupMenu.PopupIconMenuItem(_("VPN-related Apps Manager") + "...", "system-run", St.IconType.SYMBOLIC);
                configure.connect("activate", () => {
                    Util.spawnCommandLine("cinnamon-settings applets " + UUID + " -t 3 " + this.instanceId);
                });
                this.menu.addMenuItem(configure);

                // view log file
                this.view_log = new PopupMenu.PopupIconMenuItem(_("View Activity Logs"), "folder-documents-symbolic", St.IconType.SYMBOLIC);
                this.view_log.connect('activate', (event) => {
                    this.activityLog.display_logs();
                    //GLib.spawn_command_line_async('xdg-open ' + this.activityLog.log_file_path());
                    // GLib.spawn_command_line_async(this.textEd + ' ' + this.helpfile + ' &');
                    // if (this.textEd === "grip -b") GLib.spawn_command_line_async("bash -c 'sleep 60 && killall -15 grip'");
                });

                this.menu.addMenuItem(this.view_log);

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // deactivate button
                this.deactivate_button = new PopupMenu.PopupIconMenuItem(this.active_status_message, this.active_status_icon, St.IconType.SYMBOLIC);
                this.deactivate_button.connect('activate', (event) => {
                    if (this.is_deactivated) this.reactivationRequested = true;
                    this.switch_activation();
                });
                this.menu.addMenuItem(this.deactivate_button);
            } else {
                this.menuitemInfo2.label.text = "  " + _("Some dependencies are not installed!");
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Access to System Network Settings
            this.menu.addSettingsAction(_("Network Settings"), 'network');
            //this.menu.addSettingsAction(_("Connection Info"),'connections-read');

            // Access to Network Manager: Connection editor
            this.menu.addAction(_("Network Connections"), () => {
                Util.spawnCommandLine("nm-connection-editor");
            });

        //} catch (e) {
            //global.logError(e);
        //}
    } // End of makeMenu

    switch_activation() {
        this.is_deactivated = !this.is_deactivated;
        this.active_status_message = this.is_deactivated ? _("Activate vpnLookOut") : _("Deactivate vpnLookOut");
        this.active_status_icon = this.is_deactivated ? "media-playback-start-symbolic" : "media-playback-pause-symbolic";
        if (this.is_deactivated) {
            this.activityLog.log(_("vpnLookOut deactivated"));
            if (this.use_symbolic_icons) {
                this._applet_icon.style = "color: grey;"
            } else {
                this.vpnIcon = this.vpnwait ;
                this.set_applet_icon_path(this.vpnIcon);
            }
            this.vpnStatusOld = this.vpnStatus;
            this.vpnStatus = "waiting";
            this.set_applet_tooltip(_("vpnLookOut deactivated") + "\n\n" + this.keybinding + " " + _("or Middle-Click to activate"));
        } else {
            this.activityLog.log(_("vpnLookOut reactivated"));
            this._on_reload_this_applet_pressed();
        }
    } // End of switch_activation

    //++ Handler for when the applet is clicked.
    on_applet_clicked(event) {
        this.updateLoop();

        if (this.vpnNames === undefined || this.vpnNames !== this.get_vpn_names()) {
            this.makeMenu()
        }

        this.menu.toggle();
    } // End of on_applet_clicked

    // This updates the numerical display in the applet and in the tooltip
    updateUI() {
        let command;
        var tip = "", kbdg = this.keybinding;
        if (this.dependenciesMet) {
            // Get the VPN Status ('on', 'off' or 'waiting')
            this.vpnStatusOld = this.vpnStatus;

            if (this.vpnInterface != "") {
                let iface = Gio.file_new_for_path("/sys/class/net/%s".format(this.vpnInterface));
                this.vpnStatus = iface.query_exists(null) ? "on" : "off";
            } else {
                this.vpnStatus = "waiting"
            }
            /*
            this.vpnStatus = GLib.file_get_contents("/tmp/.vpn_status").toString();
            if ( this.vpnStatus.toString().trim().length > 6 ) { // this.vpnStatus string starts by 'true,'
                 this.vpnStatus = this.vpnStatus.toString().trim().substr(5); // removing 'true,'
                 //this.vpnStatusOld = this.vpnStatus;
            } else {
                 //this.vpnStatus = this.vpnStatusOld;
                 this.vpnStatus = "waiting"
            }
            */

            this.vpnMessage = " " ; // let it with space character ; not empty.

            // Now select icon and message to display, also determine VPN Name and Transmission policy
            if (this.vpnStatus == "on") { // VPN is connected
                if (this.use_symbolic_icons) {
                    this._applet_icon.style = "color: green;"
                } else {
                    this.vpnIcon = this.vpnon ;
                    this.set_applet_icon_path(this.vpnIcon);
                }
                if (this.vpnInterface != "" && this.vpnName != "") {
                    //this.button_connect.setStatus(_("Click to disconnect from VPN")+' '+this.vpnName);
                    this.button_connect.setStatus(this.vpnName);
                    this.button_connect.setToggleState(true);
                    //this.button_connect2.setStatus(_("Click to disconnect from VPN")+' '+this.vpnName);
                    this.button_connect2.setStatus(this.vpnName);
                    this.button_connect2.setToggleState(true)

                    if (this.reconnect && !this.respectUserRequest) {
                        this.button_connect.actor.hide()
                    } else {
                        this.button_connect.actor.show();
                        tip = kbdg + " " + _("or Middle-Click to disconnect")
                    }
                }
                this.alertFlag = false ;
                let vpnName = GLib.file_get_contents("/tmp/.vpn_name").toString().trim().substr(5).split(';')[0];
                if (vpnName.toString() != "") {
                    this.vpnName = vpnName.toString();
                }

                let vpnMessage2 = "";
                if (this.vpnInterface != "") {
                    vpnMessage2 = vpnMessage2 + " / "+ this.vpnInterface
                }

                this.vpnMessage = _("Connected") + ' (' + this.vpnName + vpnMessage2 + ')' ;
                if (this.vpnStatusOld === "off") {
                    this.activityLog.log(this.vpnMessage);
                }

                if (this.manageClients===true) {
                    let client;
                    for (var i=0; i < this.clientsList.length; i++) {
                        client = this.clientsList[i];
                        if (client["restart"]===true && this.clientStoppedByApplet[client["command"]]===true) {
                            let [res, out, err, status] = GLib.spawn_command_line_sync('pidof ' + client["command"]);
                            // res is a boolean : true if command line has been correctly executed
                            // out is the return of the script (as that is sent by 'echo' command in a bash script)
                            // err is the error message, if an error occured
                            // status is the status code (as that is sent by an 'exit' command in a bash script)
                            //log("res="+res+"\nout=\""+out+"\"\nerr="+err+"\nstatus="+status);
                            if (status !== 0) {
                                let command = 'sh ' + this.startClientScript + ' ' + client["command"];
                                GLib.spawn_command_line_async(command);
                                this.activityLog.log(_("Started by vpnLookOut: ") + client["name"])
                            }
                        }
                    }
                }
            } else if (this.vpnStatus == "off") { // VPN is disconnected
                if (this.use_symbolic_icons) {
                    this._applet_icon.style = "color: #f57900;"
                } else {
                    this.vpnIcon = this.vpnoff;
                    this.set_applet_icon_path(this.vpnIcon);
                }
                this.vpnMessage = _("Disconnected");
                if (this.vpnStatusOld === "on") this.activityLog.log(this.vpnMessage);

                // Stop all VPN-related apps that are declared 'VPN only':
                if (this.manageClients===true) {
                    let client;
                    for(var i=0; i < this.clientsList.length; i++) {
                        client = this.clientsList[i];
                        if (client["vpnOnly"]===true) {
                            let [res, out, err, status] = GLib.spawn_command_line_sync('pidof ' + client["command"]);
                            // res is a boolean : true if command line has been correctly executed
                            // out is the return of the script (as that is sent by 'echo' command in a bash script)
                            // err is the error message, if an error occured
                            // status is the status code (as that is sent by an 'exit' command in a bash script)
                            //log("res="+res+"\nout=\""+out+"\"\nerr="+err+"\nstatus="+status);
                            if (status === 0) {
                                command = 'sh ' + this.stopClientScript + ' ' + client["command"] ;
                                this.clientStoppedByApplet[client["command"]] = GLib.spawn_command_line_async(command);
                                this.activityLog.log(_("Blocked by vpnLookOut: ") + client["name"])
                            }
                        }
                    }
                    //global.log(this.clientStoppedByApplet)
                };

                if (this.vpnInterface != "" && this.vpnName != "") {
                    //this.button_connect.setStatus(_("Click to connect to VPN")+' '+this.vpnName);
                    this.button_connect.setStatus("(" + this.vpnName + ")");
                    this.button_connect.setToggleState(false);
                    //this.button_connect2.setStatus(_("Click to connect to VPN")+' '+this.vpnName);
                    this.button_connect2.setStatus("(" + this.vpnName + ")");
                    this.button_connect2.setToggleState(false)

                    if (this.reconnect) {
                        if (this.respectUserRequest || this.vpnStatus !== "on") {
                            this.button_connect.actor.show();
                            tip = kbdg + " " + _("or Middle-Click to connect")
                        } else {
                            this.button_connect.actor.hide()
                        }
                    } else {
                        this.button_connect.actor.show();
                        tip = kbdg + " " + _("or Middle-Click to connect")
                    }
                }

                if ( !this.alertFlag ) {
                    if ( this.useSoundAlert ) { // Sound alert
                        GLib.spawn_command_line_async('play "/usr/share/sounds/freedesktop/stereo/phone-outgoing-busy.oga"') ;
                    } ;
                    if ( this.reconnect && !(this.respectUserRequest && this.disconnectedByUser) ) {
                        command = 'bash -c \'/usr/bin/nmcli connection up "' + this.vpnName +'" > /dev/null \'';
                        GLib.spawn_command_line_async(command)
                    };
                    if (this.manageClients===true) {
                        let client;
                        for(var i=0; i < this.clientsList.length; i++) {
                            client = this.clientsList[i];
                            if (client["shutdown"]===true) {
                                let [res, out, err, status] = GLib.spawn_command_line_sync('pidof ' + client["command"]);
                                // res is a boolean : true if command line has been correctly executed
                                // out is the return of the script (as that is sent by 'echo' command in a bash script)
                                // err is the error message, if an error occured
                                // status is the status code (as that is sent by an 'exit' command in a bash script)
                                //log("res="+res+"\nout=\""+out+"\"\nerr="+err+"\nstatus="+status);
                                if (status === 0) {
                                    command = 'sh ' + this.stopClientScript + ' ' + client["command"] ;
                                    this.clientStoppedByApplet[client["command"]] = GLib.spawn_command_line_async(command);
                                    this.activityLog.log(_("Stopped by vpnLookOut: ") + client["name"])
                                }
                            }
                        }
                        //global.log(this.clientStoppedByApplet)
                    };
                    this.alertFlag = true
                }
            } else { // Waiting about VPN status
                if (this.use_symbolic_icons) {
                    this._applet_icon.style = "color: grey;"
                } else {
                    this.vpnIcon = this.vpnwait ;
                    this.set_applet_icon_path(this.vpnIcon);
                }
            }
            // set Tooltip
            if (tip !== " ") {
                this.set_applet_tooltip(_("VPN:") + " " + this.vpnMessage + "\n\n" + tip)
            } else {
                this.set_applet_tooltip(_("VPN:") + " " + this.vpnMessage)
            }
            // set Menu Item Info
            this.menuitemInfo2.label.text = "  " + _("VPN:") + " " + this.vpnMessage ;
            this.contextmenuitemInfo2.label.text = "  " + _("VPN:") + " " + this.vpnMessage ;
            // Get VPN Status via asyncronous script ready for next cycle
            GLib.spawn_command_line_async('sh ' + this.vpnscript + ' ' + this.vpnInterface);

        }
    } // End of updateUI

    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop() {
        //if (this.loopId > 0) {
            //Mainloop.source_remove(this.loopId);
        //}
        //this.loopId = 0;
        if (this.is_deactivated) {
            this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
            return
        }
        this.set_icons();
        if (!this.dependenciesMet && this.are_dependencies_installed()) {
            // At this time, the user just finished to install all dependencies.
            this.dependenciesMet=true;
            try { // Do NOT remove this try/catch !!!
                if (this.notification != null) {
                    this.notification.destroy(2) // Destroys the precedent critical notification.
                }
            } catch(e) {
                //global.log(e); // Not an error. Simply, the user has clicked on the notification, destroying it.
            }
            // Notification (temporary)
            let notifyMessage = _(this.appletName) + " " + _("is fully functional.");
            Main.notify(_("All dependencies are installed"), notifyMessage);

            // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
            this.on_applet_removed_from_panel();
            // Reload this applet with dependencies installed
            GLib.spawn_command_line_async('sh ' + SCRIPTS_DIR + '/reload_ext.sh');
        }

        // Inhibits also after the applet has been removed from the panel
        if (this.applet_running == true) {
            // No VPN interface in settings ?
            if (this.vpnInterface=="") {
                this.vpn_interface_detect() // Detect it !
            }

            this.updateUI(); // update icon and tooltip

            // Force truncation of the log file, once a day:
            this.next_truncation -= this.refreshInterval;
            if (this.next_truncation < 0) {
                this.next_truncation = 86400; // 86400 seconds = 1 day
                this.activityLog.truncate_log_file();
            }

            // One more loop !
            this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
        }
    } // End of updateLoop

    // ++ This finalizes the settings when the applet is removed from the panel
    on_applet_removed_from_panel() {
        // inhibit the update timer when applet removed from panel
        this.applet_running = false;
        var monitor, Id;
        for (let tuple of this.monitors) {
            [monitor, Id] = tuple;
            monitor.disconnect(Id)
        }
        this.monitors = [];
        if (this.loopId > 0) {
          Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        Main.keybindingManager.removeHotKey(UUID);
    }

    _on_reload_this_applet_pressed() {
        // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
        //this.on_applet_removed_from_panel();

        if (this.loopId > 0) {
          Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        // Reload this applet
        Extension.reloadExtension(UUID, Extension.Type.APPLET);
      } // End of _on_reload_this_applet_pressed

}; // End of class vpnLookOut

function main(metadata, orientation, panelHeight, instance_id) {
    return new vpnLookOut(metadata, orientation, panelHeight, instance_id);
}
/*
## Changelog
Cf. ../CHANGELOG.md
*/
