/* Looking Glass Shortcuts (xsession@claudiux)
*/
const Applet = imports.ui.applet; // ++ Base for an applet
const Settings = imports.ui.settings; // To read/write this applet settings
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos
const Gettext = imports.gettext; // ++ Needed for translations
const Util = imports.misc.util; // Needed for spawnCommandLineAsync()
const {
  reloadExtension,
  Type
} = imports.ui.extension; //Extension
const { restartCinnamon } = imports.ui.main; // Main

const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus

const {to_string} = require("./lib/to-string");

// ++ Set DEBUG to true to display log messages in ~/.xsession-errors
// ++ Set DEBUG to false in production.
const DEBUG = false;

const UUID="xsession@claudiux";

const HOME_DIR = GLib.get_home_dir();
const CONFIG_DIR = HOME_DIR + "/.cinnamon/configs";
const CACHE_DIR = HOME_DIR + "/.cinnamon/spices.cache";
const SPICES_DIR = HOME_DIR + "/.local/share/cinnamon"
const APPLET_DIR = SPICES_DIR + "/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const ICONS_DIR = APPLET_DIR + "/icons";
const WATCHXSE_SCRIPT = SCRIPTS_DIR + "/watch-xse.sh";

// ++ l10n support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// ++ Always needed if you want localisation/translation support
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}

// Dummy bidon variable for translation (don't remove these lines):
let bidon = _("Applet");
bidon = _("Desklet");
bidon = _("Extension");
//bidon = _("Theme");
//bidon = _("Search Provider");
bidon = _("Applets");
bidon = _("Desklets");
bidon = _("Extensions");
//bidon = _("Themes");
//bidon = _("Search Providers");
bidon = null;

// ++ Useful for logging
/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if DEBUG is set to true.
 * log("Any message here", true) to log the message even if DEBUG is set to false.
 * logError("Any error message") log the error message regardless of the DEBUG value.
 */
function log(message, alwaysLog=false) {
    if (DEBUG || alwaysLog)
        global.log("[" + UUID + "]: " + message);
}

function logError(error) {
    global.logError("[" + UUID + "]: " + error)
}

class LGSMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(parent, type, uuid, action, params) {
        super(params);
        this.parent = parent;
        this.type = type;
        this.uuid = uuid;
        this.action = action;

        let label = new St.Label({ style: "spacing: .25em;" , x_align: St.Align.START, x_expand: true, text: uuid, reactive: true, track_hover: true });

        let icon_box = new St.BoxLayout({ style: "spacing: .25em;" , x_align: St.Align.START, x_expand: false, reactive: true, track_hover: true });
        //~ let icon_box = new St.BoxLayout({ style_class: 'popup-menu-icon', reactive: true, track_hover: true });
        let icon_path = HOME_DIR+"/.cache/cinnamon/spices/"+type.slice(0,-1)+"/"+uuid+".png";
        let icon_file = Gio.file_new_for_path(icon_path);
        let icon, gicon;

        if (icon_file.query_exists(null)) {
            gicon = Gio.icon_new_for_string(icon_path);
            icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, icon_size: this.parent.icon_size });
        } else {
            icon_path = SPICES_DIR + "/" + type + "/" + uuid + "/icon.png";
            icon_file = Gio.file_new_for_path(icon_path);
            if (icon_file.query_exists(null)) {
                gicon = Gio.icon_new_for_string(icon_path);
                icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, icon_size: this.parent.icon_size });
            } else {
                let metadataJson_path = SPICES_DIR + "/" + type + "/" + uuid + "/metadata.json";
                let metadataJson_file = Gio.file_new_for_path(metadataJson_path);
                if (metadataJson_file.query_exists(null)) {
                    let [success, array_chars] = GLib.file_get_contents(metadataJson_path);
                    let contents = to_string(array_chars);
                    let metadata = JSON.parse(contents);
                    if (metadata["icon"]) {
                        icon = new St.Icon({ icon_name: metadata["icon"], icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
                    } else {
                        icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
                    }
                } else {
                    icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
                }
            }
        }
        icon_box.add_actor(icon);

        this.addActor(label);
        this.addActor(icon_box);


    }

    activate() {
        this.action();
        super.activate();
    }
}

