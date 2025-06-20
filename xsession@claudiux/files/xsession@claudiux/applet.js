/* Looking Glass Shortcuts (xsession@claudiux)
*/
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;
const Util = imports.misc.util;
const Tooltips = imports.ui.tooltips;
const {
  reloadExtension,
  Type
} = imports.ui.extension; //Extension
const { restartCinnamon } = imports.ui.main; // Main

const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;

const {to_string} = require("./lib/to-string");
const {
  setTimeout,
  clearTimeout,
  remove_all_sources
} = require("./lib/mainloopTools");

// ++ Set DEBUG to true to display log messages in ~/.xsession-errors
// ++ Set DEBUG to false in production.
const DEBUG = false;

const UUID="xsession@claudiux";

const HOME_DIR = GLib.get_home_dir();
const SPICES_DIR = HOME_DIR + "/.local/share/cinnamon"
const APPLET_DIR = SPICES_DIR + "/applets/" + UUID;
const SCRIPTS_DIR = APPLET_DIR + "/scripts";
const WATCHXSE_SCRIPT = SCRIPTS_DIR + "/watch-xse.sh";
const WATCHXSE_LATEST_SCRIPT = SCRIPTS_DIR + "/watch-xse-latest.sh";
const ICONS_DIR = APPLET_DIR + "/icons";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

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
bidon = _("Applets");
bidon = _("Desklets");
bidon = _("Extensions");
bidon = null;

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

Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);

class LGSsliderItem extends PopupMenu.PopupSliderMenuItem {
    constructor(value) {
        super(value)
    }
    _onScrollEvent (actor, event) {
        const SLIDER_SCROLL_STEP = 5/240;
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return;
        }

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - SLIDER_SCROLL_STEP);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + SLIDER_SCROLL_STEP);
        }

        this._slider.queue_repaint();
        this.emit('value-changed', this._value);
    }
}

class ReloadAllMenuItem extends PopupMenu.PopupBaseMenuItem {
  constructor(parent, type, params) {
    super(params);
    this.parent = parent;
    this.type = type;

    let label = new St.Label({
      style: "spacing: .25em; font-weight: bold;" ,
      x_align: St.Align.START,
      x_expand: true,
      text: _("RELOAD ALL"),
      reactive: true,
      track_hover: true
    });

    let icon_box = new St.BoxLayout({ style: "spacing: .25em;" , x_align: St.Align.START, x_expand: false, reactive: true, track_hover: true });
    let icon_path = ICONS_DIR + "/" + this.type + "-symbolic.svg";
    let icon_file = Gio.file_new_for_path(icon_path);
    let icon, gicon;

    //~ let icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });

    gicon = Gio.icon_new_for_string(icon_path);
    //~ icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, icon_size: this.parent.icon_size });
    //~ icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size, });
    //~ icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.SYMBOLIC, });
    icon = new St.Icon();
    icon.set_icon_size(this.parent.icon_size);
    icon.set_icon_type(St.IconType.SYMBOLIC);
    icon.set_gicon(gicon);

    //~ let icon = new St.Icon({ icon_name: ICONS_DIR + "/" + type+"-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
    try {
      icon_box.add_actor(icon);
    } catch(e) {
      logError("Problem with: " + icon_path + ": " + e);
    }

    this.addActor(label);
    try {
      this.addActor(icon_box);
    } catch(e) {
      logError("Problem with: " + icon_path + ": " + e);
    }
  }
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
        let icon_path = HOME_DIR+"/.cache/cinnamon/spices/"+type.slice(0,-1)+"/"+uuid+".png";
        let icon_file = Gio.file_new_for_path(icon_path);
        let icon, gicon;

