/* Spices Update (SpicesUpdate@claudiux) */
//Applet:
const { IconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
//Settings:
const { AppletSettings } = imports.ui.settings;
//St:
const { Icon, IconType, BoxLayout, Align, Label, TextureCache, Side, Widget, TextDirection } = imports.gi.St;
//Clutter:
const { Image, Actor, Color, RotateAxis } = imports.gi.Clutter;
//GdkPixbuf:
const { Pixbuf } = imports.gi.GdkPixbuf;
//Cogl:
const { PixelFormat } = imports.gi.Cogl;
//PopupMenu:
const { PopupMenuManager, PopupMenuItem, PopupSeparatorMenuItem, PopupIndicatorMenuItem, PopupIconMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
//Lang:
const Lang = imports.lang;
//GLib:
const { LogLevelFlags, getenv, get_language_names, filename_to_uri, find_program_in_path, mkdir_with_parents, file_set_contents, file_get_contents, markup_escape_text, SOURCE_CONTINUE, SOURCE_REMOVE } = imports.gi.GLib;
//Gio:
const { network_monitor_get_default, NetworkConnectivity, file_new_for_path, icon_new_for_string, FileQueryInfoFlags, FileType, Settings, FileCreateFlags } = imports.gi.Gio;
//Gtk:
const Gtk = imports.gi.Gtk; //  /!\ Gtk.Label != St.Label
// Gdk:
const { Display } = imports.gi.Gdk;
//Mainloop:
const { source_remove, timeout_add_seconds } = imports.mainloop;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Util = imports.misc.util;
const Extension = imports.ui.extension;
const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;
const Json = imports.gi.Json;
imports.gi.versions.Soup = '3.0';
const Soup = imports.gi.Soup;
const {SignalManager} = imports.misc.signalManager;
const Cinnamon = imports.gi.Cinnamon;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;

const {to_string} = require("to-string");

const {HttpLib, Jobs} = require("httpLib");
// constants:
const { UUID, HOME_DIR, APPLET_DIR, SCRIPTS_DIR, ICONS_DIR, HELP_DIR, CS_PATH, URL_SPICES_HOME, CACHE_DIR, CACHE_UPDATER, THUMBS_UPDATER, THUMB_DOWNLOADER, TYPES, URL_MAP, CACHE_MAP, DIR_MAP, DCONFCACHEUPDATED, DOWNLOAD_TIME, TAB, SORT, _, EXP1, EXP2, EXP3, DEBUG, RELOAD, capitalize, log, logDebug, logError } = require("./constants");

// Waiting times for downloads:
//~ var WAITING = {}
//~ for (let t of TYPES) WAITING[t] = 30000; // 30 seconds

const {versionCompare} = require("./utils");

const ICONTHEME = Gtk.IconTheme.get_default();
ICONTHEME.prepend_search_path(ICONS_DIR);
//ICONTHEME.add_resource_path(ICONS_DIR);


Util.spawnCommandLineAsync("/bin/sh -c '%s/witness-debian.sh'".format(SCRIPTS_DIR));



function getImageAtScale(imageFileName, width, height) {
    let pixBuf = Pixbuf.new_from_file_at_size(imageFileName, width, height);
    let image = new Image();
    image.set_data(
        pixBuf.get_pixels(),
        pixBuf.get_has_alpha() ? PixelFormat.RGBA_8888 : PixelFormat.RGBA_888,
        width, height,
        pixBuf.get_rowstride()
    );
    let actor = new Actor({width: width, height: height});
    actor.set_content(image);
    return actor;
}


function SU_setup_logging(quiet = false, verbose = false) {
    if (quiet) {
        // quiet mode
        hidden_levels = LogLevelFlags.LEVEL_MESSAGE | LogLevelFlags.LEVEL_INFO | LogLevelFlags.LEVEL_DEBUG | LogLevelFlags.LEVEL_WARNING;
    } else if (verbose) {
        // verbose mode
    } else {
        // normal mode
    }
}

const SpicesUpdate_Notification = require("./notifications");

let SU_Notification = SpicesUpdate_Notification.SU_Notification;

/**
 * criticalNotify:
 * (Code from imports.ui.main ; modified to return notification, to allow to destroy it.)
 * @msg: A critical message
 * @details: Additional information
 */
var messageTray = new MessageTray.MessageTray();
let source = new MessageTray.SystemNotificationSource();
messageTray.add(source);

function criticalNotify(msg, details, icon, button=[]) {
    let notification = new SU_Notification(source, msg, details, { icon: icon, bodyMarkup: true });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.CRITICAL);
    if (button!="" && button != []) {
        // button structure: [label, action, command]
        notification.addButton(button[1], button[0]);
        notification.connect("action-invoked", (self, action) => {
            if (action === button[1]) {
                Util.spawnCommandLineAsync(button[2]);
            }
        });
    }
    source.notify(notification);
    return notification;
}

/** return how many times 10m goes into the utc timestamp.
 * This gives us a unique value every 10 minutes to allow
 * the server cache to be utilized.
**/
const TIMESTAMP_LIFETIME_MINUTES = 10;

function get_current_timestamp() {
    let seconds = parseInt(new Date / 1000);
    return parseInt(seconds / (TIMESTAMP_LIFETIME_MINUTES * 60))
}

//~ logDebug("current timestamp: "+get_current_timestamp());

/**
 * Class SpicesUpdate
 */
class SpicesUpdate extends IconApplet {

    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.instanceId = ""+instance_id;
        this.setAllowedLayout(AllowedLayout.BOTH); // Can be used on horizontal or vertical panels.
        this.set_applet_icon_symbolic_name("spices-update");
        this.default_tooltip = "%s %s".format(_("Spices Update"), metadata.version);
        this.tooltip_contents = "<b>" + this.default_tooltip + "</b>" + "\n%s".format(_("Middle-Click to Refresh"));
        //this.set_applet_tooltip(this.tooltip_contents, true);

        this.img_path = ICONS_DIR + "/spices-update-symbolic.svg";
        //this.general_frequency = 10; //(seconds between two loops)
        this.isUpdatingUI = false;
        this.angle = 0;
        this.do_rotation = false;
        this.interval = null;
        this.ui_scale = global.ui_scale;

        // To alert user when the Cinnamon web-server is down:
        this.cinnamon_server_is_down = false;

        // Cinnamon Update Manager: DOESN'T EXIST! (only for Python3)
        //~ this.updater = new Cinnamon.UpdateManager();

        // To make http requests:
        this.http = new HttpLib();

        // To be sure that the scripts will be executable:
        Util.spawnCommandLineAsync("/bin/bash -c 'cd %s && chmod 755 *.py *.sh'".format(SCRIPTS_DIR), null, null);

        // Move themes to their new location (from ~/.themes to ~/.local/share/themes):
        Util.spawnCommandLineAsync(SCRIPTS_DIR + "/move_themes.sh")

        //http session:
        //~ this.define_http_session();

        // Messages, notifications and menu contents:
        this.notification = null;

        this.force_notifications = false; // Set to true for tests.
        //~ if (!QUICK()) this.force_notifications = false;

        this.notifications_about_updates = {};
        this.notifications_about_news = {};
        this.new_message =  {};
        this.new_watch_message =  {};
        this.old_message = {};
        this.old_watch_message = {};
        this.OKtoPopulateSettings = {};
        this.unprotectedDico = {};
        this.unprotectedList = {};
        this.cache = {};
        //~ this.oldCache = {};
        this.menuDots = {};
        this.monitorsPngId = {};
        this.nb_in_menu = {};
        this.new_Spices = {};
        for (let t of TYPES) {
            this.notifications_about_updates[t] = [];
            this.notifications_about_news[t] = [];
            this.new_message[t] = "";
            this.new_watch_message[t] = "";
            this.old_message[t] = "";
            this.old_watch_message[t] = "";
            this.OKtoPopulateSettings[t] = true;
            this.unprotectedDico[t] = {};
            this.unprotectedList[t] = [];
            this.cache[t] = "{}";
            //~ this.oldCache[t] = "{}";
            this.menuDots[t] = false;
            this.monitorsPngId[t] = 0; // Monitoring png directories: Ids
            this.nb_in_menu[t] = 0;
            this.new_Spices[t] = [];
        }

        this.timeoutId = null;
        this.isProcessing = false;
        this.loopCacheIntervalId = null;

        // Default icon color
        this.defaultColor = "white";

        // Monitoring metadata.json files, png directories and network
        this.monitors = [];
        this.alreadyMonitored = []; // Contains the UUIDs of xlets already monitored, to avoid multiple monitoring.

        // Monitoring network:
        this.monitor_interfaces();

        // Count of Spices to update
        this.nb_to_update = 0;

        // Count of new Spices
        this.nb_to_watch = 0;

        // Types to check
        this.types_to_check = [];
        this.types_to_check_new = [];

        this.details_by_uuid = {};
        this.forceRefresh = false;
        this.refresh_requested = false;
        this.applet_running = true;
        this.loopId = null;
        this.first_loop = true; // To do nothing for 1 minute.

        // ++ Settings
        this.get_SU_settings();

        this._set_SU_checks();


        this.on_orientation_changed(orientation);

        // Translated help file (html)
        this.help_file = this.get_translated_help_file();

        // Init lists of Spices:
        for (let t of TYPES) {
            this.populateSettingsUnprotectedSpices(t);
        }

        // Dependencies:
        this.dependenciesMet = this.are_dependencies_installed();
        if (!this.dependenciesMet) this.refreshInterval = 5;

        // ++ Set up Left Click Menu
        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Badge
        this.badge = null;
        this.define_badge();

        // SignalManager
        this.signals = new SignalManager(null);
        this._signalsConnectId = this.signals.connect(global, "scale-changed", () => this.updateUI());

        // Run loop to refresh caches:
        this.disable_system_auto_update();
        let stoId = setTimeout( () => {
            this._loop_refresh_cache();
            clearTimeout(stoId);
            stoId = null;
        }, 20000); // Wait 20 seconds for mintupdate to run correctly.

        //this.loopRefreshId = timeout_add_seconds(907, () => this._loop_refresh_cache()); // 907 is a prime number.
    } // End of constructor

    _loop_refresh_cache() {
        if (this.loopRefreshId) {
            source_remove(this.loopRefreshId);
        }
        this.loopRefreshId = null;
        var is_to_download = false;
        for (let t of TYPES) {
            const jsonFile = file_new_for_path(CACHE_MAP[t]);
            if (jsonFile.query_exists(null)) {
                //~ logDebug(""+CACHE_MAP[t]+" EXISTS!");
                //~ const jsonModifTime = parseInt(jsonFile.query_info("time::modified", FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec);
                const jsonModifTime = jsonFile.query_info("time::modified", FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix();
                //~ logDebug("jsonModifTime = "+jsonModifTime);
                const currentTime = parseInt(new Date / 1000);
                //~ logDebug("currentTime = "+currentTime);
                const difference = parseInt(currentTime - jsonModifTime);
                //~ logDebug("difference = "+difference);
                if (difference > 720) {
                    // the cache is older than 12 minutes (720 seconds)
                    is_to_download = true;
                    break
                }
            } else {
                // the cache doesn't exist
                const jsonDirName = CACHE_DIR + "/" + this._get_singular_type(t);
                mkdir_with_parents(jsonDirName, 0o755);
                is_to_download = true;
            }
        }
        //~ logDebug("is_to_download: "+is_to_download);
        if (is_to_download) {
            //~ logDebug("Cache refresh requested.");
            Util.spawnCommandLineAsync(CACHE_UPDATER+" --update-all");
        }
        is_to_download = undefined;

        if (this.applet_running)
            this.loopRefreshId = timeout_add_seconds(907, () => this._loop_refresh_cache()); // 907 is a prime number.
    } // End of _loop_refresh_cache

    get_SU_settings() {
        this.settings = new AppletSettings(this, UUID, this.instance_id);

        // Setting the this.refreshInterval value:
        this.settings.bind(
            "general_frequency",
            "general_frequency",
            this.on_frequency_changed.bind(this)
        );
        //~ this.refreshInterval = QUICK() ? 720 * this.general_frequency : 3600 * this.general_frequency;
        this.refreshInterval = 3600 * this.general_frequency;

        if (this.settings.getValue("first_time")) {
            // This part of the code will only be executed the very first time SpicesUpdate 6+ is used.
            var isEmpty;
            for (let t of TYPES) {
                isEmpty = this._is_empty_local_dir(t);
                this.settings.setValue("was_empty_%s".format(t), isEmpty);
                this.settings.setValue("check_%s".format(t), !isEmpty);
                this.settings.setValue("check_new_%s".format(t), false);
            }
            this.settings.setValue("first_time", false);
            let icon = new Icon({
                icon_name: "spices-update",
                icon_type: IconType.SYMBOLIC,
                icon_size: 32 });
            criticalNotify(
                _("Spices Update has just been installed or upgraded"),
                _("Certain parameters require your vigilance: some may have been modified; others are new.") +
                "\n\n" + _("Please check your settings using the menu of the SpicesUpdate applet or the button below."),
                icon,
                [_("Spices Update Settings"), "open-settings", "xlet-settings applet SpicesUpdate@claudiux -i %s".format(this.instanceId)]
                );
        }

        // General settings
        this.settings.bind(
            "general_first_check",
            "general_first_check",
            null
        );
        this.first_loop = this.general_first_check;

        this.settings.bind(
            "general_next_check_date",
            "general_next_check_date",
            null
        );
        let now = Math.ceil(Date.now()/1000);
        this.general_next_check_date = (this.first_loop) ? now + 60 : now + 300;
        now = undefined;

        this.settings.bind(
            "general_warning",
            "general_warning",
            this.updateUI.bind(this)
        );

        this.settings.bind(
            "events_color",
            "events_color",
            this.updateUI.bind(this)
        );

        this.settings.bind(
            "processing_color",
            "processing_color",
            this.updateUI.bind(this)
        );

        this.settings.bind(
            "general_notifications",
            "general_notifications",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "general_details_requested",
            "details_requested",
            null
        );

        this.settings.bind(
            "general_show_updateall_button",
            "general_show_updateall_button",
            () => {
                // FUTURE:
                //this.clear_notifications_about_updates(null);
                //this.clear_notifications_about_news(null);
                //this._on_refresh_pressed();
            }
        );
        this.general_show_updateall_button = false;

        this.settings.bind(
            "general_type_notif",
            "general_type_notif",
            null
        );

        this.settings.bind(
            "displayType",
            "displayType",
            this.on_display_type_changed.bind(this)
        );

        this.settings.bind(
            "general_hide",
            "general_hide",
            this.on_display_type_changed.bind(this)
        );

        this.settings.bind(
            "tooltip_max_width_screen_percentage",
            "tooltip_max_width_screen_percentage",
            this.on_tooltip_max_width_screen_percentage_changed.bind(this)
        );

        this.settings.bind(
            "next_type",
            "next_type",
            null
        );
        // Applets
        this.settings.bind(
            "check_applets", // The setting key
            "check_applets", // The property to manage (this.check_applets)
            this.on_settings_changed.bind(this) // Callback when value changes
        );

        this.settings.bind(
            "check_new_applets",
            "check_new_applets",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "exp_applets",
            "exp_applets",
            null
        );
        this.exp_applets = "%s\n%s\n%s".format(EXP1["applets"], EXP2["applets"], EXP3);

        this.settings.bind(
            "unprotected_applets",
            "unprotected_applets",
            this.populateSettingsUnprotectedApplets.bind(this)
        );

        // Desklets
        this.settings.bind(
            "check_desklets",
            "check_desklets",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "check_new_desklets",
            "check_new_desklets",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "exp_desklets",
            "exp_desklets",
            null
        );
        this.exp_desklets = "%s\n%s\n%s".format(EXP1["desklets"], EXP2["desklets"], EXP3);

        this.settings.bind(
            "unprotected_desklets",
            "unprotected_desklets",
            this.populateSettingsUnprotectedDesklets.bind(this)
        );

        // Extensions
        this.settings.bind(
            "check_extensions",
            "check_extensions",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "check_new_extensions",
            "check_new_extensions",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "exp_extensions",
            "exp_extensions",
            null
        );
        this.exp_extensions = "%s\n%s\n%s".format(EXP1["extensions"], EXP2["extensions"], EXP3);

        this.settings.bind(
            "unprotected_extensions",
            "unprotected_extensions",
            this.populateSettingsUnprotectedExtensions.bind(this)
        );

        // Themes
        this.settings.bind(
            "check_themes",
            "check_themes",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "check_new_themes",
            "check_new_themes",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "exp_themes",
            "exp_themes",
            null
        );
        this.exp_themes = "%s\n%s\n%s".format(EXP1["themes"], EXP2["themes"], EXP3);

        this.settings.bind(
            "unprotected_themes",
            "unprotected_themes",
            this.populateSettingsUnprotectedThemes.bind(this)
        );

        // Nemo actions
        this.settings.bind(
            "check_actions",
            "check_actions",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "check_new_actions",
            "check_new_actions",
            this.on_settings_changed.bind(this)
        );

        this.settings.bind(
            "exp_actions",
            "exp_actions",
            null
        );
        this.exp_actions = "%s\n%s\n%s".format(EXP1["actions"], EXP2["actions"], EXP3);

        this.settings.bind(
            "unprotected_actions",
            "unprotected_actions",
            this.populateSettingsUnprotectedActions.bind(this)
        );
    } // End of get_SU_settings

    /**
     * Network session and monitoring
     */
    //~ define_http_session() {
        //~ if (this._httpSession) Util.unref(this._httpSession);
        //~ this._httpSession = new Soup.Session(); // SessionAsync is deprecated. Use Session instead.
    //~ }

    monitor_interfaces() {
        if (this.netMonitor) return;

        this.netMonitors = [];
        try {
            this.netMonitor = network_monitor_get_default();
            let netMonitorId = this.netMonitor.connect(
                'network-changed',
                (monitor, network_available) => this._on_network_changed(monitor, network_available)
            );
            this.netMonitors.push([this.netMonitor, netMonitorId]);
            netMonitorId = undefined;
        } catch(e) {
            logError("Unable to monitor the network interfaces! - " + e)
        }
    }

    _on_network_changed(monitor, network_available) {
        //~ this.define_http_session();
        let connectivity = monitor.get_connectivity();
        if (network_available && (connectivity === NetworkConnectivity.FULL)) {
            //~ logDebug("The network connectivity is now FULL.");
            //~ logDebug("this.netMonitors.length: "+this.netMonitors.length);
            this.applet_running = true;
            let id = setTimeout(() => {
                this.http = new HttpLib();
                //~ this._on_refresh_pressed();
                clearTimeout(id);
                id = null
            }, 30000);
        } else {
            //~ logDebug("The network connectivity has been LOST.");
            //~ logDebug("this.netMonitors.length: "+this.netMonitors.length);
            this.applet_running = false;
        }
        connectivity = undefined;
    }

    /**
     * Badge
     */
    badge_font_size() {
        return Math.max(11, Math.round(this.getPanelIconSize(IconType.SYMBOLIC) / 3))
    }

    horizontal_anchor_x() {
        return this.getPanelIconSize(IconType.SYMBOLIC) + 8
    }

    horizontal_anchor_y() {
        let iconSize = this.getPanelIconSize(IconType.SYMBOLIC);
        let fontSize = this.badge_font_size();

        return fontSize - (iconSize + Math.round((this.panel.height - iconSize) /2))
    }

    vertical_anchor_x() {
        return -Math.round((this.panel.height - this.getPanelIconSize(IconType.SYMBOLIC)) /2)
    }

    vertical_anchor_y() {
        return this.badge_font_size();
    }

    define_badge() {
        let fontSize = this.badge_font_size();
        let badgeSize = (fontSize + 1) * global.ui_scale;
        let iconSize = this.getPanelIconSize(IconType.SYMBOLIC);

        if (this.badge) this.actor.remove_child(this.badge);

        this.badge = new BoxLayout({
            style_class: 'grouped-window-list-badge',
            important: true,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            show_on_set_parent: false,
            //position: new Clutter.Point({x: 0, y: -10}),
        });
        this.numberLabel = new Label({
            style_class: 'grouped-window-list-number-label',
            important: true,
            text: '',
            anchor_x: -3 * global.ui_scale,
        });
        this.numberLabel.clutter_text.ellipsize = false;
        this.badge.add(this.numberLabel, {
            x_align: Align.START,
            y_align: Align.START,
        });
        this.actor.add_child(this.badge);
        this.badge.set_text_direction(TextDirection.LTR);

        this.label = new Label({
            style_class: 'grouped-window-list-button-label',
            important: true,
            text: '',
            x_align: Align.START,
            show_on_set_parent: false,
        });
        this.actor.add_child(this.label);
    } // End of define_badge

    /**
     * get_user_language()
     * Returns the language of the user.
     */
    get_user_language() {
        let _language;
        try {
            _language = ""+get_language_names()[0].split("_")[0];
        } catch(e) {
            // Unable to detect language. Return English by default.
            _language = "en";
        }
        return _language;
    } // End of get_user_language

    /** get_translated_help_file()
     * Returns the help file in html format
     */
    get_translated_help_file() {
        let default_file_name = HELP_DIR + "/en/README.html";
        let help_file = file_new_for_path(default_file_name);
        let language = "";
        let lang = "";
        if (!help_file.query_exists(null)) {
            return null;
        }
        try {
            language = get_language_names().toString().split(",")[0].toString();
        } catch(e) {
            // Unable to detect language. Return English help file by default.
            return default_file_name;
        }
        let file_name = "%s/%s/README.html".format(HELP_DIR, language);
        help_file = file_new_for_path(file_name);
        if (help_file.query_exists(null)) {
            return file_name;
        } else {
            lang = language.split("_")[0].toString();
            if (lang === language) {
                // Not found
                return default_file_name;
            } else {
                file_name = "%s/%s/README.html".format(HELP_DIR, lang);
                help_file = file_new_for_path(file_name);
                if (help_file.query_exists(null)) {
                    return file_name;
                } else {
                    return default_file_name;
                }
            }
        }
        // End of get_translated_help_file
    }

    notify_without_button(message, type, uuid = null, about_updates = true) {
        let source = new MessageTray.SystemNotificationSource();
        if (Main.messageTray) {
            Main.messageTray.add(source);
            let gicon = icon_new_for_string(APPLET_DIR + "/icon.png");
            let icon = new Icon({ gicon: gicon, "icon-size": 32});
            let notification = new MessageTray.Notification(source, _("Spices Update"), message, {icon: icon, bodyMarkup: true});
            notification.setTransient(false);
            notification.setResident(true);
            notification.setUseActionIcons(false);
            about_updates ? this.notifications_about_updates[type].push(notification) : this.notifications_about_news[type].push(notification);
            notification.connect("destroy", (self) => {
                about_updates ? this.old_message[type] = "" : this.old_watch_message[type] = "";
            });
            source.notify(notification);
            notification = undefined;
        }
    } // End of notify_without_button

    notify_with_button(message, type, uuid = null, about_updates = true) {
        let source = new MessageTray.SystemNotificationSource();
        if (Main.messageTray) {
            Main.messageTray.add(source);
            let gicon = icon_new_for_string(APPLET_DIR + "/icon.png");
            let icon = new Icon({ gicon: gicon, "icon-size": 32});
            let notification = new SU_Notification(source, _("Spices Update"), message, {icon: icon, bodyMarkup: true});
            notification.setTransient(false);
            notification.setResident(true);
            notification.setUseActionIcons(true);
            notification._scrollArea["vscrollbar_policy"] = Gtk.PolicyType.AUTOMATIC;
            notification._scrollArea.enable_mouse_scrolling = true;
            let img_uri = filename_to_uri("%s/cs-%s.png".format(ICONS_DIR, ""+type), null);
            if (uuid !== null) {
                let uri= CACHE_DIR + "/" + this._get_singular_type(type) + "/" + uuid + ".png";
                let file = file_new_for_path(uri);
                if (file.query_exists(null)) {
                    img_uri = filename_to_uri(uri, null);
                }
            }
            let img_size = Math.round(notification.IMAGE_SIZE/2);
            let image = TextureCache.get_default().load_uri_async(img_uri, img_size, img_size);
            notification.setImage(image);

            notification.setUseActionIcons(this.general_type_notif === "iconic");

            let buttonLabel = "%s".format(capitalize(type.toString()));
            notification.addButton("su-%s-symbolic".format(type.toString()), _(buttonLabel));

            let buttonLabel2;
            if (this.general_show_updateall_button && about_updates) {
                (uuid !== null) ? buttonLabel2 = _("Update It Now!") : buttonLabel2 = _("Update Them All Now!");
                //notification.addButton("update-all", _(buttonLabel2));
                notification.addButton("software-update-available-symbolic", _(buttonLabel2));
            }

            if (!about_updates) {
                (uuid !== null) ? buttonLabel2 = _("Forget It") : buttonLabel2 = _("Forget Them All");
                notification.addButton("su-forget-symbolic", _(buttonLabel2));
            }

            let buttonLabel3 = _("Refresh");
            //notification.addButton("refresh", _(buttonLabel3));
            notification.addButton("emblem-synchronizing-symbolic", _(buttonLabel3));

            if (about_updates === true) {
                this.notifications_about_updates[type].push(notification);
            } else {
                this.notifications_about_news[type].push(notification);
            }

            notification.connect("action-invoked", (self, action) => {
                        if (action == "su-%s-symbolic".format(""+type)) {
                            Util.spawnCommandLineAsync("%s %s -t %s -s %s".format(CS_PATH, ""+type, TAB, SORT));
                        } else if (action == "software-update-available-symbolic") {
                            Util.spawnCommandLineAsync("%s %s -t %s -s %s -u".format(CS_PATH, ""+type, TAB, SORT));
                            let n = this.notifications_about_updates[type].pop(this.notifications_about_updates[type].indexOf(notification));
                            n.destroy(3);
                        } else if (action == "su-forget-symbolic") {
                            this._forget_new_spices(type);
                            this.clear_notifications_about_news(type);
                        } else if (action == "emblem-synchronizing-symbolic"){
                            if (this.force_notifications === true) {
                                if (about_updates) {
                                    this.destroy_notifications(type, "updates");
                                    //~ this.clear_notifications_about_updates(type);
                                    //~ this.old_message[type] = "";
                                } else {
                                    this.destroy_notifications(type, "news");
                                    //~ this.clear_notifications_about_news(type);
                                    //~ this.old_watch_message[type] = "";
                                }
                            } else {
                                let n = this.notifications_about_updates[type].pop(this.notifications_about_updates[type].indexOf(notification));
                                if (n) n.destroy(3);
                            }
                            about_updates ? this.old_message[type] = "" : this.old_watch_message[type] = "";
                            this._on_refresh_pressed();
                        }
                    });
            notification.connect("destroy", (self) => {
                        about_updates ? this.old_message[type] = "" : this.old_watch_message[type] = "";
                    });
            notification.actor.remove_style_class_name('notification-applet-container');
            notification.actor.add_style_class_name('SU-notification-applet-container');

            let sentences = message.split("\n");

            //notification.actor.style = "min-height: %spx;".format((sentences.length*49 - 32).toString()); //FIXME

            source.notify(notification);
            //notification.emit('done-displaying-content');
            notification = undefined;
        }
    } // End of notify_with_button

    on_notif_for_new_changed() {
        if (!this.notif_for_new) {
            this.nb_to_watch = 0;
            for (let t of TYPES) {
                this.new_Spices[t] = [];
                this.old_watch_message[t] = "";
            }
        }
        this._on_refresh_pressed();
    } // End of on_notif_for_new_changed

    on_orientation_changed (orientation) {
        this.orientation = orientation;
        this.isHorizontal = !(this.orientation == Side.LEFT || this.orientation == Side.RIGHT);
        this._set_main_label();
    } // End of on_orientation_changed

    _set_main_label() {
        if (this.general_hide === true && this.nb_to_update === 0 && this.nb_to_watch === 0) {
            //this.set_applet_label("");
            this.actor.hide();
            return
        }
        this.actor.show();
    } // End of _set_main_label

    on_frequency_changed() {
        if (this.loopId) {
            source_remove(this.loopId);
            this.loopId = null;
        }

        //~ let coeff = QUICK() ? 720 : 3600;
        this.refreshInterval = 3600 * this.general_frequency;
        this.loopId = timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
        //~ coeff = undefined;
    } // End of on_frequency_changed

    on_display_type_changed() {
        // Label
        this._set_main_label();
    } // End of on_display_type_changed

    // ++ Function called when settings are changed
    on_settings_changed() {
        // Label
        this._set_main_label();

        // Refresh intervall:
        this.refreshInterval = 3600 * this.general_frequency;
        //~ if (QUICK()) this.refreshInterval = 720 * this.general_frequency;

        // Types to check
        this.types_to_check = [];
        this.types_to_check_new = [];

        // All xlets
        for (let type of TYPES) {
            let _dir_xlets = file_new_for_path(DIR_MAP[type]);
            let isEmpty = this._is_empty_local_dir(type);
            if (!_dir_xlets.query_exists(null) || isEmpty) {
                this.check[type].set_value(false);
            }
            if (this.check[type].get_value()) {
                this.types_to_check.push(type);
                if (this.check_new[type].get_value())
                    this.types_to_check_new.push(type);
            } else {
                this.check_new[type].set_value(false);
                this.menuDots[type] = false;
            }
            _dir_xlets = undefined;
            isEmpty = undefined;
        }
    } // End of on_settings_changed

    // Buttons in settings:
    on_btn_test_notif_pressed() {
        let details = "";
        if (this.details_requested === true) details = "<i>" + _("With details here, when available.") + "</i>\n\t";
        let message = _("One applet needs update:")
            + "\n<b>%s</b>\n\t".format(UUID) + details + _("Do not matter. This is a FAKE notification, just for the test.");
        if (this.general_type_notif === "minimal") {
            this.notify_without_button(message, TYPES[0]);
        } else {
            this.notify_with_button(message, TYPES[0]);
        }
        details = undefined;
        message = undefined;
    } // End of on_btn_test_notif_pressed

    on_btn_cs_applets_pressed() {
        Util.spawnCommandLineAsync("%s applets -t %s -s %s".format(CS_PATH, TAB, SORT));
    } // End of on_btn_cs_applets_pressed

    on_btn_cs_desklets_pressed() {
        Util.spawnCommandLineAsync("%s desklets -t %s -s %s".format(CS_PATH, TAB, SORT));
    } // End of on_btn_cs_desklets_pressed

    on_btn_cs_extensions_pressed() {
        Util.spawnCommandLineAsync("%s extensions -t %s -s %s".format(CS_PATH, TAB, SORT));
    } // End of on_btn_cs_extensions_pressed

    on_btn_cs_themes_pressed() {
        Util.spawnCommandLineAsync("%s themes -t %s -s %s".format(CS_PATH, TAB, SORT));
    } // End of on_btn_cs_themes_pressed

    on_btn_cs_actions_pressed() {
        Util.spawnCommandLineAsync("%s actions -t %s -s %s".format(CS_PATH, TAB, SORT));
    } // End of on_btn_cs_themes_pressed

    on_tooltip_max_width_screen_percentage_changed() {
        let _screen;
        if (Display.get_default().get_default_screen)
            _screen = Display.get_default().get_default_screen(); // Glib >= 3.20
        else
            _screen = Display.get_default().get_screen(0); // 2.2 <= Glib < 3.20

        this.tooltip_max_width = Math.round(_screen.get_width() * this.tooltip_max_width_screen_percentage / 100);
        _screen = undefined;
    } // End of on_tooltip_max_width_screen_percentage_changed

    _is_empty_local_dir(type) {
        let dir = file_new_for_path(DIR_MAP[type]);
        let isEmpty = true;
        let info;
        if (dir.query_exists(null)) {
            let children = dir.enumerate_children("standard::name,standard::type", FileQueryInfoFlags.NONE, null);
            if ((info = children.next_file(null)) != null) {
                isEmpty = false;
            }
            children.close(null);
            children = undefined;
        }
        info = undefined;
        dir = undefined;
        return isEmpty;
    } // End of _is_empty_local_dir

    _was_empty_local_dir(type) {
        return this.settings.getValue("was_empty_%s".format(type));
    } // End of _was_empty_local_dir

    /**
     * #populateSettingsUnprotectedSpices:
     *
     * this.unprotectedDico["applets"] example:
     {
     "batterymonitor@pdcurtis" : true,
     "Cinnamenu@json" : true,
     "github-projects@morgan-design.com" : true,
     "IcingTaskManager@json" : true,
     "multicore-sys-monitor@ccadeptic23" : true,
     "placesCenter@scollins" : true,
     "sessionManager@scollins" : false,
     "spices-notifier@germanfr" : true,
     "SpicesUpdate@claudiux" : false,
     "sound150@claudiux" : false,
     "vpnLookOut@claudiux" : false, etc...
     }
     * this.unprotectedList["applets"] example:
     [
            {
                "name" : "batterymonitor@pdcurtis",
                "isunprotected" : true,
                "requestnewdownload": false
            },
            {
                "name" : "Cinnamenu@json",
                "isunprotected" : true,
                "requestnewdownload": false
            }, etc...
        ]
        * (true when updates are requested by the user)
    */
    populateSettingsUnprotectedSpices(type) {
        if (this.OKtoPopulateSettings[type] != true) return;

        // Prevents multiple access to the json config file of SpiceUpdate@claudiux:
        this.OKtoPopulateSettings[type] = false;
        this.unprotectedList[type] = [];
        this.unprotectedDico[type] = {};
        var unprotectedSpices = null;
        switch (type) {
            case "applets":
                unprotectedSpices = this.unprotected_applets;
                break;
            case "desklets":
                unprotectedSpices = this.unprotected_desklets;
                break;
            case "extensions":
                unprotectedSpices = this.unprotected_extensions;
                break;
            case "themes":
                unprotectedSpices = this.unprotected_themes;
                break;
            case "actions":
                unprotectedSpices = this.unprotected_actions;
        }

        const blacklist = this.get_blacklisted_packages();
        //~ logDebug("blacklist: "+blacklist);

        // populate this.unprotected_<type> with the this.unprotected_<type> elements, removing uninstalled <type>:
        let unprotectedSpices_length = unprotectedSpices.length;
        for (var i=0; i < unprotectedSpices_length; i++) {
            let a = unprotectedSpices[i];
            let d = file_new_for_path("%s/%s".format(DIR_MAP[type], a["name"]));
            if (d.query_exists(null)) {
                // the blacklist takes priority over this applet:
                var isSystemProtected = (blacklist.indexOf(a["name"]) >= 0);
                //~ if (isSystemProtected) logDebug(a["name"]+" is system-protected!!!");
                this.unprotectedDico[type][a["name"]] = a["isunprotected"] && !isSystemProtected;
                let metadataFileName = DIR_MAP[type] + "/" + a["name"] + "/metadata.json";
                if (a["isunprotected"] && a["requestnewdownload"] !== undefined && a["requestnewdownload"] === true) {
                    this._load_cache(type);
                    let created = this._get_member_from_cache(type, a["name"], "created");
                    let last_edited = this._get_last_edited_from_cache(type, a["name"]);
                    if (created !== null && last_edited !== null && created >= last_edited)
                        created = last_edited - 1;

                    if (created !== null) this._rewrite_metadataFile(metadataFileName, created);
                }
                if (!a["isunprotected"]) {
                    this._rewrite_metadataFile(metadataFileName, Math.ceil(Date.now()/1000));
                }
                this.unprotectedList[type].push({
                    "name": a["name"],
                    "isunprotected": a["isunprotected"] && !isSystemProtected,
                    "requestnewdownload": false
                });
            }
        }

        // Are there new applets installed? If there are, then push them in this.unprotected_applets:
        let dir = file_new_for_path(DIR_MAP[type]);
        if (dir.query_exists(null)) {
            let children = dir.enumerate_children("standard::name,standard::type", FileQueryInfoFlags.NONE, null);
            let info, file_type;
            var name;
            var isSystemUnprotected;

            while ((info = children.next_file(null)) != null) {
                file_type = info.get_file_type();
                if (file_type == FileType.DIRECTORY) {
                    name = info.get_name();
                    isSystemUnprotected = (blacklist.indexOf(name) < 0);
                    if (this.unprotectedDico[type][name] === undefined) {
                        this.unprotectedList[type].push({"name": name, "isunprotected": isSystemUnprotected, "requestnewdownload": false});
                        this.unprotectedDico[type][name] = {};
                        this.unprotectedDico[type][name]["name"] = name;
                        this.unprotectedDico[type][name]["isunprotected"] = isSystemUnprotected;
                        this._get_last_edited_from_metadata(type, name);
                    }
                }
            }

            switch (type) {
                case "applets":
                    this.unprotected_applets = this.unprotectedList[type].sort((a,b) => this._compare(a,b));
                    break;
                case "desklets":
                    this.unprotected_desklets = this.unprotectedList[type].sort((a,b) => this._compare(a,b));
                    break;
                case "extensions":
                    this.unprotected_extensions = this.unprotectedList[type].sort((a,b) => this._compare(a,b));
                    break;
                case "themes":
                    this.unprotected_themes = this.unprotectedList[type].sort((a,b) => this._compare(a,b));
                    break;
                case "actions":
                    this.unprotected_actions = this.unprotectedList[type].sort((a,b) => this._compare(a,b));
            }

            children.close(null);
            children = undefined;
            info = undefined;
            file_type = undefined;
            name = undefined;
            isSystemUnprotected = undefined;
        }
        dir = undefined;

        //~ WAITING[type] = (this.unprotectedList[type].length + 3) * 1000;
        unprotectedSpices = undefined;
        this.cache[type] = "{}";
    } // End of populateSettingsUnprotectedSpices

    populateSettingsUnprotectedApplets() {
        this.populateSettingsUnprotectedSpices("applets");
    } // End of populateSettingsUnprotectedApplets

    populateSettingsUnprotectedDesklets() {
        this.populateSettingsUnprotectedSpices("desklets");
    } // End of populateSettingsUnprotectedDesklets

    populateSettingsUnprotectedExtensions() {
        this.populateSettingsUnprotectedSpices("extensions");
    } // End of populateSettingsUnprotectedExtensions

    populateSettingsUnprotectedThemes() {
        this.populateSettingsUnprotectedSpices("themes");
    } // End of populateSettingsUnprotectedThemes

    populateSettingsUnprotectedActions() {
        this.populateSettingsUnprotectedSpices("actions");
    } // End of populateSettingsUnprotectedActions

    _compare(a,b) {
        // We know that a["name"] and b["name"] are different.
        if (a["name"].toLowerCase() < b["name"].toLowerCase()) {
            return -1;
        }
        return 1;
    } // End of _compare

    _get_singular_type(t) {
        return t.slice(0,-1); // removes the trailing 's'.
    } // End of _get_singular_type

    are_dependencies_installed() {
        let _fonts_installed =
            file_new_for_path("/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf").query_exists(null) ||
            file_new_for_path("/usr/share/fonts/TTF/Symbola.ttf").query_exists(null) ||
            file_new_for_path("/usr/share/fonts/truetype/Symbola.ttf").query_exists(null) ||
            file_new_for_path("/usr/share/fonts/gdouros-symbola/Symbola.ttf").query_exists(null) ||
            file_new_for_path("%s/.local/share/fonts/Symbola_Hinted.ttf".format(HOME_DIR)).query_exists(null) ||
            file_new_for_path("%s/.local/share/fonts/Symbola.ttf".format(HOME_DIR)).query_exists(null) ||
            file_new_for_path("%s/.local/share/fonts/Symbola.otf".format(HOME_DIR)).query_exists(null);

        if (!_fonts_installed) {
            let _ArchlinuxWitnessFile = file_new_for_path("/etc/arch-release");
            let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
            let _openSUSEWitnessFile = file_new_for_path("/usr/share/licenses/openSUSE-release");
            let _isopenSUSE = _openSUSEWitnessFile.query_exists(null);
            if (_isArchlinux || _isopenSUSE) {
                Util.spawnCommandLineAsync("/bin/sh -c \"%s/install_symbola_on_Arch.sh\"".format(SCRIPTS_DIR), null, null);
                _fonts_installed = true
            }
        }
        this.fonts_installed = _fonts_installed;
        _fonts_installed = undefined;
        return (this.fonts_installed);
    } // End of are_dependencies_installed

    get_terminal() {
        var term_found = "";
        var _terminals = ["gnome-terminal", "tilix", "konsole", "guake", "qterminal", "terminator", "uxterm", "xterm"];
        var t;
        let _terminals_length = _terminals.length;
        for (t=0; t < _terminals_length ; t++) {
            if (find_program_in_path(_terminals[t])) {
                term_found = find_program_in_path(_terminals[t]);
                break
            }
        }
        return term_found;
    } // End of get_terminal

    check_dependencies() {
        if (!this.dependenciesMet && this.are_dependencies_installed()) {
            // At this time, the user just finished to install all dependencies.
            this.dependenciesMet=true;
            try {
                if (this.notification != null) {
                    this.notification.destroy(2) // Destroys the precedent critical notification.
                }
            } catch(e) {
                // Not an error. Simply, the user has clicked on the notification, destroying it.
                this.notification = null;
            }
            // Notification (temporary)
            let notifyMessage = _("Spices Update") + " " + _("is fully functional.");
            Main.notify(_("All dependencies are installed"), notifyMessage);
            notifyMessage = undefined;

            // Reload this applet with dependencies installed
            Extension.reloadExtension(UUID, Extension.Type.APPLET);
        } else if (!this.are_dependencies_installed() && this.notification === null) {
            let icon = new Icon({
                icon_name: "error",
                icon_type: IconType.FULLCOLOR,
                icon_size: 36 });
            // Got a terminal used on this system:
            let terminal = this.get_terminal();
            // apturl is it present?
            let _is_apturl_present = find_program_in_path("apturl");
            // Detects the distrib in use and make adapted message and notification:
            let _isFedora = find_program_in_path("dnf");
            let _ArchlinuxWitnessFile = file_new_for_path("/etc/arch-release");
            let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
            let _openSUSEWitnessFile = file_new_for_path("/usr/share/licenses/openSUSE-release");
            let _isopenSUSE = _openSUSEWitnessFile.query_exists(null);
            let _DebianWitnessFile = file_new_for_path("/tmp/DEBIAN");
            let _isDebian = _DebianWitnessFile.query_exists(null);
            let _apt_update =  _isFedora ? "sudo dnf update" : (_isArchlinux || _isopenSUSE) ? "" : _isDebian ? "apt update" : "sudo apt update";
            let _and = (_isArchlinux || _isopenSUSE) ? "" : " \\\\&\\\\& ";
            //var _apt_install = _isFedora ? "sudo dnf install libnotify gdouros-symbola-fonts" : _isArchlinux ? "sudo pacman -Syu libnotify" : _isDebian ? "apt install fonts-symbola" : "sudo apt install fonts-symbola";
            var _apt_install = _isFedora ? "sudo dnf install gdouros-symbola-fonts" : _isArchlinux ? "" : _isDebian ? "apt install fonts-symbola" : _isopenSUSE ? "sudo yast2 --install gdouros-symbola-fonts" : "sudo apt install fonts-symbola";
            let criticalMessagePart1 = _("You appear to be missing some of the programs required for this applet to have all its features.");
            let criticalMessage = _is_apturl_present ? criticalMessagePart1 : criticalMessagePart1+"\n\n"+_("Please execute, in the just opened terminal, the commands:")+"\n "+ _apt_update +" \n "+ _apt_install +"\n\n";
            this.notification = criticalNotify(_("Some dependencies are not installed!"), criticalMessage, icon);

            if (!_is_apturl_present) {
                if (terminal != "") {
                    // TRANSLATORS: The next messages should not be translated.
                    if (_isDebian === true) {
                        Util.spawnCommandLineAsync(terminal + " -e '/bin/sh -c \"echo Spices Update message: Some packages needed!; echo To complete the installation, please become root with su then execute the command: ; echo "+ _apt_update + _and + _apt_install + "; sleep 1; exec bash\"'", null, null);
                    } else {
                        Util.spawnCommandLineAsync(terminal + " -e '/bin/sh -c \"echo Spices Update message: Some packages needed!; echo To complete the installation, please enter and execute the command: ; echo "+ _apt_update + _and + _apt_install + "; sleep 1; exec bash\"'", null, null);
                    }
                }
            } else {
                if (!this.fonts_installed)
                    Util.spawnCommandLineAsync("/usr/bin/apturl apt://fonts-symbola");
            }
            this.dependenciesMet = false;
        }
        // End of check_dependencies
    }

    _load_cache(type) {
        let jsonFileName = CACHE_MAP[type];
        let jsonFile = file_new_for_path(jsonFileName);
        if (!jsonFile.query_exists(null)) {
            let jsonDirName = CACHE_DIR + "/" + this._get_singular_type(type);
            mkdir_with_parents(jsonDirName, 0o755);
            file_set_contents(jsonFileName,"{}");
            jsonDirName = undefined;
        }
        if (jsonFile.query_exists(null)) {
            //~ this.oldCache[type] = this.cache[type];
            this.cache[type] = to_string(file_get_contents(jsonFileName)[1]);
        } else {
            this.cache[type] = "{}"
        }
        jsonFile = undefined;
        jsonFileName = undefined;
    } // End of _load_cache

    _get_last_edited_from_cache(type, uuid) {
        var cacheParser = new Json.Parser();
        cacheParser.load_from_data(this.cache[type], -1);
        var ok = false;
        var lastEdited = null;
        try {
            lastEdited = cacheParser.get_root().get_object().get_member(uuid).get_object().get_member("last_edited").get_value();
            if (lastEdited) {
                ok = true;
            }
        } catch(e) {
            // Nothing to do.
        }
        cacheParser = undefined;

        if (ok === true) {
            return lastEdited
        } else {
            return null
        }
    } // End of _get_last_edited_from_cache

    _get_member_from_cache(type, uuid, memberId) {
        var cacheParser = new Json.Parser();
        cacheParser.load_from_data(this.cache[type], -1);
        var ok = false;
        var memberValue = null;
        try {
            memberValue = cacheParser.get_root().get_object().get_member(uuid).get_object().get_member(memberId).get_value();
            if (memberValue) {
                ok = true;
            }
        } catch(e) {
            // Nothing to do.
        }
        cacheParser = undefined;

        if (ok === true) {
            return memberValue
        } else {
            return null
        }
    } // End of _get_member_from_cache

    get_spice_name(type, uuid) {
        return _(this._get_member_from_cache(type, uuid, "name"), uuid);
    } // End of get_spice_name

    get_spice_description(type, uuid) {
        return _(this._get_member_from_cache(type, uuid, "description"), uuid);
    } // End of get_spice_name

    get_spice_last_commit_subject(type, uuid) {
        return _(this._get_member_from_cache(type, uuid, "last_commit_subject"), uuid);
    } // End of get_spice_name

    _rewrite_metadataFile(fileName, lastEdited) {
        let metadataFile = file_new_for_path(fileName);
        let metadataData = "{}";
        if (metadataFile.query_exists(null)) {
            //metadataData =file_get_contents(fileName).toString().substr(5);
            metadataData = to_string(file_get_contents(fileName)[1]);
        }
        let newData = JSON.parse(metadataData);

        // Rewrite metadata.json file only if necessary:
        if (newData["last-edited"] === undefined || newData["last-edited"] !== lastEdited) {
            newData["last-edited"] = lastEdited;
            let message = JSON.stringify(newData, null, 2);
            file_set_contents(fileName, message);
            message = undefined;
        }
        newData = undefined;
        metadataData = undefined;
        metadataFile = undefined;
        // End of _rewrite_metadataFile
    }

    _get_last_edited_from_metadata(type, uuid) {
        var lastEdited = null;
        let metadataParser = new Json.Parser();
        let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
        let metadataFile = file_new_for_path(metadataFileName);
        let dirName = DIR_MAP[type] + "/" + uuid;
        let dir = file_new_for_path(dirName);
        let most_recent;

        // For some themes, the metadata.json file is in the subfolder /cinnamon:
        if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
            metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
            metadataFile = file_new_for_path(metadataFileName);
        }

        if (metadataFile.query_exists(null)) {
            // substr(5) is needed to remove the 'true,' at begin:
            //let metadataData =file_get_contents(metadataFileName).toString().substr(5);
            let metadataData =to_string(file_get_contents(metadataFileName)[1]);
            if (metadataData !== null) {
                metadataParser.load_from_data(metadataData, -1);
                let node = metadataParser.get_root();
                if (node.get_node_type() === Json.NodeType.OBJECT) {
                    var lastEditedIsToSet = false;
                    let obj = node.get_object();
                    try {
                        lastEdited = obj.get_member("last-edited").get_value();
                    } catch(e) {
                        // The last-edited member doesn't exist
                        most_recent = this._most_recent_file_in(dir);
                        // Set the last-edited member's value to the last modification time of the most_recent file, in epoch format.
                        if (most_recent !== null) {
                            lastEdited = most_recent.query_info("time::modified", FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix();
                            this.get_date_of_nearest_commit(type, uuid, lastEdited, metadataFileName);
                        }
                    }
                }
            }
        }
        metadataParser = undefined;
        metadataFileName = undefined;
        metadataFile = undefined;
        dirName = undefined;
        dir = undefined;
        return lastEdited;
    } // End of _get_last_edited_from_metadata

    _most_recent_file_in(dir) {
        if (!dir.query_exists(null)) return null;

        var latest_time = dir.query_info("time::modified", FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix();
        var latest_file = dir;
        let children = dir.enumerate_children("standard::name,standard::type", FileQueryInfoFlags.NONE, null);
        let info, file_type;
        let file, file_time;
        while ((info = children.next_file(null)) != null) {
            file = children.get_child(info);
            if (file.get_basename() === "metadata.json") continue; // ignore metadata.json file

            file_time = file.query_info("time::modified", FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix();
            if (file_time > latest_time) {
                latest_time = file_time;
                latest_file = file;
            }
            file_type = info.get_file_type();
            if (file_type == FileType.DIRECTORY) {
                file = this._most_recent_file_in(file);
                file_time = file.query_info("time::modified", FileQueryInfoFlags.NONE, null).get_modification_date_time().to_unix();
                if (file_time > latest_time) {
                    latest_time = file_time;
                    latest_file = file;
                }
            }
        }
        latest_time = undefined;
        children = undefined;
        info = undefined;
        file_type = undefined;
        file = undefined;
        file_time = undefined;
        return latest_file;
    } // End of _most_recent_file_in

    _forget_new_spices(type) {
        var newSpices = this.new_Spices[type];
        if (newSpices.length === 0) return;
        var uuid = newSpices[0];
        let id = setInterval( () => {
            this.isProcessing = true;
            uuid = newSpices.pop(0);
            this.download_image(type, uuid);
            if (this.nb_to_watch > 0)
                this.nb_to_watch -= 1;
            //if (this.nb_to_watch <= 0)
                //this.isProcessing = false;
            this.updateUI();
            if (newSpices.length === 0) {
                clearInterval(id);
                this.isProcessing = false;
                this.updateUI();
                newSpices = undefined;
                uuid = undefined;
            }
        }, 10000);
    } // End of _forget_new_spices

    _on_forget_new_spices_pressed() {
        var indexTypes = 0
        var type = TYPES[indexTypes];
        this.do_rotation = true;
        this.updateUI();
        this._forget_new_spices(type);
        this.do_rotation = false;
        this.updateUI();
        let id = setInterval( () => {
            indexTypes++;
            if (indexTypes < TYPES.length) {
                type = TYPES[indexTypes];
                this.do_rotation = true;
                this.updateUI();
                this._forget_new_spices(type);
                this.do_rotation = false;
                this.updateUI();
            } else {
                clearInterval(id);
                indexTypes = undefined;
                type = undefined;
            }
        }, (type && this.new_Spices[type] && (this.new_Spices[type].length > 0)) ? this.new_Spices[type].length * 12000 : 12000);
    } // End of _on_forget_new_spices_pressed

    download_image(type, uuid) {
        //FIXME: Use infos from Github!
        let memberName, url, target;
        let is_theme = (type === "themes");
        if (is_theme) {
            memberName = "screenshot"
        } else {
            memberName = "icon"
        }
        this._load_cache(type);
        url = URL_SPICES_HOME + this._get_member_from_cache(type, uuid, memberName);
        if (is_theme) {
            url = url.replace("/files/themes/", "/uploads/themes/thumbs/")
        }
        //url += "?time=" + get_current_timestamp();
        let _basename = ""+uuid+".png";

        let command = THUMB_DOWNLOADER + " " + url + " " + this._get_singular_type(type) + " " + _basename;
        //~ logDebug("command: "+command);
        Util.spawnCommandLineAsync(command);
        memberName = undefined;
        url = undefined;
        target = undefined;
        is_theme = undefined;
        this.cache[type] = "{}";
    } // End of download_image

    async get_last_commit_subject(type, uuid) {
        let subject = this.get_spice_last_commit_subject(type, uuid);
        if (!subject)
            subject = "";
        this.details_by_uuid[uuid] = subject;

        return (this.details_by_uuid[uuid] !== undefined && this.details_by_uuid[uuid].length !== 0);
    } // End of get_last_commit_subject

    async get_date_of_nearest_commit(type, uuid, timestamp, fileName) {
        let marker_begin = '<relative-time datetime="';
        let marker_end = '" class="no-wrap">';
        let subject_regexp = new RegExp(`${marker_begin}(.+)${marker_end}`, "g");
        let url = "https://github.com/linuxmint/cinnamon-spices-%s/commits/master/%s".format(
            type.toString(),
            uuid
        );
        //~ logDebug("get_last_commit_subject() - url: "+url);
        await this.fetch(url).then( (data) => {
            if (data !== null) {
                let result;
                let commit_time;
                var nearest_commit_time = timestamp;
                var smaller_difference = Math.round(Date.now() / 1000);
                let difference;
                while (result == subject_regexp.exec(data)) {
                    commit_time = Date.parse(result[1].toString()) / 1000;
                    difference = Math.abs(timestamp - commit_time);
                    if (difference < smaller_difference) {
                        smaller_difference = difference;
                        nearest_commit_time = commit_time;
                    }
                }
                this._rewrite_metadataFile(fileName, nearest_commit_time);
                this.updateUI(); // Is it necessary?
            }
        });
    } // End of get_date_of_nearest_commit

    is_to_check(type) {
        return this.types_to_check.indexOf(type) > -1;
    } // End of is_to_check

    is_to_check_for_new(type) {
        return (this.types_to_check_new.indexOf(type) > -1);
    } // End of is_to_check_for_new

    get_can_be_updated(type) {
        var ret = [];
        var spicesList = this.unprotectedList[type];
        for (let s of spicesList) {
            if (s["isunprotected"] === true) {
                ret.push(s["name"])
            }
        }
        spicesList = undefined;
        return ret;
    } // End of get_can_be_updated

    get_must_be_updated(type) {
        let can_be_updated = this.get_can_be_updated(type);
        var ret = new Array();
        var lc, lm;
        for (let uuid of can_be_updated) {
            lc = this._get_last_edited_from_cache(type, uuid);
            if (lc !== null) {
                lm = this._get_last_edited_from_metadata(type, uuid);
                if (lm !== null) {
                    if (lc > lm) {
                        if (this.details_requested) {
                            if (this.get_last_commit_subject(type, uuid)) {
                                if (this.details_by_uuid[uuid] !== undefined && this.details_by_uuid[uuid].trim().length !== 0) {
                                    ret.push("★ <b>%s</b> (%s)\n\t\t<i>%s</i>".format(_(this.get_spice_name(type, uuid)), uuid, this.details_by_uuid[uuid].trim()));
                                } else {
                                    ret.push("★ <b>%s</b> (%s)\n\t\t%s".format(_(this.get_spice_name(type, uuid)), uuid, _("(Description unavailable)")));
                                }
                            } else {
                                this.refreshInterval = DOWNLOAD_TIME; // Wait DOWNLOAD_TIME more seconds to avoid the message "(Refresh to see the description)".
                            }
                        } else {
                            ret.push("★ <b>%s</b> (%s)".format(_(this.get_spice_name(type, uuid)), uuid));
                        }
                        this.monitor_metadatajson(type, uuid);
                    }
                }
            }
        }
        can_be_updated = undefined;
        lc = undefined;
        lm = undefined;
        return ret;
    } // End of get_must_be_updated

    get_are_new(type) {
        var ret = new Array();
        for (let uuid of this.new_Spices[type]) {
            if (this.details_requested === true)
                ret.push("★ <b>%s</b> (%s)\n\t\t<i>%s</i>".format(
                    _(this.get_spice_name(type, uuid)),
                    uuid,
                    _(this.get_spice_description(type, uuid)))
                )
            else
                ret.push("★ <b>%s</b> (%s)".format(_(this.get_spice_name(type, uuid)), uuid))
        }
        return ret;
    } // End of get_are_new

    get_uuids_from_cache(type) {
        var cacheParser = JSON.parse(this.cache[type]);
        let names = Object.keys(cacheParser);
        cacheParser = undefined;
        return names;
    } // End of get_uuids_from_cache

    get_new_spices(type, force = false) {
        if (!this.is_to_check_for_new(type) && !force) return false;
        var known_spices = [];
        let uuids = this.get_uuids_from_cache(type);
        let png_dir = file_new_for_path(CACHE_DIR + "/%s".format(this._get_singular_type(type)));
        if (png_dir.query_exists(null)) {
            let children = png_dir.enumerate_children("standard::name,standard::type", FileQueryInfoFlags.NONE, null);
            let info;
            var name;
            while ((info = children.next_file(null)) != null) {
                name = info.get_name();
                if (info.get_file_type() === FileType.REGULAR && name.substr(name.length - 4, name.length - 1) === ".png") {
                    known_spices.push(name.substr(0, name.length - 4))
                }
            }
            known_spices = known_spices.sort((a,b) => { if (a<b) return -1; else return 1;});
        }
        this.new_Spices[type] = [];
        uuids.map(x => {if (known_spices.indexOf(x)<0) this.new_Spices[type].push(x);});
        known_spices = undefined;
        uuids = undefined;
        png_dir = undefined;
        if (this.new_Spices[type].length > 0) this.monitor_png_directory(type);
        return (this.new_Spices[type].length > 0);
    } // End of get_new_spices

    monitor_png_directory(type) {
        if (this.monitorsPngId[type] === 0) {
            let pngDirName = CACHE_DIR + "/%s".format(this._get_singular_type(type));
            let pngDir = file_new_for_path(pngDirName);

            if (pngDir.query_exists(null)) {
                try {
                    let monitor = pngDir.monitor_directory(0, null);
                    let Id = monitor.connect("changed", (type) => this._on_pngDir_changed(type));
                    this.monitors.push([monitor, Id]);
                    this.monitorsPngId[type] = Id;
                } catch(e) {
                    // Nothing to do.
                }
            }
            pngDir = undefined;
            pngDirName = undefined;
        }
    } // End of monitor_png_directory

    _on_pngDir_changed(type) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.timeoutId = setTimeout(() => {
            this._on_refresh_pressed();
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }, 12000);
    } // End of _on_pngDir_changed

    monitor_metadatajson(type, uuid) {
        if (this.alreadyMonitored.indexOf(uuid) > -1) return;
        let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
        let metadataFile = file_new_for_path(metadataFileName);

        // For some themes, the metadata.json file is in the subfolder /cinnamon:
        if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
            metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
            metadataFile = file_new_for_path(metadataFileName);
        }

        if (metadataFile.query_exists(null)) {
            try {
                let monitor = metadataFile.monitor(0, null);
                let Id = monitor.connect("changed", (type, uuid) => this._on_metadatajson_changed(type, uuid));
                this.monitors.push([monitor, Id]);
                this.alreadyMonitored.push(uuid);
            } catch(e) {
                // Nothing to do.
            }
            //~ log("alreadyMonitored = " + this.alreadyMonitored);
        }
        metadataFile = undefined;
        metadataFileName = undefined;
    } // End of monitor_metadatajson

    _on_metadatajson_changed(type, uuid) {
        this.isProcessing = true;
        if (this.nb_to_update > 0)
            this.nb_to_update--;
        this.updateUI();
        if (this.isLooping) {
            this.new_loop_requested = true;
        } else {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            this.timeoutId = setTimeout(() => {
                this._on_refresh_pressed();
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }, 12000);
        }
    } // End of _on_metadatajson_changed

    disable_system_auto_update() {
        try {
            let _SETTINGS_SCHEMA = "com.linuxmint.updates";
            let _SETTINGS_KEY = "auto-update-cinnamon-spices";
            let _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });
            _interface_settings.set_boolean(_SETTINGS_KEY, false);
        } catch(e) {
            // The used distrib doesn't have mintupdate installed: nothing to do.
        }
    }

    get_blacklisted_packages() {
        var blacklist = [];
        try {
            let _SETTINGS_SCHEMA = "com.linuxmint.updates";
            let _SETTINGS_KEY = "blacklisted-packages";
            let _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });
            let blacklisted_packages = _interface_settings.get_strv(_SETTINGS_KEY);

            for (let b of blacklisted_packages) {
                var b0 = b.split("=")[0];
                blacklist.push(b0);
            }
            _interface_settings = undefined;
            blacklisted_packages = undefined;
            _SETTINGS_KEY = undefined;
            _SETTINGS_SCHEMA = undefined;
        } catch(e) {
            // The used distrib doesn't have mintupdate installed: no blacklist.
            blacklist = [];
        }
        return blacklist
    } // End of get_blacklisted_packages

    get_active_spices(type) {
        // Returns the list of active spices of type 'type'
        //~ var dconfEnabled;
        var elt = (type.toString() === "applets") ? 3 : 0;
        let listCanBeUpdated = this.get_can_be_updated(type);
        let enabled;
        var listEnabled = new Array();
        let _SETTINGS_SCHEMA, _SETTINGS_KEY;
        let _interface_settings;

        if (type.toString() === "themes") {
            _SETTINGS_SCHEMA = "org.cinnamon.theme";
            _SETTINGS_KEY = "name";
            _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });
            enabled = _interface_settings.get_string(_SETTINGS_KEY);
            listEnabled.push(enabled);
            _interface_settings = undefined;
            _SETTINGS_KEY = undefined;
            _SETTINGS_SCHEMA = undefined;
            enabled = undefined;
            xlet_uuid = undefined;
            listCanBeUpdated = undefined;

            return listEnabled
        }

        _SETTINGS_SCHEMA = "org.cinnamon";
        _SETTINGS_KEY = "enabled-%s".format(type.toString());
        _interface_settings = new Settings({ schema_id: _SETTINGS_SCHEMA });

        enabled = _interface_settings.get_strv(_SETTINGS_KEY);
        let xlet_uuid;
        for (let xl of enabled) {
            xlet_uuid = xl.split(":")[elt].toString().replace(/'/g,"");
            if (!xlet_uuid.endsWith("@cinnamon.org") && (listCanBeUpdated.indexOf(xlet_uuid)>-1))
                listEnabled.push(xlet_uuid);
        }
        _interface_settings = undefined;
        _SETTINGS_KEY = undefined;
        _SETTINGS_SCHEMA = undefined;
        enabled = undefined;
        xlet_uuid = undefined;
        listCanBeUpdated = undefined;

        return listEnabled;
    } // End of get_active_spices

    get_default_icon_color() {
        try {
            let themeNode = this.actor.get_theme_node(); // get_theme_node() fails in constructor! (cause: widget not on stage)
            let icon_color = themeNode.get_icon_colors();
            this.defaultColor = icon_color.foreground.to_string();
            icon_color = undefined;
            themeNode = undefined;
        } catch(e) {
            this.defaultColor = "white";
        }
    } // End of get_default_icon_color

    makeMenu() {
        this.menu.removeAll();

        // Head
        this.menuitemHead1 = new PopupMenuItem(this.default_tooltip, {
            reactive: false
        });
        this.menu.addMenuItem(this.menuitemHead1);
        this.menu.addMenuItem(new PopupSeparatorMenuItem());

        if (this.dependenciesMet) {
            // Refresh button
            this.refreshButton = new PopupIconMenuItem(_("Refresh"), "emblem-synchronizing-symbolic", IconType.SYMBOLIC);
            this.refreshButton.connect("activate", (event) => this._on_refresh_pressed());
            this.menu.addMenuItem(this.refreshButton);
            this.menu.addMenuItem(new PopupSeparatorMenuItem());
        }

        // Status of each type of Spices:
        this.spicesMenuItems = {};
        let char_update = "\u21BB";
        let char_new = "\u2604";
        let ts;
        for (let t of TYPES) {
            ts = _(capitalize(t.toString()));
            if (this.nb_in_menu[t] - this.new_Spices[t].length > 0) ts += "   %s %s".format(char_update, (this.nb_in_menu[t] - this.new_Spices[t].length).toString());
            if (this.new_Spices[t].length > 0) ts += "   %s %s".format(char_new, (this.new_Spices[t].length).toString());
            this.spicesMenuItems[t] = new PopupIndicatorMenuItem(ts);
            this.spicesMenuItems[t].connect("activate", (event) => {
                Util.spawnCommandLineAsync("%s %s -t %s -s %s".format(CS_PATH, t.toString(), TAB, SORT));
            });
            this.spicesMenuItems[t].setShowDot(this.menuDots[t]);
            this.menu.addMenuItem(this.spicesMenuItems[t]);
        }
        // button Forget
        if (this.nb_to_watch > 0) {
            let _forget_button = new PopupIconMenuItem(_("Forget new Spices") + " -\u2604-", "emblem-ok", IconType.SYMBOLIC);
            _forget_button.connect("activate", (event) => this._on_forget_new_spices_pressed());
            this.menu.addMenuItem(_forget_button);
        }
        // button Download
        if ((this.nb_to_update + this.nb_to_watch) > 0) {
            let _download_tabs_button = new PopupIconMenuItem(_("Open useful Cinnamon Settings"), "su-update-available", IconType.SYMBOLIC);
            _download_tabs_button.connect("activate", (event) => this.open_each_download_tab());
            this.menu.addMenuItem(_download_tabs_button);
        }
        this.menu.addMenuItem(new PopupSeparatorMenuItem());

        // sub-menu Configure
        let _configure = new PopupSubMenuMenuItem(_("Configure"));
        this.menu.addMenuItem(_configure);
        this.menu.addMenuItem(new PopupSeparatorMenuItem());
        let _configureOptions = [_("General"), _("Applets"), _("Desklets"), _("Extensions"), _("Themes"), _("Actions")];
        let _iconNames = ["su-general", "su-applets", "su-desklets", "su-extensions", "su-themes", "su-actions"];
        let _options = [];
        let _configureOptions_length = _configureOptions.length;
        for (let i=0; i < _configureOptions_length ; i++) {
            let _optionTitle = _configureOptions[i];
            let _icon = _iconNames[i];
            _options[i] = new PopupIconMenuItem(_optionTitle, _icon, IconType.SYMBOLIC);
            _options[i].connect("activate", (event) => Util.spawnCommandLineAsync("/usr/bin/xlet-settings applet %s -i %s -t %s".format(UUID, this.instanceId, i.toString())));
            _configure.menu.addMenuItem(_options[i])
        }
        _configure.menu.open();

        // button Reload this applet
        if (DEBUG() || RELOAD()) {
            let _reload_button = new PopupIconMenuItem("Reload this applet", "edit-redo", IconType.SYMBOLIC);
            _reload_button.connect("activate", (event) => this._on_reload_this_applet_pressed())
            this.menu.addMenuItem(_reload_button);
        }

        // Here the (future) notification list:


        // Help
        this.menu.addMenuItem(new PopupSeparatorMenuItem());

        // button Help...
        this.help_button = new PopupIconMenuItem(_("Help", "cinnamon-control-center") + "...", "folder-documents-symbolic", IconType.SYMBOLIC);
        this.help_button.connect("activate", (event) => {
                let _language = this.get_user_language();
                if (_language.startsWith("en")) {
                    Util.spawnCommandLineAsync("/usr/bin/xdg-open https://cinnamon-spices.linuxmint.com/applets/view/309");
                } else {
                    let url_help = "https://cinnamon--spices-linuxmint-com.translate.goog/applets/view/309?_x_tr_sl=auto&_x_tr_tl=%s&_x_tr_hl=%s&_x_tr_pto=wapp".format(_language, _language);
                    Util.spawnCommandLineAsync("/usr/bin/xdg-open "+url_help);
                    url_help = undefined;
                }
            });

        this.menu.addMenuItem(this.help_button);
        // End of makeMenu
    }

    clear_notifications_about_updates(type=null) {
        if (type) {
            while (this.notifications_about_updates[type].length != 0) {
                let n = this.notifications_about_updates[type].pop();
                n.destroy(3);
            }
        } else {
            for (let t of TYPES) {
                while (this.notifications_about_updates[t].length != 0) {
                    let n = this.notifications_about_updates[t].pop();
                    n.destroy(3);
                }
            }
        }
    } // End of clear_notifications_about_updates

    clear_notifications_about_news(type=null) {
        if (type) {
            while (this.notifications_about_news[type].length != 0) {
                let n = this.notifications_about_news[type].pop();
                n.destroy(3);
            }
        } else {
            for (let t of TYPES) {
                while (this.notifications_about_news[t].length != 0) {
                    let n = this.notifications_about_news[t].pop();
                    n.destroy(3);
                }
            }
        }
    } // End of clear_notifications_about_news

    destroy_notifications(type, about = "both") {
        if (about === "both" || about === "updates") {
            this.clear_notifications_about_updates(type);
            this.old_message[type] = "";
        }

        if (about === "both" || about === "news") {
            this.clear_notifications_about_news(type);
            this.old_watch_message[type] = "";
        }
    } // End of destroy_notifications

    destroy_all_notifications() {
        for (let t of TYPES) {
            this.destroy_notifications(t);
        }
    } // End of destroy_all_notifications

    _on_refresh_pressed() {
        if (this.menu.isOpen)
            this.menu.toggle();
        this.first_loop = false;
        this.refresh_requested = true;

        if (!this.isLooping) {
            if (this.loopId) {
                source_remove(this.loopId);
            }
            this.loopId = null;
            //~ this.refreshInterval = QUICK() ? 720 * this.general_frequency : 3600 * this.general_frequency;
            this.refreshInterval = 3600 * this.general_frequency;
            this.do_rotation = true;
            this.updateLoop();
        }
    } // End of _on_refresh_pressed

    _on_reload_this_applet_pressed() {
        // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
        this.applet_running = false;
        if (this.loopId) {
            source_remove(this.loopId);
        }
        this.loopId = null;
        var monitor, Id;
        for (let tuple of this.monitors) {
            [monitor, Id] = tuple;
            monitor.disconnect(Id)
        }
        this.monitors = [];
        this.alreadyMonitored = [];
        for (let type of TYPES) this.monitorsPngId[type] = 0;
        // Reload this applet
        Extension.reloadExtension(UUID, Extension.Type.APPLET);
    } // End of _on_reload_this_applet_pressed

    _clean_str(str) {
        let ret = str.replace(/\\'/gi, "'");
        ret = ret.replace(/\\"/gi, '"');

        // Support &amp;, &quot;, &apos;, &lt; and &gt;, escape all other
        // occurrences of '&'.
        ret = ret.replace(/&(?!amp;|quot;|apos;|lt;|gt;)/g, '&amp;');

        // Support <b>, <i>, and <u>, escape anything else
        // so it displays as raw markup.
        ret = ret.replace(/<(?!\/?[biu]>)/g, '&lt;');

        try {
            Pango.parse_markup(ret, -1, "");
            return ret;
        } catch (e) {
            logError(e);
            return markup_escape_text(text, -1);
        }
    } // End of _clean_str

    darken_color(str_color) {
        let c = Color.from_string(str_color)[1];
        let lc = c.darken();
        c = undefined;
        return lc.to_string().substr(0,7);
    } // End of darken_color

    set_icon_color() {
        if (this.refresh_requested || this.cinnamon_server_is_down) {
            //this._applet_icon.style = "color: %s;".format("lightgray");
            this._applet_icon.style = "color: %s;".format(this.darken_color(this.defaultColor));
            this.refreshInterval = DOWNLOAD_TIME;
        } else {
            this.get_default_icon_color();
            this._applet_icon.style = "color: %s;".format(this.defaultColor);
        }
        this.refresh_requested = false;
        if (this.general_warning === true) {
            for (let t of TYPES) {
                if (this.menuDots[t] === true) {
                    if (this.isProcessing === true)
                        this._applet_icon.style = "color: %s;".format(this.processing_color);
                    else
                        this._applet_icon.style = "color: %s;".format(this.events_color);
                    this.do_rotation = false;
                    break;
                }
            }
        }
        Tweener.addTween(this.actor, {
            opacity: 255,
            transition: "linear",
            time: 0.5,
            onComplete: null
        });
    } // End of set_icon_color

    icon_rotate() {
        this.angle = Math.round(this.angle + 3) % 360;
        let size = Math.round(this.getPanelIconSize(IconType.SYMBOLIC)); // * global.ui_scale);
        this.img_icon = getImageAtScale(this.img_path, size, size);
        this.img_icon.set_pivot_point(0.5, 0.5);
        this.img_icon.set_rotation_angle(RotateAxis.Z_AXIS, this.angle);
        this._applet_icon_box.set_child(this.img_icon);
        if (this.isHorizontal === true)
            this._applet_icon_box.set_fill(true, false);
        else
            this._applet_icon_box.set_fill(false, true);
        this._applet_icon_box.set_alignment(Align.MIDDLE,Align.MIDDLE);
        size = undefined;
        // End of icon_rotate
    }

    // This updates the display of the applet and the tooltip
    updateUI() {
        if (this.isUpdatingUI) return;
        this.isUpdatingUI = true;

        if (this.ui_scale !== global.ui_scale) {
            this.define_badge();
            this.ui_scale = global.ui_scale;
        }

        //if (DEBUG()) this.cinnamon_server_is_down = true;

        if (this.cinnamon_server_is_down) {
            this.do_rotation = false;
            this.nb_to_update = 0;
            this.nb_to_watch = 0;
            this.refresh_requested = false;
            for (let t of TYPES) {
                this.menuDots[t] === false
            }
        }

        if (this.do_rotation) {
            if (!this.interval)
                this.interval = setInterval(() => this.icon_rotate(), 10);
        }

        this.set_icon_color();

        if (this.nb_to_update > 0 || this.nb_to_watch > 0) {
            this.tooltip_contents = "<b>" + this.default_tooltip + "</b>";
            var tooltip_was_modified = false;
            for (let type of TYPES) {
                if (this.old_message[type] != "" || this.old_watch_message[type] != "") {
                    if (!tooltip_was_modified) {
                        this.tooltip_contents += "\n%s".format(_("Middle-Click to open useful Cinnamon Settings"));
                        tooltip_was_modified = true;
                    }
                    this.tooltip_contents += "\n\n<b>%s</b>".format(_(type).toLocaleUpperCase());
                    if (this.old_message[type] != "") this.tooltip_contents += "\n\u21BB %s".format(this._clean_str(this.old_message[type].replace(/, /gi, "\n\t")));
                    if (this.old_watch_message[type] != "") this.tooltip_contents += "\n\u2604 %s".format(this._clean_str(this.old_watch_message[type].replace(/, /gi, "\n\t")));
                }
            }
            if (!tooltip_was_modified) {
                this.tooltip_contents += "\n%s".format(_("Middle-Click to Refresh"));
            }
            this.numberLabel.text = ""+(this.nb_to_update + this.nb_to_watch);
            tooltip_was_modified = undefined;
            //this.numberLabel.text = "888"; // For test only!
        } else if (this.cinnamon_server_is_down) {
            this.tooltip_contents = "<b>" + this.default_tooltip + "</b>" + "\n<b>%s</b>\n%s".format(_("The Cinnamon Server seems to be DOWN!"), _("Middle-Click to Retry"));
            this.numberLabel.text = "⚠";
            this.isProcessing = false;
            this.set_icon_color();
        } else {
            this.tooltip_contents = "<b>" + this.default_tooltip + "</b>" + "\n%s".format(_("Middle-Click to Refresh"));
            this.numberLabel.text = "";
            this.isProcessing = false;
            this.set_icon_color();
        }

        let fontSize = this.badge_font_size();
        if (this.isHorizontal) {
            this.numberLabel.set_pivot_point(this.horizontal_anchor_x(), this.horizontal_anchor_y());
            //~ this.numberLabel.anchor_x = this.horizontal_anchor_x();
            //~ this.numberLabel.anchor_y = this.horizontal_anchor_y()
        } else {
            this.numberLabel.set_pivot_point(this.vertical_anchor_x(), this.vertical_anchor_y());
            //~ this.numberLabel.anchor_x = this.vertical_anchor_x();
            //~ this.numberLabel.anchor_y = this.vertical_anchor_y() // FIXME: anchor_x and anchor_y are DEPRECATED. Use pivot_point instead.
        }
        this.numberLabel.style = "font-size: %spx; padding: 0px; color: %s;".format(""+fontSize, this.defaultColor);

        if (!this.do_rotation && this.interval) {
            Tweener.addTween(this.actor, {
                opacity: 0,
                transition: "linear",
                time: 0.5,
                onComplete: Lang.bind(this, function() {
                    clearInterval(this.interval);
                    this.interval = null;
                    this.angle = 0;
                    this.set_applet_icon_symbolic_name("spices-update");
                    this.set_icon_color();
                })
            });
        }

        if (this.numberLabel.text.length === 0) this.badge.hide();
        else this.badge.show();

        fontSize = undefined;

        this.isUpdatingUI = false;
        // End of updateUI
    }

    // This is the loop run at general_frequency rate to call updateUI() to update the display in the applet and tooltip
    updateLoop() {
        if (this.isLooping === true) {
            //~ logDebug("ONE MORE LOOP requested, but already looping");
            this.isLooping = false;

            if (this.loopId) {
                source_remove(this.loopId);
                this.loopId = null;
            }

            this.loopId = timeout_add_seconds(10, () => this.updateLoop());
            return;
            //return false;

            //~ return SOURCE_CONTINUE;
        }
        //~ logDebug("ONE MORE LOOP!");
        this.isLooping = true;
        if (this.loopId) {
            source_remove(this.loopId);
            this.loopId = null;
        }

        this.check_dependencies();

        this.iteration = (this.iteration + 1) % 10;

        // Inhibits also after the applet has been removed from the panel
        if (this.applet_running === true) {
            //this.get_translated_help_file();

            //var t;
            for (let t of TYPES) {
                this.OKtoPopulateSettings[t] = true;
                //log("_was_empty_local_dir(%s): %s".format(t.toString(), this._was_empty_local_dir(t).toString() ), true);
            }

            this.do_rotation = true;
            this.updateUI(); // update icon and tooltip
            if (!this.dependenciesMet) {
                this.refreshInterval = 10;
            } else {
                for (let t of TYPES) {
                    this._whether_empty_or_not(t);
                }
                if (!this.first_loop) {
                    //~ this.refreshInterval = QUICK() ? 720 * this.general_frequency : 3600 * this.general_frequency;
                    this.refreshInterval = 3600 * this.general_frequency;
                    var monitor, Id;
                    for (let tuple of this.monitors) {
                        [monitor, Id] = tuple;
                        monitor.disconnect(Id)
                    }
                    this.monitors = [];
                    this.alreadyMonitored = [];
                    for (let type of TYPES) this.monitorsPngId[type] = 0;

                    var must_be_updated;
                    this.nb_to_update = 0;
                    this.nb_to_watch = 0;

                    for (let t of TYPES) {
                        //~ if (t != this.next_type && !this.refresh_requested) continue;
                        //~ logDebug("Checking for "+t);
                        this.populateSettingsUnprotectedSpices(t);
                        if (this.is_to_check(t)) {
                            this._load_cache(t);

                            // About available updates:
                            must_be_updated = this.get_must_be_updated(t);
                            this.nb_in_menu[t] = must_be_updated.length;
                            if (must_be_updated.length > 0) {
                                this.nb_to_update += this.nb_in_menu[t];
                                var filePath, tempdir;
                                this.menuDots[t] = true;
                                let message = "";
                                let uuid = null;
                                if (must_be_updated.length === 1) {
                                    message = "One " + this._get_singular_type(t) + " needs update:";
                                    uuid = must_be_updated[0].split("(")[1].split(")")[0];
                                } else {
                                    message = "Some " + t + " need update:"
                                }
                                this.new_message[t] = _(message) + "\n\t" + must_be_updated.join("\n\t");
                                if (this.force_notifications || this.old_message[t].indexOf(this.new_message[t]) == -1) { // One notification is sufficient!
                                    this.destroy_notifications(t, "updates");
                                    if (this.general_notifications) {
                                        if (this.general_type_notif === "minimal") this.notify_without_button(this._clean_str(this.new_message[t]), t, uuid);
                                        else this.notify_with_button(this._clean_str(this.new_message[t]), t, uuid);
                                    }
                                    this.old_message[t] = this.new_message[t].toString();
                                }

                            } else {
                                this.menuDots[t] = false;
                                this.old_message[t] = "";
                                this.new_message[t] = "";
                            }

                            // About new Spices:
                            if (this.is_to_check_for_new(t) && this.get_new_spices(t)) {
                                this.nb_in_menu[t] += this.new_Spices[t].length;
                                this.nb_to_watch += this.new_Spices[t].length;
                                this.menuDots[t] = true;
                                let watch_message = "";
                                if (this.new_Spices[t].length === 1) {
                                    watch_message = "New " + this._get_singular_type(t) + " available:"
                                } else {
                                    watch_message = "New " + t + " available:"
                                }
                                this.new_watch_message[t] = _(watch_message) + "\n\t" + this.get_are_new(t).join("\n\t");
                                if (this.force_notifications || this.new_watch_message[t] != this.old_watch_message[t]) { // One notification is sufficient!
                                    if (this.general_notifications) {
                                        this.destroy_notifications(t, "news");
                                        if (this.general_type_notif === "minimal") {
                                            this.notify_without_button(this._clean_str(this.new_watch_message[t]), t, null, false);
                                        } else {
                                            this.notify_with_button(this._clean_str(this.new_watch_message[t]), t, null, false);
                                        }
                                    }
                                    this.old_watch_message[t] = this.new_watch_message[t].toString();
                                }
                            } else {
                                this.old_watch_message[t] = "";
                            }
                            if (this.nb_in_menu[t] === 0) {
                                this.destroy_notifications(t);
                            }
                        }
                    }
                    //~ this.next_type = TYPES[(TYPES.indexOf(this.next_type) + 1) % TYPES.length]
                    //this.do_rotation = false;
                } else {
                    this.refreshInterval = 60; // 60 seconds
                    this.first_loop = false;
                }
            }
            this.do_rotation = false;
            this.updateUI(); // update icon and tooltip
            this._set_main_label();
        }

        //this.isLooping = false;
        if (this.applet_running === true && (this.loopId || this.new_loop_requested === true)) {
            this.do_rotation = false;
            if (this.new_loop_requested === true) {
                this.new_loop_requested = false;
                this.refreshInterval = 12; // 12 seconds
            }
            //// One more loop !
            //this.loopId = timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
        }

        this.isLooping = false;

        for (let t of TYPES)
            this.cache[t] = "{}";

        // One more loop !
        this.loopId = timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
        //~ return SOURCE_REMOVE
    } // End of updateLoop

    open_each_download_tab() {
        for (let t of TYPES) {
            if (this.nb_in_menu[t] > 0) {
                let command = "%s %s -t %s -s %s".format(CS_PATH, ""+t, TAB, SORT);
                Util.spawnCommandLineAsync(command);
                command = undefined;
            }
        }
    } // End of open_each_download_tab

    _whether_empty_or_not(type) {
        if (this._was_empty_local_dir(type) != this._is_empty_local_dir(type)) {
            if (this._was_empty_local_dir(type)) {
                // now, local_dir(type) contains something.
                if (!this.settings.getValue("check_%s".format(type))) {
                    this.settings.setValue("check_%s".format(type), true);
                }
                this.settings.setValue("was_empty_%s".format(type), false);
            } else {
                // local_dir(type) became empty
                if (this.settings.getValue("check_%s".format(type))) {
                    //this.settings.setValue("check_new_%s".format(type), false);
                    this.settings.setValue("check_%s".format(type), false);
                }
                this.settings.setValue("was_empty_%s".format(type), true);
            }
        }
    } // End of _whether_empty_or_not

    _onButtonPressEvent(actor, event) {
        if (event.get_button() == 2) {
            if ((this.nb_to_update + this.nb_to_watch) === 0) {
                this._on_refresh_pressed();
            } else {
                this.open_each_download_tab();
            }
        }
        return super._onButtonPressEvent(actor, event);
    } // End of _onButtonPressEvent

    on_applet_clicked(event) {
        this.makeMenu();
        this.updateUI();
        this.menu.toggle();
    } // End of on_applet_clicked

    on_generic_changed() {
        // Nothing to do.
    } // End of on_generic_changed

    on_applet_added_to_panel() {
        // Events:
        this._connectIds = [];
        this._connectIds.push(this.actor.connect("enter-event", (actor, event) => this.on_enter_event(actor, event)));
        this._connectIds.push(this.actor.connect("leave-event", (actor, event) => this.on_leave_event(actor, event)));

        this.on_settings_changed();
        // Run the loop !
        this.iteration = 0;
        this.isLooping = false;
        this.new_loop_requested = false;

        if (Widget.get_default_direction() === TextDirection.RTL) {
            this._applet_tooltip._tooltip.set_style("text-align: right;");
        } else {
            this._applet_tooltip._tooltip.set_style("text-align: left;");
        }

        let _screen;
        if (Display.get_default().get_default_screen)
            _screen = Display.get_default().get_default_screen(); // Glib >= 3.20
        else
            _screen = Display.get_default().get_screen(0); // 2.2 <= Glib < 3.20

        this.tooltip_max_width = Math.round(_screen.get_width() * this.tooltip_max_width_screen_percentage / 100);

        this._applet_tooltip._tooltip.clutter_text.line_wrap = true;
        this._applet_tooltip._tooltip.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        this._applet_tooltip._tooltip.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        _screen = undefined;

        this.updateLoop();
    }

    on_applet_removed_from_panel() {
        this.on_applet_reloaded();

        for (let type of TYPES) {
            this.monitorsPngId[type] = 0;
            this.cache[type] = "{}";
            //~ this.oldCache[type] = "{}";
        }

        if (this.settings) {
            try {
                this.settings.finalize();
            } catch(e) {
                logError(e)
            }
        }
    } // End of on_applet_removed_from_panel

    on_applet_reloaded() {
        // When applet is reloaded or removed from panel: stop the loop, inhibit the update timer,
        // remove all bindings and disconnect all signals (if any) to avoid errors.
        this.applet_running = false;
        if (this.loopRefreshId) {
            source_remove(this.loopRefreshId);
        }
        this.loopRefreshId = null;

        if (this.loopId) {
            source_remove(this.loopId);
        }
        this.loopId = null;

        if (this.interval){
            clearInterval(this.interval);
        }
        this.interval = null;

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = null;

        if (this.loopCacheIntervalId) {
            clearInterval(this.loopCacheIntervalId);
            this.loopCacheIntervalId = null;
        }


        this.destroy_all_notifications();

        var monitor, Id;
        for (let tuple of this.monitors) {
            [monitor, Id] = tuple;
            try {
                monitor.disconnect(Id)
            } catch(e) {
                logError("Unable to disconnect monitor: "+e)
            }
        }
        this.monitors = [];

        if (this.netMonitors) {
            for (let tuple of this.netMonitors) {
                let [monitor, Id] = tuple;
                try {
                    monitor.disconnect(Id)
                } catch(e) {
                    logError("Unable to disconnect network monitor: "+e)
                }
            }
            this.netMonitors = [];
        }

        while (this._connectIds.length > 0) {
            this.actor.disconnect(this._connectIds.pop());
        }

        if (this._signalsConnectId) {
            this.signals.disconnect(this._signalsConnectId);
        }
    } // End of on_applet_reloaded

    on_panel_height_changed() {
        this.define_badge();
        this.updateUI()
    } // End of on_panel_height_changed

    on_panel_icon_size_changed() {
        this.on_panel_height_changed()
    } // End of on_panel_icon_size_changed

    /**
    * Events
    */
    on_enter_event(actor, event) {
        let width = Math.min(this.get_pango_pixels_size(this.tooltip_contents)[0], this.tooltip_max_width);
        this._applet_tooltip._tooltip.clutter_text.width = width;

        this.set_applet_tooltip(this.tooltip_contents, true);
    } // End of on_enter_event

    get_pango_pixels_size(str) {
        let label = Gtk.Label.new("");
        let pango_layout = label.get_layout();
        pango_layout.set_markup(str, -1);
        let font_name = this._applet_tooltip._tooltip.clutter_text.get_font_name();
        let pango_font_desc = Pango.FontDescription.from_string(font_name);
        pango_layout.set_font_description(pango_font_desc);
        let ret = pango_layout.get_pixel_size();
        //Util.unref(pango_layout);
        //Util.unref(label);
        //Util.unref(pango_font_desc);
        return ret
    } // End of get_pango_pixels_size

    on_leave_event(actor, event) {
        this.set_applet_tooltip("", true);
    } // End of on_leave_event

    _set_SU_checks() {
        this.check = {
            "applets" : {
                get_value: () => {return this.check_applets;},
                set_value: (v) => {this.check_applets = v}
            },
            "desklets" : {
                get_value: () => {return this.check_desklets;},
                set_value: (v) => {this.check_desklets = v}
            },
            "extensions" : {
                get_value: () => {return this.check_extensions;},
                set_value: (v) => {this.check_extensions = v}
            },
            "themes" : {
                get_value: () => {return this.check_themes;},
                set_value: (v) => {this.check_themes = v}
            },
            "actions" : {
                get_value: () => {return this.check_actions;},
                set_value: (v) => {this.check_actions = v}
            }
        };

        this.check_new = {
            "applets" : {
                get_value: () => {return this.check_new_applets;},
                set_value: (v) => {this.check_new_applets = v}
            },
            "desklets" : {
                get_value: () => {return this.check_new_desklets;},
                set_value: (v) => {this.check_new_desklets = v}
            },
            "extensions" : {
                get_value: () => {return this.check_new_extensions;},
                set_value: (v) => {this.check_new_extensions = v}
            },
            "themes" : {
                get_value: () => {return this.check_new_themes;},
                set_value: (v) => {this.check_new_themes = v}
            },
            "actions" : {
                get_value: () => {return this.check_new_actions;},
                set_value: (v) => {this.check_new_actions = v}
            }
        };
    } // End of _set_SU_checks

    async fetchJson(url, params="") {
        let _url = ""+url;
        if (params.length > 0)
            _url += "?" + params.trim();

        let response = await this.http.LoadJsonAsync(_url);
        if (!response.Success) {
            this.cinnamon_server_is_down = true;
            logError(`fetchJson: HTTP Error! status : ${response.status}; url=${_url}`);
            return null;
        }
        this.cinnamon_server_is_down = false;
        _url = undefined;
        return response.Data;
    } // End of fetchJson

    async fetch(url, params="", header="") {
        let _url = ""+url;
        if (params.length > 0)
            _url += "?" + params.trim();

        let response = await this.http.LoadAsync(_url);
        if (!response.Success) {
            this.cinnamon_server_is_down = true;
            logError(`fetch: HTTP Error! status : ${response.status}; url=${_url}`);
            return null;
        }
        this.cinnamon_server_is_down = false;
        _url = undefined;
        return response.Data;
    } // End of fetch
} // End of class SpicesUpdate


function main(metadata, orientation, panelHeight, instance_id) {
    return new SpicesUpdate(metadata, orientation, panelHeight, instance_id);
}