class LGS extends Applet.IconApplet {
    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.instanceId = instance_id;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Can be used on horizontal or vertical panels.
        this.set_applet_icon_symbolic_path(metadata.path + "/icons/face-glasses-symbolic.svg");
        this.name = metadata.name
        this.set_applet_tooltip(_(this.name));
        this.version = metadata.version;

        // Settings:
        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("icon_size", "icon_size");

        // ++ Set up left click menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        let _tooltip = _("Middle-click: \n") + _("Show .xsession-errors");
        this.set_applet_tooltip(_tooltip);
    }; // End of constructor

    //++ Handler for when the applet is clicked.
    on_applet_clicked(event) {
        if (!this.menu.isOpen)
            this.makeMenu();
        this.menu.toggle();
    }; // End of on_applet_clicked

    get_active_spices(type) {
        // Returns the list of active spices of type 'type'
        var dconfEnabled;
        var elt = (type.toString() === "applets") ? 3 : 0;
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
            if (!xlet_uuid.endsWith("@cinnamon.org"))
                listEnabled.push(xlet_uuid);
        }
        return listEnabled.sort();
        // End of get_active_spices
    }

    makeMenu() {
        this.menu.removeAll();

        /**
         *  Sections
         */
        let sectionHead = new PopupMenu.PopupMenuSection();
        let sectionReload = new PopupMenu.PopupMenuSection();
        let sectionSettings = new PopupMenu.PopupMenuSection();
        let sectionSource = new PopupMenu.PopupMenuSection();
        // Head
        let menuitemHead1 = new PopupMenu.PopupMenuItem(_(this.name)+' '+this.version, {
            reactive: false
        });
        sectionHead.addMenuItem(menuitemHead1);
        menuitemHead1.emit('allocate');

        let itemWatchXSE = new PopupMenu.PopupIconMenuItem(_("Show .xsession-errors"), "face-glasses", St.IconType.SYMBOLIC);
        itemWatchXSE.connect(
            "activate",
            () => {
                //~ if (this.menu.isOpen) this.menu.close();
                setTimeout( () => {
                    Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_SCRIPT+"'");
                    return false;
                },
                0);
            }
        );

        sectionHead.addMenuItem(itemWatchXSE);

        // Restart Cinnamon
        let itemReloadCinnamon = new PopupMenu.PopupIconMenuItem(_("Restart Cinnamon"), "restart", St.IconType.SYMBOLIC);
        itemReloadCinnamon.connect(
            "activate",
            () => {
                //~ if (this.menu.isOpen) this.menu.close();
                setTimeout( () => {
                    restartCinnamon(true);
                    return false;
                },
                0);
            }
        );

        sectionHead.addMenuItem(itemReloadCinnamon);
        sectionHead.emit('allocate');

        // Reload:
        let reloadHead = new PopupMenu.PopupMenuItem(_("--- Reload Spices ---"), {
            reactive: false
        });
        sectionReload.addMenuItem(reloadHead);

        // Applets
        //~ let subMenuReloadApplets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Applet:"));
        let subMenuReloadApplets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Applet:"));
        sectionReload.addMenuItem(subMenuReloadApplets);

        const APPLETS_DIR = SPICES_DIR + "/applets/";

        for (let applet of this.get_active_spices("applets")) {
            let s = new LGSMenuItem(this, "applets", applet, () => {reloadExtension(applet, Type.APPLET);}, null);
            subMenuReloadApplets.menu.addMenuItem(s);
        }

        // Desklets
        let subMenuReloadDesklets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Desklet:"));
        sectionReload.addMenuItem(subMenuReloadDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s = new LGSMenuItem(this, "desklets", desklet, () => {reloadExtension(desklet, Type.DESKLET);}, null);
            subMenuReloadDesklets.menu.addMenuItem(s);
        }

        // Extensions
        let subMenuReloadExtensions = new PopupMenu.PopupSubMenuMenuItem(_("Reload Extension:"));
        sectionReload.addMenuItem(subMenuReloadExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s = new LGSMenuItem(this, "extensions", extension, () => {reloadExtension(extension, Type.EXTENSION);}, null);
            subMenuReloadExtensions.menu.addMenuItem(s);
        }

        // Settings:
        let settingsHead = new PopupMenu.PopupMenuItem(_("--- Settings for ---"), {
            reactive: false
        });
        sectionSettings.addMenuItem(settingsHead);

        // Applets
        let subMenuSettingsApplets = new PopupMenu.PopupSubMenuMenuItem(_("Applet:"));
        sectionSettings.addMenuItem(subMenuSettingsApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s = new LGSMenuItem(this, "applets", applet, () => {Util.spawnCommandLineAsync(`bash -c "cinnamon-settings applets ${applet}"`)}, null);
            subMenuSettingsApplets.menu.addMenuItem(s);
        }

        // Desklets
        let subMenuSettingsDesklets = new PopupMenu.PopupSubMenuMenuItem(_("Desklet:"));
        sectionSettings.addMenuItem(subMenuSettingsDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s = new LGSMenuItem(this, "desklets", desklet, () => {Util.spawnCommandLineAsync(`bash -c "cinnamon-settings desklets ${desklet}"`)}, null);
            subMenuSettingsDesklets.menu.addMenuItem(s);
        }

        // Extensions
        let subMenuSettingsExtensions = new PopupMenu.PopupSubMenuMenuItem(_("Extension:"));
        sectionSettings.addMenuItem(subMenuSettingsExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s = new LGSMenuItem(this, "extensions", extension, () => {Util.spawnCommandLineAsync(`bash -c "cinnamon-settings extensions ${extension}"`)}, null);
            subMenuSettingsExtensions.menu.addMenuItem(s);
        }

        // View Code:
        let codeHead = new PopupMenu.PopupMenuItem(_("--- View Code ---"), {
            reactive: false
        });
        sectionSource.addMenuItem(codeHead);

        // Applets
        let subMenuCodeApplets = new PopupMenu.PopupSubMenuMenuItem(_("View Applet Code for:"));
        sectionSource.addMenuItem(subMenuCodeApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s = new LGSMenuItem(this, "applets", applet, () => {Util.spawnCommandLineAsync(`bash -c "xdg-open ${SPICES_DIR}/applets/${applet}/ "`)}, null);
            subMenuCodeApplets.menu.addMenuItem(s);
        }

        // Desklets
        let subMenuCodeDesklets = new PopupMenu.PopupSubMenuMenuItem(_("View Desklet Code for:"));
        sectionSource.addMenuItem(subMenuCodeDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s = new LGSMenuItem(this, "desklets", desklet, () => {Util.spawnCommandLineAsync(`bash -c "xdg-open ${SPICES_DIR}/desklets/${desklet}/ "`)}, null);
            subMenuCodeDesklets.menu.addMenuItem(s);
        }

        // Extensions
        let subMenuCodeExtensions = new PopupMenu.PopupSubMenuMenuItem(_("View Extension Code for:"));
        sectionSource.addMenuItem(subMenuCodeExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s = new LGSMenuItem(this, "extensions", extension, () => {Util.spawnCommandLineAsync(`bash -c "xdg-open ${SPICES_DIR}/extensions/${extension}/ "`)}, null);
            subMenuCodeExtensions.menu.addMenuItem(s);
        }

        this.menu.addMenuItem(sectionHead);
        this.menu.addMenuItem(sectionReload);
        this.menu.addMenuItem(sectionSettings);
        this.menu.addMenuItem(sectionSource);
    }; // End of makeMenu

    on_applet_middle_clicked(event) {
        //~ if (this.menu.isOpen) this.menu.close();
        setTimeout( () => {
            Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_SCRIPT+"'");
            return false;
        },
        0);
    }
} // End of class LGS

function main(metadata, orientation, panelHeight, instance_id) {
    return new LGS(metadata, orientation, panelHeight, instance_id);
}
