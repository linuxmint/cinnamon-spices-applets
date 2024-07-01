/* Spices Update (SpicesUpdate@claudiux) */
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Util = imports.misc.util;
const Extension = imports.ui.extension;
const Tooltips = imports.ui.tooltips;
const Json = imports.gi.Json;
const Soup = imports.gi.Soup;
const {SignalManager} = imports.misc.signalManager;
const Cinnamon = imports.gi.Cinnamon;


const {
    UUID,
    HOME_DIR,
    APPLET_DIR,
    SCRIPTS_DIR,
    ICONS_DIR,
    HELP_DIR,
    CS_PATH,
    URL_SPICES_HOME,
    CONFIG_DIR,
    SU_CONFIG_DIR,
    CACHE_DIR,
    TYPES,
    URL_MAP,
    CACHE_MAP,
    DIR_MAP,
    DCONFCACHEUPDATED,
    DOWNLOAD_TIME,
    TAB,
    SORT,
    _,
    EXP1, EXP2, EXP3,
    DEBUG,
    RELOAD,
    capitalize,
    log,
    logError
} = require("./constants");

const {versionCompare} = require("./utils");

const ICONTHEME = Gtk.IconTheme.get_default();
ICONTHEME.prepend_search_path(ICONS_DIR);
//ICONTHEME.add_resource_path(ICONS_DIR);


Util.spawnCommandLine("/bin/sh -c '%s/witness-debian.sh'".format(SCRIPTS_DIR));



const _httpSession = new Soup.Session();
_httpSession.timeout=60;
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());


function getImageAtScale(imageFileName, width, height) {
    let pixBuf = GdkPixbuf.Pixbuf.new_from_file_at_size(imageFileName, width, height);
    let image = new Clutter.Image();
    image.set_data(
        pixBuf.get_pixels(),
        pixBuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGBA_888,
        width, height,
        pixBuf.get_rowstride()
    );

    let actor = new Clutter.Actor({width: width, height: height});
    actor.set_content(image);

    return actor;
}


function SU_setup_logging(quiet = false, verbose = false) {
    if (quiet) {
        // quiet mode
        hidden_levels = GLib.LogLevelFlags.LEVEL_MESSAGE | GLib.LogLevelFlags.LEVEL_INFO | GLib.LogLevelFlags.LEVEL_DEBUG | GLib.LogLevelFlags.LEVEL_WARNING;

    } else if (verbose) {
        // verbose mode

    } else {
        // normal mode

    }
}

let SpicesUpdate_Notification;
if (versionCompare( GLib.getenv('CINNAMON_VERSION') ,"4.6.0" ) < 0 ) {
    SpicesUpdate_Notification = require("./notifications_upto_44");
} else {
    SpicesUpdate_Notification = require("./notifications_from_46");
}

let SU_Notification = SpicesUpdate_Notification.SU_Notification;

/**
 * criticalNotify:
 * (Code from imports.ui.main ; modified to return notification, to allow to destroy it.)
 * @msg: A critical message
 * @details: Additional information
 */
var messageTray = new MessageTray.MessageTray();
function criticalNotify(msg, details, icon, button=[]) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new SU_Notification(source, msg, details, { icon: icon });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.CRITICAL);
    if (button!="" && button != []) {
        // button structure: [label, action, command]
        notification.addButton(button[1], button[0]);
        notification.connect("action-invoked", (self, action) => {
            if (action === button[1]) {
                Util.spawnCommandLine(button[2]);
            }
        });
    }
    source.notify(notification);
    return notification;
}

/**
 * To prevent this issue: https://github.com/linuxmint/cinnamon/issues/9499
 */
if (versionCompare( GLib.getenv('CINNAMON_VERSION') ,"4.6.0" ) >= 0 ) {
    // Problem: this code is still used, but it's the code from /4.6 that should be used !
    criticalNotify(_("You are advised to restart Cinnamon"),
        _("To be sure to use the right code, you are advised to restart Cinnamon."),
        new St.Icon({
            icon_name: "spices-update",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: 32 }
        ),
        [_("Restart Cinnamon"), "restart", "cinnamon --replace"]
    );
}

/**
 * Class SpicesUpdate
 */
class SpicesUpdate extends Applet.TextIconApplet {

    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.instanceId = instance_id;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Can be used on horizontal or vertical panels.
        this.set_applet_icon_symbolic_name("spices-update");
        this.default_tooltip = "%s %s".format(_("Spices Update"), metadata.version);
        this.set_applet_tooltip(this.default_tooltip + "\n%s".format(_("Middle-Click to Refresh")));

        this.img_path = ICONS_DIR + "/spices-update-symbolic.svg";
        //this.general_frequency = 10; //(seconds between two loops)
        this.isUpdatingUI = false;
        this.angle = 0;
        this.do_rotation = false;
        this.interval = 0;
        this.ui_scale = global.ui_scale;


        // To be sure that the scripts will be executable:
        Util.spawnCommandLineAsync("/bin/bash -c 'cd %s && chmod 755 *.py *.sh'".format(SCRIPTS_DIR), null, null);

        this.notification = null;