        if (icon_file.query_exists(null)) {
            gicon = Gio.icon_new_for_string(icon_path);
            icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, icon_size: this.parent.icon_size });
            //~ icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, });
        } else {
            icon_path = SPICES_DIR + "/" + type + "/" + uuid + "/icon.png";
            icon_file = Gio.file_new_for_path(icon_path);
            if (icon_file.query_exists(null)) {
                gicon = Gio.icon_new_for_string(icon_path);
                icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, icon_size: this.parent.icon_size });
                //~ icon = new St.Icon({ gicon: gicon, icon_type: St.IconType.FULLCOLOR, });
            } else {
                let metadataJson_path = SPICES_DIR + "/" + type + "/" + uuid + "/metadata.json";
                let metadataJson_file = Gio.file_new_for_path(metadataJson_path);
                if (metadataJson_file.query_exists(null)) {
                    let [success, array_chars] = GLib.file_get_contents(metadataJson_path);
                    let contents = to_string(array_chars);
                    let metadata = JSON.parse(contents);
                    if (metadata["icon"]) {
                        icon = new St.Icon({ icon_name: metadata["icon"], icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
                        //~ icon = new St.Icon({ icon_name: metadata["icon"], icon_type: St.IconType.SYMBOLIC, });
                    } else {
                        icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
                        //~ icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, });
                    }
                } else {
                    icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: this.parent.icon_size });
                    //~ icon = new St.Icon({ icon_name: type+"-symbolic", icon_type: St.IconType.SYMBOLIC, });
                }
            }
        }

        try {
          icon_box.add_actor(icon);
        } catch(e) {
          logError("Problem with: " + icon_path + ": " + e);
        }

        this.addActor(label);
        try {
          this.addActor(icon_box);
        } catch(e) {
          logError("Problem with: " + icon_path + ": " + e);
        }


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
        this.settings.bind("show_reload_all", "show_reload_all");
        this.settings.bind("number_latest", "number_latest");

        // Left click menu:
        this.itemNumberLatest = null;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        let _tooltip = _("Middle-click: \n") + _("Show .xsession-errors");
        _tooltip += "\n" + _("Ctrl + Middle-click: \n") + _("Show latest messages");
        this.set_applet_tooltip(_tooltip);
    }

    on_applet_clicked(event) {
        if (!this.menu.isOpen)
            this.makeMenu();
        this.menu.toggle();
    }

    get_active_spices(type) {
        // Returns the list of active spices of given type.
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
    }

    makeMenu() {
        if (this.itemNumberLatest != null) {
            this.itemNumberLatest.disconnect(this.itemNumberLatestValueChangedId);
            this.itemNumberLatest.disconnect(this.itemNumberLatestDragEndId);
            this.itemNumberLatest = null;
        }
        this.menu.removeAll();
        this.itemNumberLatest = new LGSsliderItem((this.number_latest - 10) /240);
        this.itemNumberLatest.set_mark(9/24);
        this.itemNumberLatest.tooltip = new Tooltips.Tooltip(
            this.itemNumberLatest.actor,
            _("%s latest messages").format(this.number_latest) + "\n" + _("min: 10. max: 250.")
        );

        this.itemNumberLatestValueChangedId = this.itemNumberLatest.connect('value-changed', () => { this.numberSliderChanged() });
        this.itemNumberLatestDragEndId = this.itemNumberLatest.connect('drag-end', () => { this.numberSliderReleased() });

        /**
         *  Sections
         */
        let sectionHead = new PopupMenu.PopupMenuSection();
        let sectionReload = new PopupMenu.PopupMenuSection();
        let sectionSettings = new PopupMenu.PopupMenuSection();
        let sectionSource = new PopupMenu.PopupMenuSection();

        /// Head
        let menuitemHead1 = new PopupMenu.PopupMenuItem(_(this.name)+' '+this.version, {
            reactive: false
        });
        sectionHead.addMenuItem(menuitemHead1);
        menuitemHead1.emit('allocate');

        // Show .xsession-errors:
        let itemWatchXSE = new PopupMenu.PopupIconMenuItem(_("Show .xsession-errors"), "face-glasses", St.IconType.SYMBOLIC);
        itemWatchXSE.connect(
            "activate",
            () => {
                let id = setTimeout( () => {
                    clearTimeout(id);
                    Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_SCRIPT+"'");
                },
                300);
            }
        );

        sectionHead.addMenuItem(itemWatchXSE);

        let itemWatchXSELatest = new PopupMenu.PopupIconMenuItem(_("Show latest messages"), "bottom", St.IconType.SYMBOLIC);
        itemWatchXSELatest.connect(
            "activate",
            () => {
                let id = setTimeout( () => {
                    clearTimeout(id);
                    Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_LATEST_SCRIPT+ " " + this.number_latest +"'");
                },
                300);
            }
        );

        sectionHead.addMenuItem(itemWatchXSELatest);

        sectionHead.addMenuItem(this.itemNumberLatest);

        // Restart Cinnamon:
        let itemReloadCinnamon = new PopupMenu.PopupIconMenuItem(_("Restart Cinnamon"), "restart", St.IconType.SYMBOLIC);
        itemReloadCinnamon.connect(
            "activate",
            () => {
                let id = setTimeout( () => {
                    clearTimeout(id);
                    restartCinnamon(true);
                },
                0);
            }
        );

        sectionHead.addMenuItem(itemReloadCinnamon);
        sectionHead.emit('allocate');

        /// Reload:
        let reloadHead = new PopupMenu.PopupMenuItem(_("--- Reload Spices ---"), {
            reactive: false
        });
        sectionReload.addMenuItem(reloadHead);

        // Applets:
        let subMenuReloadApplets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Applet:"));
        sectionReload.addMenuItem(subMenuReloadApplets);

        if (this.show_reload_all) {
          //~ let itemReloadAllApplets = new PopupMenu.PopupMenuItem(_("RELOAD ALL"), {style_class: "menu-selected-app-title"}); // make it bold.
          let itemReloadAllApplets = new ReloadAllMenuItem(this, "applets", {});
          itemReloadAllApplets.connect(
            "activate",
            () => {
              let id = setTimeout( () => {
                clearTimeout(id);
                for (let applet of this.get_active_spices("applets")) {
                  reloadExtension(applet, Type.APPLET);
                }
              },
              0);
            }
          );
          subMenuReloadApplets.menu.addMenuItem(itemReloadAllApplets);
        }

        for (let applet of this.get_active_spices("applets")) {
            let s = new LGSMenuItem(this, "applets", applet, () => {reloadExtension(applet, Type.APPLET);}, null);
            subMenuReloadApplets.menu.addMenuItem(s);
        }

        // Desklets:
        let subMenuReloadDesklets = new PopupMenu.PopupSubMenuMenuItem(_("Reload Desklet:"));
        sectionReload.addMenuItem(subMenuReloadDesklets);

        if (this.show_reload_all) {
          //~ let itemReloadAllDesklets = new PopupMenu.PopupMenuItem(_("RELOAD ALL"), {style_class: "menu-selected-app-title"}); // make it bold.
          let itemReloadAllDesklets = new ReloadAllMenuItem(this, "desklets", {});
          itemReloadAllDesklets.connect(
            "activate",
            () => {
              let id = setTimeout( () => {
                clearTimeout(id);
                for (let desklet of this.get_active_spices("desklets")) {
                  reloadExtension(desklet, Type.DESKLET);
                }
              },
              0);
            }
          );
          subMenuReloadDesklets.menu.addMenuItem(itemReloadAllDesklets);
        }

        for (let desklet of this.get_active_spices("desklets")) {
            let s = new LGSMenuItem(this, "desklets", desklet, () => {reloadExtension(desklet, Type.DESKLET);}, null);
            subMenuReloadDesklets.menu.addMenuItem(s);
        }

        // Extensions:
        let subMenuReloadExtensions = new PopupMenu.PopupSubMenuMenuItem(_("Reload Extension:"));
        sectionReload.addMenuItem(subMenuReloadExtensions);

        if (this.show_reload_all) {
          let itemReloadAllExtensions = new ReloadAllMenuItem(this, "extensions", {});
          itemReloadAllExtensions.connect(
            "activate",
            () => {
              let id = setTimeout( () => {
                clearTimeout(id);
                for (let extension of this.get_active_spices("extensions")) {
                  reloadExtension(extension, Type.EXTENSION);
                }
              },
              0);
            }
          );
          subMenuReloadExtensions.menu.addMenuItem(itemReloadAllExtensions);
        }

        for (let extension of this.get_active_spices("extensions")) {
            let s = new LGSMenuItem(this, "extensions", extension, () => {reloadExtension(extension, Type.EXTENSION);}, null);
            subMenuReloadExtensions.menu.addMenuItem(s);
        }

        // Current Theme:
        let subMenuReloadTheme = new PopupMenu.PopupMenuItem(_("Reload Current Theme"));
        subMenuReloadTheme.connect(
          "activate",
          () => {
            let id = setTimeout( () => {
              clearTimeout(id);
              Main.loadTheme();
            },
            0);
          }
        );
        sectionReload.addMenuItem(subMenuReloadTheme);

        /// Settings:
        let settingsHead = new PopupMenu.PopupMenuItem(_("--- Settings for ---"), {
            reactive: false
        });
        sectionSettings.addMenuItem(settingsHead);

        // Applets:
        let subMenuSettingsApplets = new PopupMenu.PopupSubMenuMenuItem(_("Applet:"));
        sectionSettings.addMenuItem(subMenuSettingsApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s = new LGSMenuItem(this, "applets", applet, () => {Util.spawnCommandLineAsync(`bash -c "cinnamon-settings applets ${applet}"`)}, null);
            subMenuSettingsApplets.menu.addMenuItem(s);
        }

        // Desklets:
        let subMenuSettingsDesklets = new PopupMenu.PopupSubMenuMenuItem(_("Desklet:"));
        sectionSettings.addMenuItem(subMenuSettingsDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s = new LGSMenuItem(this, "desklets", desklet, () => {Util.spawnCommandLineAsync(`bash -c "cinnamon-settings desklets ${desklet}"`)}, null);
            subMenuSettingsDesklets.menu.addMenuItem(s);
        }

        // Extensions:
        let subMenuSettingsExtensions = new PopupMenu.PopupSubMenuMenuItem(_("Extension:"));
        sectionSettings.addMenuItem(subMenuSettingsExtensions);

        for (let extension of this.get_active_spices("extensions")) {
            let s = new LGSMenuItem(this, "extensions", extension, () => {Util.spawnCommandLineAsync(`bash -c "cinnamon-settings extensions ${extension}"`)}, null);
            subMenuSettingsExtensions.menu.addMenuItem(s);
        }

        /// View Code:
        let codeHead = new PopupMenu.PopupMenuItem(_("--- View Code ---"), {
            reactive: false
        });
        sectionSource.addMenuItem(codeHead);

        // Applets:
        let subMenuCodeApplets = new PopupMenu.PopupSubMenuMenuItem(_("View Applet Code for:"));
        sectionSource.addMenuItem(subMenuCodeApplets);

        for (let applet of this.get_active_spices("applets")) {
            let s = new LGSMenuItem(this, "applets", applet, () => {Util.spawnCommandLineAsync(`bash -c "xdg-open ${SPICES_DIR}/applets/${applet}/ "`)}, null);
            subMenuCodeApplets.menu.addMenuItem(s);
        }

        // Desklets:
        let subMenuCodeDesklets = new PopupMenu.PopupSubMenuMenuItem(_("View Desklet Code for:"));
        sectionSource.addMenuItem(subMenuCodeDesklets);

        for (let desklet of this.get_active_spices("desklets")) {
            let s = new LGSMenuItem(this, "desklets", desklet, () => {Util.spawnCommandLineAsync(`bash -c "xdg-open ${SPICES_DIR}/desklets/${desklet}/ "`)}, null);
            subMenuCodeDesklets.menu.addMenuItem(s);
        }

        // Extensions:
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
    }

    numberSliderChanged() {
        this.number_latest = Math.round((10 + this.itemNumberLatest.value * (250 - 10)) / 5) * 5;
        this.itemNumberLatest.tooltip.set_text(_("%s latest messages").format(this.number_latest) + "\n" + _("min: 10. max: 250."));
    }

    numberSliderReleased() {
        this.numberSliderChanged();
    }

    on_applet_middle_clicked(event) {
        let modifiers = Cinnamon.get_event_state(event);
        let shiftPressed = (modifiers & Clutter.ModifierType.SHIFT_MASK);
        let ctrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK);
        let id = setTimeout( () => {
            clearTimeout(id);
            if (shiftPressed || ctrlPressed) {
                Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_LATEST_SCRIPT+ " " + this.number_latest +"'");
            } else {
                Util.spawnCommandLineAsync("bash -c '"+WATCHXSE_SCRIPT+"'");
            }
        },
        300);
    }

    on_applet_removed_from_panel(deleteConfig) {
        remove_all_sources();
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new LGS(metadata, orientation, panelHeight, instance_id);
}