        this.force_notifications = false; // Set to true for tests.
        if (!DEBUG()) this.force_notifications = false;

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
        this.oldCache = {};
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
            this.oldCache[t] = "{}";
            this.menuDots[t] = false;
            this.monitorsPngId[t] = 0; // Monitoring png directories: Ids
            this.nb_in_menu[t] = 0;
            this.new_Spices[t] = [];
        }

        // Default icon color
        this.defaultColor = "#000000FF";

        // Monitoring metadata.json files and png directories
        this.monitors = []; // new Array();
        this.alreadyMonitored = []; // Contains the UUIDs of xlets already monitored, to avoid multiple monitoring.

        // Count of Spices to update
        this.nb_to_update = 0;

        // Count of new Spices
        this.nb_to_watch = 0;

        // Types to check
        this.types_to_check = [];
        this.types_to_check_new = [];

        this.testblink = [];

        // ++ Settings
        this.get_SU_settings();

        this._set_SU_checks();


        this.on_orientation_changed(orientation);

        // Translated help file (html)
        //this.help_file = this.get_translated_help_file();

        // Init lists of Spices:
        for (let t of TYPES) this.populateSettingsUnprotectedSpices(t);

        // Dependencies:
        this.dependenciesMet = this.are_dependencies_installed();
        if (!this.dependenciesMet) this.refreshInterval = 5;

        // ++ Set up Left Click Menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Badge
        this.badge = null;
        this.define_badge();
        this.signals = new SignalManager(null);
        this.signals.connect(global, "scale-changed", () => this.updateUI());

        this.details_by_uuid = {};
        this.forceRefresh = false;
        this.refresh_requested = false;
        this.applet_running = true;
        this.loopId = 0;
        this.first_loop = true; // To do nothing for 1 minute.
        this.on_settings_changed();
        // Run the loop !
        this.iteration = 0;
        this.isLooping = false;
        this.new_loop_requested = false;
        this.updateLoop();
        // End of constructor
    }

    get_SU_settings() {
        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

        if (this.settings.getValue("first_time")) {
            // This part of the code will only be executed the very first time SpicesUpdate 6+ is used.
            var isEmpty;
            for (let t of TYPES) {
                this.download_cache(t, true);
                isEmpty = this._is_empty_local_dir(t);
                this.settings.setValue("was_empty_%s".format(t), isEmpty);
                this.settings.setValue("check_%s".format(t), !isEmpty);
                this.settings.setValue("check_new_%s".format(t), false);
            }
            this.settings.setValue("first_time", false);
            let icon = new St.Icon({
                icon_name: "spices-update",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 32 });
            criticalNotify(
                _("Spices Update has just been installed or upgraded"),
                _("Certain parameters require your vigilance: some may have been modified; others are new.") +
                "\n\n" + _("Please check your settings using the menu of the SpicesUpdate applet or the button below."),
                icon,
                [_("Spices Update Settings"), "open-settings", "xlet-settings applet SpicesUpdate@claudiux %s".format(this.instanceId.toString())]
                );

        }

        // Applets
        this.settings.bind(
            "check_applets", // The setting key
            "check_applets", // The property to manage (this.check_applets)
            this.on_settings_changed.bind(this), // Callback when value changes
            null); // Optional callback data

        this.settings.bind(
            "check_new_applets",
            "check_new_applets",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "exp_applets",
            "exp_applets",
            null,
            null);
        this.exp_applets = "%s\n%s\n%s".format(EXP1["applets"], EXP2["applets"], EXP3);

        this.settings.bind(
            "unprotected_applets",
            "unprotected_applets",
            this.populateSettingsUnprotectedApplets.bind(this),
            null);

        // Desklets
        this.settings.bind(
            "check_desklets",
            "check_desklets",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "check_new_desklets",
            "check_new_desklets",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "exp_desklets",
            "exp_desklets",
            null,
            null);
        this.exp_desklets = "%s\n%s\n%s".format(EXP1["desklets"], EXP2["desklets"], EXP3);

        this.settings.bind(
            "unprotected_desklets",
            "unprotected_desklets",
            this.populateSettingsUnprotectedDesklets.bind(this),
            null);

        // Extensions
        this.settings.bind(
            "check_extensions",
            "check_extensions",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "check_new_extensions",
            "check_new_extensions",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "exp_extensions",
            "exp_extensions",
            null,
            null);
        this.exp_extensions = "%s\n%s\n%s".format(EXP1["extensions"], EXP2["extensions"], EXP3);

        this.settings.bind(
            "unprotected_extensions",
            "unprotected_extensions",
            this.populateSettingsUnprotectedExtensions.bind(this),
            null);

        // Themes
        this.settings.bind(
            "check_themes",
            "check_themes",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "check_new_themes",
            "check_new_themes",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "exp_themes",
            "exp_themes",
            null,
            null);
        this.exp_themes = "%s\n%s\n%s".format(EXP1["themes"], EXP2["themes"], EXP3);

        this.settings.bind(
            "unprotected_themes",
            "unprotected_themes",
            this.populateSettingsUnprotectedThemes.bind(this),
            null);

        // General settings
        this.settings.bind(
            "general_frequency",
            "general_frequency",
            this.on_frequency_changed.bind(this),
            null);
        this.refreshInterval = DEBUG() ? 120 * this.general_frequency : 3600 * this.general_frequency;

        this.settings.bind(
            "general_first_check",
            "general_first_check",
            null,
            null);
        this.first_loop = this.general_first_check;

        this.settings.bind(
            "general_next_check_date",
            "general_next_check_date",
            null,
            null);
        let now = Math.ceil(Date.now()/1000);
        if (this.general_next_check_date === 0) {
            this.general_next_check_date = now + this.refreshInterval;
            //logError("now=%s ; this.general_next_check_date=%s".format(
            //  now.toString(),
            //  this.general_next_check_date.toString())
            //);
        }

        this.settings.bind(
            "general_warning",
            "general_warning",
            this.updateUI.bind(this),
            null);

        this.settings.bind(
            "events_color",
            "events_color",
            this.updateUI.bind(this),
            null);

        this.settings.bind(
            "general_notifications",
            "general_notifications",
            this.on_settings_changed.bind(this),
            null);

        this.settings.bind(
            "general_details_requested",
            "details_requested",
            null,
            null);

        this.settings.bind(
            "general_show_updateall_button",
            "general_show_updateall_button",
            null,
            null);

        this.settings.bind(
            "general_type_notif",
            "general_type_notif",
            null,
            null);

        this.settings.bind(
            "displayType",
            "displayType",
            this.on_display_type_changed.bind(this),
            null);

        this.settings.bind(
            "general_hide",
            "general_hide",
            this.on_display_type_changed.bind(this),
            null);
        // End of get_SU_settings
    }

    define_badge() {
        if (this.badge !== null) this.actor.remove_child(this.badge);
        this.badge = new St.BoxLayout({
            style_class: "SU-badge",
            important: true,
            width: 12 * global.ui_scale,
            height: 12 * global.ui_scale,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE,
            show_on_set_parent: false,
            style: "margin: 0;",
        });
        this.numberLabel = new St.Label({
            style: "font-size: 10px;padding: 0px;",
            style_class: "SU-number-label",
            important: true,
            text: "",
            anchor_x: -3 * global.ui_scale,
            anchor_y: 1 + (global.ui_scale > 1 ? 2 : 0)
        });
        this.numberLabel.clutter_text.ellipsize = false;
        this.badge.add(this.numberLabel, {
            x_align: St.Align.START,
            y_align: St.Align.START,
        });
        this.actor.add_child(this.badge);
        // End of define_badge
    }

    /**
     * get_user_language()
     * Returns the language of the user.
     */
    get_user_language() {
        let _language;
        try {
            _language = GLib.get_language_names().toString().split(",")[0].toString();
        } catch(e) {
            // Unable to detect language. Return English by default.
            _language = "en";
        }
        log("_language = " + _language);
        return _language;
        // End of get_user_language
    }

    /** get_translated_help_file()
     * Returns the help file in html format
     */
    //~ get_translated_help_file() {
        //~ let default_file_name = HELP_DIR + "/en/README.html";
        //~ let help_file = Gio.file_new_for_path(default_file_name);
        //~ let language = "";
        //~ let lang = "";
        //~ if (!help_file.query_exists(null)) {
            //~ return null;
        //~ }
        //~ try {
            //~ language = GLib.get_language_names().toString().split(",")[0].toString();
        //~ } catch(e) {
            //~ // Unable to detect language. Return English help file by default.
            //~ return default_file_name;
        //~ }
        //~ let file_name = "%s/%s/README.html".format(HELP_DIR, language);
        //~ help_file = Gio.file_new_for_path(file_name);
        //~ if (help_file.query_exists(null)) {
            //~ return file_name;
        //~ } else {
            //~ lang = language.split("_")[0].toString();
            //~ if (lang === language) {
                //~ // Not found
                //~ return default_file_name;
            //~ } else {
                //~ file_name = "%s/%s/README.html".format(HELP_DIR, lang);
                //~ help_file = Gio.file_new_for_path(file_name);
                //~ if (help_file.query_exists(null)) {
                    //~ return file_name;
                //~ } else {
                    //~ return default_file_name;
                //~ }
            //~ }
        //~ }
        //~ // End of get_translated_help_file
    //~ }

    notify_without_button(message, type, uuid = null, about_updates = true) {
        let source = new MessageTray.SystemNotificationSource();
        if (Main.messageTray) {
            Main.messageTray.add(source);
            let gicon = Gio.icon_new_for_string(APPLET_DIR + "/icon.png");
            let icon = new St.Icon({ gicon: gicon, "icon-size": 32});
            let notification = new MessageTray.Notification(source, _("Spices Update"), message, {icon: icon});
            notification.setTransient(false);
            notification.setResident(true);
            notification.setUseActionIcons(false);
            about_updates ? this.notifications_about_updates[type].push(notification) : this.notifications_about_news[type].push(notification);
            notification.connect("destroy", (self) => {
                        about_updates ? this.old_message[type] = "" : this.old_watch_message[type] = "";
                    });
            source.notify(notification);
        }
        // End of notify_without_button
    }

    notify_with_button(message, type, uuid = null, about_updates = true) {
        let source = new MessageTray.SystemNotificationSource();
        if (Main.messageTray) {
            Main.messageTray.add(source);
            let gicon = Gio.icon_new_for_string(APPLET_DIR + "/icon.png");
            let icon = new St.Icon({ gicon: gicon, "icon-size": 32});
            let notification = new SU_Notification(source, _("Spices Update"), message, {icon: icon});
            notification.setTransient(false);
            notification.setResident(true);
            notification.setUseActionIcons(true);
            //notification._scrollArea["vscrollbar_policy"] = Gtk.PolicyType.NEVER; // EXTERNAL ? (GLib >= 3.16)
            //notification._scrollArea["vscrollbar_policy"] = Gtk.PolicyType.EXTERNAL;
            //notification._scrollArea.enable_mouse_scrolling = true;
            let img_uri = GLib.filename_to_uri("%s/cs-%s.png".format(ICONS_DIR, type.toString()), null);
            if (uuid !== null) {
                let uri= CACHE_DIR + "/" + this._get_singular_type(type) + "/" + uuid + ".png";
                let file = Gio.file_new_for_path(uri);
                if (file.query_exists(null)) {
                    img_uri = GLib.filename_to_uri(uri, null);
                }
            }
            let img_size = Math.round(notification.IMAGE_SIZE/2);
            let image = St.TextureCache.get_default().load_uri_async(img_uri, img_size, img_size);
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
                        if (action == "su-%s-symbolic".format(type.toString())) {
                            Util.spawnCommandLine("%s %s -t %s -s %s".format(CS_PATH, type.toString(), TAB, SORT));
                        } else if (action == "software-update-available-symbolic") {
                            Util.spawnCommandLine("%s %s -t %s -s %s -u".format(CS_PATH, type.toString(), TAB, SORT));
                            let n = this.notifications_about_updates[type].pop(this.notifications_about_updates[type].indexOf(notification));
                            n.destroy(3);
                        } else if (action == "su-forget-symbolic") {
                            this._forget_new_spices(type);
                            while (this.notifications_about_news[type].length != 0) {
                                let n = this.notifications_about_news[type].pop();
                                n.destroy(3);
                            }
                        } else if (action == "emblem-synchronizing-symbolic"){
                            if (this.force_notifications === true) {
                                if (about_updates) {
                                    while (this.notifications_about_updates[type].length != 0) {
                                        let n = this.notifications_about_updates[type].pop();
                                        n.destroy(3);
                                    }
                                } else {
                                    while (this.notifications_about_news[type].length != 0) {
                                        let n = this.notifications_about_news[type].pop();
                                        n.destroy(3);
                                    }
                                }
                            } else {
                                let n = this.notifications_about_updates[type].pop(this.notifications_about_updates[type].indexOf(notification));
                                n.destroy(3);
                            }
                            about_updates ? this.old_message[type] = "" : this.old_watch_message[type] = "";
                            this._on_refresh_pressed("notify_with_button");
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
        }
        // End of notify_with_button
    }

    on_notif_for_new_changed() {
        if (!this.notif_for_new) {
            this.nb_to_watch = 0;
            for (let t of TYPES) {
                this.new_Spices[t] = [];
                this.old_watch_message[t] = "";
            }
        }
        this._on_refresh_pressed("on_notif_for_new_changed");
        // End of on_notif_for_new_changed
    }

    on_orientation_changed (orientation) {
        this.orientation = orientation;
        this.isHorizontal = !(this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
        this._set_main_label();
        // End of on_orientation_changed
    }

    _set_main_label() {
        if (this.general_hide === true && this.nb_to_update === 0 && this.nb_to_watch === 0) {
            this.set_applet_label("");
            this.actor.hide();
            return
        }
        this.actor.show();
        if (this.displayType === "compact") {
            this.set_applet_label("");
        } else {
            if (this.isHorizontal === true) {
                this.set_applet_label(_("Spices Update"));
            } else {
                this.set_applet_label("SpU");
            }
        }
        // End of _set_main_label
    }

    _is_time_to_check() {
        let now = Math.ceil(Date.now()/1000);
        let ret = (now >= this.general_next_check_date - 5);

        this.refreshInterval = 3600 * this.general_frequency;
        if (DEBUG()) this.refreshInterval = 120 * this.general_frequency;
        if (ret === true) {
            this.general_next_check_date = now + this.refreshInterval;
        }


        log("Is it time to check? %s. Now: %s. Next: %s. Interval: %s".format(
            ret.toString(),
            now.toString(),
            this.general_next_check_date.toString(),
            this.refreshInterval.toString()
        ));

        return ret;
        // End of _is_time_to_check
    }

    on_frequency_changed() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        let coeff = DEBUG() ? 120 : 3600;
        this.refreshInterval = coeff * this.general_frequency;
        this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
        // End of on_frequency_changed
    }

    on_display_type_changed() {
        // Label
        this._set_main_label();
        // End of on_display_type_changed
    }

    // ++ Function called when settings are changed
    on_settings_changed() {
        // Label
        this._set_main_label();

        // Refresh intervall:
        this.refreshInterval = 3600 * this.general_frequency;
        if (DEBUG()) this.refreshInterval = 120 * this.general_frequency;

        // Types to check
        this.types_to_check = [];
        this.types_to_check_new = [];

        // All xlets
        for (let type of TYPES) {
            let _dir_xlets = Gio.file_new_for_path(DIR_MAP[type]);
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
        }
        // End of on_settings_changed
    }

    // Buttons in settings:
    on_btn_test_notif_pressed() {
        let details = "";
        if (this.details_requested === true) details = _("With details here, when available.")+"\n\t";
        let message = _("One applet needs update:")
            + "\n%s\n\t".format(UUID) + details + _("Do not matter. This is a FAKE notification, just for the test.");
        if (this.general_type_notif === "minimal") {
            this.notify_without_button(message, TYPES[0]);
        } else {
            this.notify_with_button(message, TYPES[0]);
        }
        // End of on_btn_test_notif_pressed
    }

    on_btn_refresh_applets_pressed() {
        this._on_refresh_pressed("on_btn_refresh_applets_pressed");
        // End of on_btn_refresh_applets_pressed
    }

    on_btn_refresh_desklets_pressed() {
        this._on_refresh_pressed("on_btn_refresh_desklets_pressed");
        // End of on_btn_refresh_applets_pressed
    }

    on_btn_refresh_extensions_pressed() {
        this._on_refresh_pressed("on_btn_refresh_extensions_pressed");
        // End of on_btn_refresh_applets_pressed
    }

    on_btn_refresh_themes_pressed() {
        this._on_refresh_pressed("on_btn_refresh_themes_pressed");
        // End of on_btn_refresh_applets_pressed
    }

    on_btn_cs_applets_pressed() {
        Util.spawnCommandLine("%s applets -t %s -s %s".format(CS_PATH, TAB, SORT));
        // End of on_btn_cs_applets_pressed
    }

    on_btn_cs_desklets_pressed() {
        Util.spawnCommandLine("%s desklets -t %s -s %s".format(CS_PATH, TAB, SORT));
        // End of on_btn_cs_desklets_pressed
    }

    on_btn_cs_extensions_pressed() {
        Util.spawnCommandLine("%s extensions -t %s -s %s".format(CS_PATH, TAB, SORT));
        // End of on_btn_cs_extensions_pressed
    }

    on_btn_cs_themes_pressed() {
        Util.spawnCommandLine("%s themes -t %s -s %s".format(CS_PATH, TAB, SORT));
        // End of on_btn_cs_themes_pressed
    }

    _is_empty_local_dir(type) {
        let dir = Gio.file_new_for_path(DIR_MAP[type]);
        let isEmpty = true;
        let info;
        if (dir.query_exists(null)) {
            let children = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
            if ((info = children.next_file(null)) != null) {
                isEmpty = false;
            }
            children.close(null);
        }
        return isEmpty;
        // End of _is_empty_local_dir
    }

    _was_empty_local_dir(type) {
        return this.settings.getValue("was_empty_%s".format(type));
        // End of _was_empty_local_dir
    }

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
        if (this.OKtoPopulateSettings[type] === true) {
            // Prevents multiple access to the json config file of SpiceUpdate@claudiux:
            this.OKtoPopulateSettings[type] = false;
            this.unprotectedList[type] = [];
            this.unprotectedDico[type] = {};
            var unprotectedSpices;
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

            }

            // populate this.unprotected_<type> with the this.unprotected_<type> elements, removing uninstalled <type>:
            for (var i=0; i < unprotectedSpices.length; i++) {
                let a = unprotectedSpices[i];
                let d = Gio.file_new_for_path("%s/%s".format(DIR_MAP[type], a["name"]));
                if (d.query_exists(null)) {
                    this.unprotectedDico[type][a["name"]] = a["isunprotected"];
                    let metadataFileName = DIR_MAP[type] + "/" + a["name"] + "/metadata.json";
                    if (a["isunprotected"] && a["requestnewdownload"] !== undefined && a["requestnewdownload"] === true) {
                        if (this.cache[type] === "{}") this._load_cache(type);
                        let created = this._get_member_from_cache(type, a["name"], "created");
                        let last_edited = this._get_last_edited_from_cache(type, a["name"]);
                        if (created !== null && last_edited !== null && created >= last_edited) created = last_edited - 1;

                        if (created !== null) this._rewrite_metadataFile(metadataFileName, created);
                    }
                    if (!a["isunprotected"]) {
                        this._rewrite_metadataFile(metadataFileName, Math.ceil(Date.now()/1000));
                    }
                    this.unprotectedList[type].push({"name": a["name"], "isunprotected": a["isunprotected"], "requestnewdownload": false});
                }
            }

            // Are there new applets installed? If there are, then push them in this.unprotected_applets:
            let dir = Gio.file_new_for_path(DIR_MAP[type]);
            if (dir.query_exists(null)) {
                let children = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
                let info, file_type;
                var name;

                while ((info = children.next_file(null)) != null) {
                    file_type = info.get_file_type();
                    if (file_type == Gio.FileType.DIRECTORY) {
                        name = info.get_name().toString();
                        if (this.unprotectedDico[type][name] === undefined) {
                            this.unprotectedList[type].push({"name": name, "isunprotected": true, "requestnewdownload": false});
                            this.unprotectedDico[type][name] = {};
                            this.unprotectedDico[type][name]["name"] = name;
                            this.unprotectedDico[type][name]["isunprotected"] = true;
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
                }

                children.close(null);
            }
        }
        // End of populateSettingsUnprotectedSpices
    }

    populateSettingsUnprotectedApplets() {
        this.populateSettingsUnprotectedSpices("applets");
        // End of populateSettingsUnprotectedApplets
    }

    populateSettingsUnprotectedDesklets() {
        this.populateSettingsUnprotectedSpices("desklets");
        // End of populateSettingsUnprotectedDesklets
    }

    populateSettingsUnprotectedExtensions() {
        this.populateSettingsUnprotectedSpices("extensions");
        // End of populateSettingsUnprotectedExtensions
    }

    populateSettingsUnprotectedThemes() {
        this.populateSettingsUnprotectedSpices("themes");
        // End of populateSettingsUnprotectedThemes
    }

    _compare(a,b) {
        // We know that a["name"] and b["name"] are different.
        if (a["name"].toLowerCase() < b["name"].toLowerCase()) {
            return -1;
        }
        return 1;
        // End of _compare
    }

    _get_singular_type(t) {
        return t.substr(0, t.length-1);
        // End of _get_singular_type
    }

    are_dependencies_installed() {
        let _fonts_installed = (
            Gio.file_new_for_path("/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf").query_exists(null) ||
            Gio.file_new_for_path("/usr/share/fonts/TTF/Symbola.ttf").query_exists(null) ||
            Gio.file_new_for_path("/usr/share/fonts/gdouros-symbola/Symbola.ttf").query_exists(null) ||
            Gio.file_new_for_path("%s/.local/share/fonts/Symbola_Hinted.ttf".format(HOME_DIR)).query_exists(null) ||
            Gio.file_new_for_path("%s/.local/share/fonts/Symbola.ttf".format(HOME_DIR)).query_exists(null) ||
            Gio.file_new_for_path("%s/.local/share/fonts/Symbola.otf".format(HOME_DIR)).query_exists(null)
        )
        if (!_fonts_installed) {
            let _ArchlinuxWitnessFile = Gio.file_new_for_path("/etc/arch-release");
            let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
            if (_isArchlinux) {
                Util.spawnCommandLineAsync("/bin/sh -c \"%s/install_symbola_on_Arch.sh\"".format(SCRIPTS_DIR), null, null);
                _fonts_installed = true
            }
        }
        this.fonts_installed = _fonts_installed;
        //this.notifysend_installed = GLib.find_program_in_path("notify-send");
        //return (this.fonts_installed && this.notifysend_installed);
        return (this.fonts_installed);
        // End of are_dependencies_installed
    }

    get_terminal() {
        var term_found = "";
        var _terminals = ["gnome-terminal", "tilix", "konsole", "guake", "qterminal", "terminator", "uxterm", "xterm"];
        var t;
        for (t=0; t < _terminals.length ; t++) {
            if (GLib.find_program_in_path(_terminals[t])) {
                term_found = GLib.find_program_in_path(_terminals[t]);
                break
            }
        }
        return term_found;
        // End of get_terminal
    }

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

            // Reload this applet with dependencies installed
            Extension.reloadExtension(UUID, Extension.Type.APPLET);
        } else if (!this.are_dependencies_installed() && this.notification === null) {
            let icon = new St.Icon({
                icon_name: "error",
                icon_type: St.IconType.FULLCOLOR,
                icon_size: 36 });
            // Got a terminal used on this system:
            let terminal = this.get_terminal();
            // apturl is it present?
            let _is_apturl_present = GLib.find_program_in_path("apturl");
            // Detects the distrib in use and make adapted message and notification:
            let _isFedora = GLib.find_program_in_path("dnf");
            let _ArchlinuxWitnessFile = Gio.file_new_for_path("/etc/arch-release");
            let _isArchlinux = _ArchlinuxWitnessFile.query_exists(null);
            let _DebianWitnessFile = Gio.file_new_for_path("/tmp/DEBIAN");
            let _isDebian = _DebianWitnessFile.query_exists(null);
            let _apt_update =  _isFedora ? "sudo dnf update" : _isArchlinux ? "" : _isDebian ? "apt update" : "sudo apt update";
            let _and = _isArchlinux ? "" : " \\\\&\\\\& ";
            //var _apt_install = _isFedora ? "sudo dnf install libnotify gdouros-symbola-fonts" : _isArchlinux ? "sudo pacman -Syu libnotify" : _isDebian ? "apt install fonts-symbola" : "sudo apt install fonts-symbola";
            var _apt_install = _isFedora ? "sudo dnf install gdouros-symbola-fonts" : _isArchlinux ? "" : _isDebian ? "apt install fonts-symbola" : "sudo apt install fonts-symbola";
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
                    Util.spawnCommandLine("/usr/bin/apturl apt://fonts-symbola");
            }
            this.dependenciesMet = false;
        }
        // End of check_dependencies
    }

    _load_cache(type) {
        let jsonFileName = CACHE_MAP[type];
        let jsonFile = Gio.file_new_for_path(jsonFileName);
        if (!jsonFile.query_exists(null)) {
            let jsonDirName = CACHE_DIR + "/" + this._get_singular_type(type);
            GLib.mkdir_with_parents(jsonDirName, 0o755);
            GLib.file_set_contents(jsonFileName,"{}");
        }
        if (jsonFile.query_exists(null)) {
            this.oldCache[type] = this.cache[type];
            //this.cache[type] = GLib.file_get_contents(jsonFileName).toString().substr(5);
            this.cache[type] = GLib.file_get_contents(jsonFileName)[1].toString();
        } else {
            this.cache[type] = "{}"
        }
        // End of _load_cache
    }


    download_cache(type, force = false) {
        let jsonFile = Gio.file_new_for_path(CACHE_MAP[type]);

        //Should we renew the cache?
        let is_to_download = false;
        if (this.forceRefresh === true || force === true) {
            is_to_download = true;
        } else {
            if (jsonFile.query_exists(null)) {
                let jsonModifTime = jsonFile.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                let currentTime = Math.round(new Date().getTime()/1000.0); // GLib.date_time_new_local();
                if (currentTime - jsonModifTime > Math.round(this.refreshInterval/2)) {
                    // the cache is too old
                    is_to_download = true
                }
            } else {
                // the cache doesn't exist
                let jsonDirName = CACHE_DIR + "/" + this._get_singular_type(type);
                GLib.mkdir_with_parents(jsonDirName, 0o755);
                is_to_download = true
            }
        }

        if (is_to_download === true) {
            // replace local json cache file by the remote one
            let message = Soup.Message.new("GET", URL_MAP[type] + GLib.uuid_string_random());
            _httpSession.queue_message(message, Lang.bind(this, this._on_response_download_cache, type, force));
            this.testblink[type]=null;
        }
        // End of download_cache
    }

    _on_response_download_cache(session, message, type, force) {
        if (message.status_code === Soup.KnownStatusCode.OK) {
            let data = message.response_body.data.toString();
            GLib.file_set_contents(CACHE_MAP[type], data); // Records the new cache in the right place.
            this._load_cache(type);
            let jsonFile = Gio.file_new_for_path(CACHE_MAP[type]);
            if (jsonFile.query_exists(null)) {
                let jsonModifTime = jsonFile.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                let _settings_schema = "org.cinnamon";
                if (type === "themes") _settings_schema = "org.cinnamon.theme";
                let _settings_key = "%s-cache-updated".format(this._get_singular_type(type));
                let _interface_settings = new Gio.Settings({ schema_id: _settings_schema });
                _interface_settings.set_int(_settings_key, jsonModifTime);
                if (force && this.get_new_spices(type, true)) {
                    this._forget_new_spices(type);
                    this.new_Spices[type] = [];
                }
            }
        }
        // End of _on_response_download_cache
    }

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

        if (ok === true) {
            return lastEdited
        } else {
            return null
        }
        // End of _get_last_edited_from_cache
    }

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

        if (ok === true) {
            return memberValue
        } else {
            return null
        }
        // End of _get_member_from_cache
    }

    get_spice_name(type, uuid) {
        return _(this._get_member_from_cache(type, uuid, "name"), uuid);
        // End of get_spice_name
    }

    get_spice_description(type, uuid) {
        return _(this._get_member_from_cache(type, uuid, "description"), uuid);
        // End of get_spice_name
    }

    _rewrite_metadataFile(fileName, lastEdited) {
        let metadataFile = Gio.file_new_for_path(fileName);
        let metadataData;
        if (metadataFile.query_exists(null)) {
            //metadataData = GLib.file_get_contents(fileName).toString().substr(5);
            metadataData = GLib.file_get_contents(fileName)[1].toString();
        } else {
            metadataData = "{}";
        }
        let newData = JSON.parse(metadataData);

        // Rewrite metadata.json file only if necessary:
        if (newData["last-edited"] === undefined || newData["last-edited"] !== lastEdited) {
            newData["last-edited"] = lastEdited;
            let message = JSON.stringify(newData, null, 2);
            GLib.file_set_contents(fileName, message);
        }
        // End of _rewrite_metadataFile
    }

    _get_last_edited_from_metadata(type, uuid) {
        var lastEdited = null;
        let metadataParser = new Json.Parser();
        let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
        let metadataFile = Gio.file_new_for_path(metadataFileName);
        let dirName = DIR_MAP[type] + "/" + uuid;
        let dir = Gio.file_new_for_path(dirName);
        let most_recent;

        // For some themes, the metadata.json file is in the subfolder /cinnamon:
        if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
            metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
            metadataFile = Gio.file_new_for_path(metadataFileName);
        }

        if (metadataFile.query_exists(null)) {
            // substr(5) is needed to remove the 'true,' at begin:
            //let metadataData = GLib.file_get_contents(metadataFileName).toString().substr(5);
            let metadataData = GLib.file_get_contents(metadataFileName)[1].toString();
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
                            lastEdited = most_recent.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                            this.get_date_of_nearest_commit(type, uuid, lastEdited, metadataFileName);
                        }
                    }
                }
            }
        }
        return lastEdited;
        // End of _get_last_edited_from_metadata
    }

    _most_recent_file_in(dir) {
        if (dir.query_exists(null)) {
            var latest_time = dir.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
            var latest_file = dir;
            let children = dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
            let info, file_type;
            let file, file_time;
            while ((info = children.next_file(null)) != null) {
                file = children.get_child(info);
                if (file.get_basename() === "metadata.json") continue; // ignore metadata.json file

                file_time = file.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                if (file_time > latest_time) {
                    latest_time = file_time;
                    latest_file = file;
                }
                file_type = info.get_file_type();
                if (file_type == Gio.FileType.DIRECTORY) {
                    file = this._most_recent_file_in(file);
                    file_time = file.query_info("time::modified", Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                    if (file_time > latest_time) {
                        latest_time = file_time;
                        latest_file = file;
                    }
                }
            }
            return latest_file;
        } else {
            return null;
        }
        // End of _most_recent_file_in
    }

    _forget_new_spices(type) {
        for (let uuid of this.new_Spices[type]) this.download_image(type, uuid);
        // End of _forget_new_spices
    }

    _on_forget_new_spices_pressed() {
        for (let type of TYPES) {
            this._forget_new_spices(type);
        }
        // End of _on_forget_new_spices_pressed
    }

    download_image(type, uuid) {
        let memberName, url, target;
        let is_theme = (type === "themes");
        if (is_theme) {
            memberName = "screenshot"
        } else {
            memberName = "icon"
        }
        url = URL_SPICES_HOME + this._get_member_from_cache(type, uuid, memberName);
        if (is_theme) {
            url = url.replace("/files/themes/", "/uploads/themes/thumbs/")
        }
        target = CACHE_DIR + "/" + this._get_singular_type(type) + "/" + uuid + ".png";

        // Variables for the progress bar
        var total_size = 0;
        var bytes_so_far = 0;

        let file = Gio.file_new_for_path(target);
        let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // Create an http message
        var request = Soup.Message.new("GET", url);
        // got_headers event
        request.connect("got_headers", Lang.bind(this, function(message){
            total_size = message.response_headers.get_content_length()
        }));

        // got_chunk event
        var percent = 0;
        request.connect("got_chunk", Lang.bind(this, function(message, chunk){
            bytes_so_far += chunk.length;
            if (total_size) {
                percent = Math.floor(100.0 * bytes_so_far / total_size);
                log("Downloading icon ${target}: ${percent}% done (${bytes_so_far} / ${total_size} bytes)");

                // write each chunk to file
                fstream.write(chunk.get_data(), null);
            }
        }));

        // Queue of the http request
        _httpSession.queue_message(request, Lang.bind(this, function(_httpSession, message) {
            // Download is done; close the file:
            fstream.close(null);
        }));
        // End of download_image
    }

    get_last_commit_subject(type, uuid) {
        let marker_begin = "</span>\]";
        let marker_end = "</div>";
        let subject_regexp = new RegExp(`${marker_begin}(.+)${marker_end}`);
        let url = "https://cinnamon-spices.linuxmint.com/%s/view/%s/".format(type.toString(),
            this._get_member_from_cache(type, uuid, "spices-id").toString());
        var msg = Soup.Message.new("GET", url);

        let iteration = this.iteration;
        // Queue of the http request
        _httpSession.queue_message(msg, Lang.bind(this, function(_httpSession, message) {
            if (message.status_code === Soup.KnownStatusCode.OK && iteration === this.iteration) {
                let data = message.response_body.data;
                let result = subject_regexp.exec(data.toString());
                this.details_by_uuid[uuid] = result[1].toString();
                this.do_rotation = true;
                //this.updateUI();
            } else {
                this.details_by_uuid[uuid] = "";
            }
        }));
        return (this.details_by_uuid[uuid] !== undefined && this.details_by_uuid[uuid] !== "");
        // End of get_last_commit_subject
    }

    get_date_of_nearest_commit(type, uuid, timestamp, fileName) {
        let marker_begin = '<relative-time datetime="';
        let marker_end = '" class="no-wrap">';
        let subject_regexp = new RegExp(`${marker_begin}(.+)${marker_end}`, "g");
        let url = "https://github.com/linuxmint/cinnamon-spices-%s/commits/master/%s".format(type.toString(), uuid);
        var msg = Soup.Message.new("GET", url);

        let iteration = this.iteration;
        // Queue of the http request
        _httpSession.queue_message(msg, Lang.bind(this, function(_httpSession, message) {
            if (message.status_code === Soup.KnownStatusCode.OK && iteration === this.iteration) {
                let data = message.response_body.data;
                let result;
                let commit_time;
                var nearest_commit_time = timestamp;
                var smaller_difference = Math.round(Date.now() / 1000);
                let difference;
                while (result == subject_regexp.exec(data.toString())) {
                    commit_time = Date.parse(result[1].toString()) / 1000;
                    difference = Math.abs(timestamp - commit_time);
                    if (difference < smaller_difference) {
                        smaller_difference = difference;
                        nearest_commit_time = commit_time;
                    }
                }
                this._rewrite_metadataFile(fileName, nearest_commit_time);
                //this.updateUI();
            }
        }));
        // End of get_date_of_nearest_commit
    }

    is_to_check(type) {
        return (this.types_to_check.indexOf(type) > -1);
        // End of is_to_check

    }
    is_to_check_for_new(type) {
        return (this.types_to_check_new.indexOf(type) > -1);
        // End of is_to_check_for_new
    }

    get_can_be_updated(type) {
        var ret = [];
        var spicesList = this.unprotectedList[type];
        for (let s of spicesList) {
            if (s["isunprotected"] === true) {
                ret.push(s["name"])
            }
        }
        return ret;
        // End of get_can_be_updated
    }

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
                                if (this.details_by_uuid[uuid].trim() !== "") {
                                    ret.push("★ %s (%s)\n\t\t« %s »".format(_(this.get_spice_name(type, uuid)), uuid, this.details_by_uuid[uuid].trim()));
                                } else {
                                    ret.push("★ %s (%s)\n\t\t%s".format(_(this.get_spice_name(type, uuid)), uuid, _("(Description unavailable)")));
                                }
                            } else {
                                this.refreshInterval = DOWNLOAD_TIME; // Wait DOWNLOAD_TIME more seconds to avoid the message "(Refresh to see the description)".
                            }
                        } else {
                            ret.push("★ %s (%s)".format(_(this.get_spice_name(type, uuid)), uuid));
                        }
                        this.monitor_metadatajson(type, uuid);
                    }
                }
            }
        }
        return ret;
        // End of get_must_be_updated
    }

    get_are_new(type) {
        var ret = new Array();
        for (let uuid of this.new_Spices[type]) {
            if (this.details_requested === true)
                ret.push("★ %s (%s)\n\t\t« %s »".format(_(this.get_spice_name(type, uuid)),
                                                                                        uuid,
                                                                                        _(this.get_spice_description(type, uuid))))
            else
                ret.push("★ %s (%s)".format(_(this.get_spice_name(type, uuid)), uuid))
        }
        return ret;
        // End of get_are_new
    }

    get_uuids_from_cache(type) {
        var cacheParser = JSON.parse(this.cache[type]);
        let names = Object.keys(cacheParser);
        return names;
        // End of get_uuids_from_cache
    }

    get_new_spices(type, force = false) {
        if (!this.is_to_check_for_new(type) && !force) return false;
        var known_spices = [];
        let uuids = this.get_uuids_from_cache(type);
        let png_dir = Gio.file_new_for_path(HOME_DIR + "/.cinnamon/spices.cache/%s".format(this._get_singular_type(type)));
        if (png_dir.query_exists(null)) {
            let children = png_dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
            let info;
            var name;
            while ((info = children.next_file(null)) != null) {
                name = info.get_name().toString();
                if (info.get_file_type() === Gio.FileType.REGULAR && name.substr(name.length - 4, name.length - 1) === ".png") {
                    known_spices.push(name.substr(0, name.length - 4))
                }
            }
            known_spices = known_spices.sort((a,b) => { if (a<b) return -1; else return 1;});
        }
        this.new_Spices[type] = [];
        uuids.map(x => {if (known_spices.indexOf(x)<0) this.new_Spices[type].push(x);});
        if (this.new_Spices[type].length > 0) this.monitor_png_directory(type);
        return (this.new_Spices[type].length > 0);
        // End of get_new_spices
    }

    monitor_png_directory(type) {
        if (this.monitorsPngId[type] === 0) {
            let pngDirName = HOME_DIR + "/.cinnamon/spices.cache/%s".format(this._get_singular_type(type));
            let pngDir = Gio.file_new_for_path(pngDirName);

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
        }
        // End of monitor_png_directory
    }

    _on_pngDir_changed(type) {
        this._on_refresh_pressed("_on_pngDir_changed");
        // End of _on_pngDir_changed
    }

    monitor_metadatajson(type, uuid) {
        if (this.alreadyMonitored.indexOf(uuid) > -1) return;
        let metadataFileName = DIR_MAP[type] + "/" + uuid + "/metadata.json";
        let metadataFile = Gio.file_new_for_path(metadataFileName);

        // For some themes, the metadata.json file is in the subfolder /cinnamon:
        if (type.toString() === "themes" && !metadataFile.query_exists(null)) {
            metadataFileName = DIR_MAP[type] + "/" + uuid + "/cinnamon/metadata.json";
            metadataFile = Gio.file_new_for_path(metadataFileName);
        }

        if (metadataFile.query_exists(null)) {
            try {
                let monitor = metadataFile.monitor(0, null);
                let Id = monitor.connect("changed", (type, uuid) => this._on_metadatajson_changed(type, uuid));
                this.monitors.push([monitor, Id]);
                this.alreadyMonitored.push(uuid);
                log("alreadyMonitored = " + this.alreadyMonitored.toString());
            } catch(e) {
                // Nothing to do.
            }
        }
        // End of monitor_metadatajson
    }

    _on_metadatajson_changed(type, uuid) {
        if (this.isLooping) {
            this.new_loop_requested = true;
        } else {
            this._on_refresh_pressed("_on_metadatajson_changed");
        }
        // End of _on_metadatajson_changed
    }

    get_active_spices(type) {
        // Returns the list of active spices of type 'type'
        var dconfEnabled;
        var elt = (type.toString() === "applets") ? 3 : 0;
        let listCanBeUpdated = this.get_can_be_updated(type);
        let enabled;
        var listEnabled = new Array();
        let _SETTINGS_SCHEMA, _SETTINGS_KEY;
        let _interface_settings;

        if (type.toString() === "themes") {
            _SETTINGS_SCHEMA = "org.cinnamon.theme";
            _SETTINGS_KEY = "name";
            _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
            enabled = _interface_settings.get_string(_SETTINGS_KEY);
            listEnabled.push(enabled);
            return listEnabled
        }

        _SETTINGS_SCHEMA = "org.cinnamon";
        _SETTINGS_KEY = "enabled-%s".format(type.toString());
        _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });

        enabled = _interface_settings.get_strv(_SETTINGS_KEY);
        let xlet_uuid;
        for (let xl of enabled) {
            xlet_uuid = xl.split(":")[elt].toString().replace(/'/g,"");
            if (!xlet_uuid.endsWith("@cinnamon.org") && (listCanBeUpdated.indexOf(xlet_uuid)>-1))
                listEnabled.push(xlet_uuid);
        }
        return listEnabled;
        // End of get_active_spices
    }

    get_default_icon_color() {
        try {
            let themeNode = this.actor.get_theme_node(); // get_theme_node() fails in constructor! (cause: widget not on stage)
            let icon_color = themeNode.get_icon_colors();
            this.defaultColor = icon_color.foreground.to_string();
        } catch(e) {
            this.defaultColor = "white";
        }
        // End of get_default_icon_color
    }

    makeMenu() {
        this.menu.removeAll();

        // Head
        this.menuitemHead1 = new PopupMenu.PopupMenuItem(this.default_tooltip, {
            reactive: false
        });
        this.menu.addMenuItem(this.menuitemHead1);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.dependenciesMet) {
            // Refresh button
            //this.refreshButton = new PopupMenu.PopupIconMenuItem(_("Refresh"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
            this.refreshButton = new PopupMenu.PopupIconMenuItem(_("Refresh"), "emblem-synchronizing-symbolic", St.IconType.SYMBOLIC);
            this.refreshButton.connect("activate", (event) => this._on_refresh_pressed("makeMenu"));
            this.menu.addMenuItem(this.refreshButton);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
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
            this.spicesMenuItems[t] = new PopupMenu.PopupIndicatorMenuItem(ts);
            this.spicesMenuItems[t].connect("activate", (event) => {
                Util.spawnCommandLine("%s %s -t %s -s %s".format(CS_PATH, t.toString(), TAB, SORT));
            });
            this.spicesMenuItems[t].setShowDot(this.menuDots[t]);
            this.menu.addMenuItem(this.spicesMenuItems[t]);
        }
        // button Forget
        if (this.nb_to_watch > 0) {
            let _forget_button = new PopupMenu.PopupIconMenuItem(_("Forget new Spices") + " -\u2604-", "emblem-ok", St.IconType.SYMBOLIC);
            _forget_button.connect("activate", (event) => this._on_forget_new_spices_pressed());
            this.menu.addMenuItem(_forget_button);
        }
        // button Download
        if ((this.nb_to_update + this.nb_to_watch) > 0) {
            let _download_tabs_button = new PopupMenu.PopupIconMenuItem(_("Open useful Cinnamon Settings"), "su-update-available", St.IconType.SYMBOLIC);
            _download_tabs_button.connect("activate", (event) => this.open_each_download_tab());
            this.menu.addMenuItem(_download_tabs_button);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // sub-menu Configure
        let _configure = new PopupMenu.PopupSubMenuMenuItem(_("Configure"));
        this.menu.addMenuItem(_configure);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let _configureOptions = [_("General"), _("Applets"), _("Desklets"), _("Extensions"), _("Themes")];
        let _iconNames = ["su-general", "su-applets", "su-desklets", "su-extensions", "su-themes"];
        let _options = [];
        for (let i=0; i<_configureOptions.length ; i++) {
            let _optionTitle = _configureOptions[i];
            let _icon = _iconNames[i];
            _options[i] = new PopupMenu.PopupIconMenuItem(_optionTitle, _icon, St.IconType.SYMBOLIC);
            _options[i].connect("activate", (event) => Util.spawnCommandLine("/usr/bin/xlet-settings applet %s -t %s".format(UUID, i.toString())));
            _configure.menu.addMenuItem(_options[i])
        }

        // button Reload this applet
        if (DEBUG() || RELOAD()) {
            let _reload_button = new PopupMenu.PopupIconMenuItem("Reload this applet", "edit-redo", St.IconType.SYMBOLIC);
            _reload_button.connect("activate", (event) => this._on_reload_this_applet_pressed())
            this.menu.addMenuItem(_reload_button);
        }

        // Here the (future) notification list:


        // Help

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // button Help...
        this.help_button = new PopupMenu.PopupIconMenuItem(_("Help", "cinnamon-control-center") + "...", "folder-documents-symbolic", St.IconType.SYMBOLIC);
        this.help_button.connect("activate", (event) => {
                let _language = this.get_user_language();
                if (_language.startsWith("en")) {
                    Util.spawnCommandLineAsync("/usr/bin/xdg-open https://cinnamon-spices.linuxmint.com/applets/view/309");
                } else {
                    Util.spawnCommandLineAsync("/usr/bin/xdg-open https://translate.google.com/translate?sl=en&tl=" + _language + "&u=https%3A%2F%2Fcinnamon-spices.linuxmint.com%2Fapplets%2Fview%2F309", null, null);
                }
            });

        this.menu.addMenuItem(this.help_button);
        // End of makeMenu
    }

    destroy_notifications(type, about = "both") {
        if (about === "both" || about === "updates") {
            while (this.notifications_about_updates[type].length != 0) {
                let n = this.notifications_about_updates[type].pop();
                n.destroy(3);
            }
            this.old_message[type] = "";
        }

        if (about === "both" || about === "news") {
            while (this.notifications_about_news[type].length != 0) {
                let n = this.notifications_about_news[type].pop();
                n.destroy(3);
            }
            this.old_watch_message[type] = "";
        }
        // End of destroy_notifications
    }

    destroy_all_notifications() {
        for (let t of TYPES) {
            this.destroy_notifications(t);
        }
        // End of destroy_all_notifications
    }

    _on_refresh_pressed(from = null) {
        //log("_on_refresh_pressed called by: %s".format(from.toString()), true);
        this.first_loop = false;
        this.refresh_requested = true;

        if (!this.isLooping) {
            this.do_rotation = true;
            this.updateLoop();
        }
        // End of _on_refresh_pressed
    }

    _on_reload_this_applet_pressed() {
        // Before to reload this applet, stop the loop, remove all bindings and disconnect all signals to avoid errors.
        this.applet_running = false;
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
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
        // End of _on_reload_this_applet_pressed
    }

    _clean_str(str) {
        let ret = str.replace(/\\'/gi, "'");
        ret = ret.replace(/\\"/gi, '"');
        return ret;
        // End of _clean_str
    }

    darken_color(str_color) {
        let c = Clutter.Color.from_string(str_color)[1];
        let lc = c.darken();
        return lc.to_string().substr(0,7);
        // End of darken_color
    }

    set_icon_color() {
        if (this.refresh_requested) {
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
                    this._applet_icon.style = "color: %s;".format(this.events_color);
                    this.do_rotation = false;
                    break;
                }
            }
        }
        // End of set_icon_color
    }

    icon_rotate() {
        this.angle = Math.round(this.angle + 3) % 360;
        let size = Math.round(this.getPanelIconSize(St.IconType.SYMBOLIC) * global.ui_scale);
        this.img_icon = getImageAtScale(this.img_path, size, size);
        this.img_icon.set_pivot_point(0.5, 0.5);
        this.img_icon.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, this.angle);
        this._applet_icon_box.set_child(this.img_icon);
        if (this.isHorizontal === true)
            this._applet_icon_box.set_fill(true, false);
        else
            this._applet_icon_box.set_fill(false, true);
        this._applet_icon_box.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
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
        if (this.do_rotation) {
            if (this.interval === 0)
                this.interval = setInterval(() => this.icon_rotate(), 10);
        }

        this.set_icon_color();
        if (this.nb_to_update > 0 || this.nb_to_watch > 0) {
            var _tooltip = this.default_tooltip;
            var tooltip_was_modified = false;
            for (let type of TYPES) {
                if (this.old_message[type] != "" || this.old_watch_message[type] != "") {
                    if (!tooltip_was_modified) {
                        _tooltip += "\n%s".format(_("Middle-Click to open useful Cinnamon Settings"));
                        tooltip_was_modified = true;
                    }
                    _tooltip += "\n\n\t\t\t%s".format(_(type).toLocaleUpperCase());
                    if (this.old_message[type] != "") _tooltip += "\n\u21BB %s".format(this._clean_str(this.old_message[type].replace(/, /gi, "\n\t")));
                    if (this.old_watch_message[type] != "") _tooltip += "\n\u2604 %s".format(this._clean_str(this.old_watch_message[type].replace(/, /gi, "\n\t")));
                }
            }
            if (!tooltip_was_modified) {
                _tooltip += "\n%s".format(_("Middle-Click to Refresh"));
            }
            this.set_applet_tooltip(_tooltip);
            this.numberLabel.text = (this.nb_to_update + this.nb_to_watch).toString();
            //this.badge.show();
        } else {
            this.set_applet_tooltip(this.default_tooltip + "\n%s".format(_("Middle-Click to Refresh")));
            this.numberLabel.text = "";
            //this.badge.hide();
        }
        if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
            this._applet_tooltip._tooltip.set_style("text-align: right;");
        } else {
            this._applet_tooltip._tooltip.set_style("text-align: left;");
        }

        if (!this.do_rotation && this.interval != 0) {
            clearInterval(this.interval);
            this.interval = 0;
            this.angle = 0;
            this.set_applet_icon_symbolic_name("spices-update");
        }

        if (this.numberLabel.text === "") this.badge.hide();
        else this.badge.show();

        this.isUpdatingUI = false;
        // End of updateUI
    }

    // This is the loop run at general_frequency rate to call updateUI() to update the display in the applet and tooltip
    updateLoop() {
        if (this.isLooping) return;
        //log("ONE MORE LOOP!", true);
        this.isLooping = true;
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        this.check_dependencies();

        this.iteration = (this.iteration + 1) % 10;

        // Inhibits also after the applet has been removed from the panel
        if (this.applet_running === true) {
            //this.get_translated_help_file();

            var t;
            for (t of TYPES) {
                this.OKtoPopulateSettings[t] = true;
                //log("_was_empty_local_dir(%s): %s".format(t.toString(), this._was_empty_local_dir(t).toString() ), true);
            }

            if (!this.dependenciesMet) {
                this.refreshInterval = 5;
            } else {
                for (t of TYPES) {
                    this._whether_empty_or_not(t);
                }
                if (!this.first_loop) {
                    this.refreshInterval = DEBUG() ? 120 * this.general_frequency : 3600 * this.general_frequency;
                    var monitor, Id;
                    for (let tuple of this.monitors) {
                        [monitor, Id] = tuple;
                        monitor.disconnect(Id)
                    }
                    this.monitors = [];
                    this.alreadyMonitored = [];
                    for (let type of TYPES) this.monitorsPngId[type] = 0;

                    //if (!this.new_loop_requested) {
                        //this.destroy_all_notifications();
                    //}

                    var must_be_updated;
                    this.nb_to_update = 0;
                    this.nb_to_watch = 0;
                    for (t of TYPES) {
                        this.populateSettingsUnprotectedSpices(t);
                        if (this.is_to_check(t)) {
                            if (this.cache[t] === "{}") this._load_cache(t);
                            this.download_cache(t);

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
                    //this.do_rotation = false;
                } else {
                    this.refreshInterval = 60; // 60 seconds
                    this.first_loop = false;
                }
            }
            this.updateUI(); // update icon and tooltip
            this._set_main_label();
        }
        if (this.new_loop_requested === true) {
            this.new_loop_requested = false;
            this.refreshInterval = 60; // 60 seconds
        }
        this.isLooping = false;
        if (this.applet_running === true && this.loopId === 0) {
            this.do_rotation = false;
            // One more loop !
            this.loopId = Mainloop.timeout_add_seconds(this.refreshInterval, () => this.updateLoop());
        }
        // End of updateLoop
    }

    open_each_download_tab() {
        for (let t of TYPES) {
            if (this.nb_in_menu[t] > 0) {
                let command = "%s %s -t %s -s %s".format(CS_PATH, t.toString(), TAB, SORT);
                Util.spawnCommandLine(command);
            }
        }
        // End of open_each_download_tab
    }

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
        // End of _whether_empty_or_not
    }

    _onButtonPressEvent(actor, event) {
        if (event.get_button() == 2) {
            if ((this.nb_to_update + this.nb_to_watch) === 0) {
                this._on_refresh_pressed("_onButtonPressEvent");
            } else {
                this.open_each_download_tab();
            }
        }
        return super._onButtonPressEvent(actor, event);
        // End of _onButtonPressEvent
    }

    on_applet_clicked(event) {
        this.makeMenu();
        this.updateUI();
        this.menu.toggle();
        // End of on_applet_clicked
    }

    on_generic_changed() {
        // Nothing to do.
        // End of on_generic_changed
    }

    on_applet_removed_from_panel() {
        // When applet is removed from panel: stop the loop, inhibit the update timer,
        // remove all bindings and disconnect all signals (if any) to avoid errors.
        this.applet_running = false;
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;

        if (this.interval != 0){
            clearInterval(this.interval);
        }

        var monitor, Id;
        for (let tuple of this.monitors) {
            [monitor, Id] = tuple;
            monitor.disconnect(Id)
        }
        this.monitors = [];
        for (let type of TYPES) this.monitorsPngId[type] = 0;
        if (this.settings) {
            try {
                this.settings.finalize();
            } catch(e) {
                logError(e)
            }
        }
        // End of on_applet_removed_from_panel
    }

    on_applet_reloaded(deleteConfig) {
        this.destroy_all_notifications();
        // End of on_applet_reloaded
    }

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
            }
        };
        // End of _set_SU_checks
    }
    // End of class SpicesUpdate
}


function main(metadata, orientation, panelHeight, instance_id) {
    return new SpicesUpdate(metadata, orientation, panelHeight, instance_id);
}
