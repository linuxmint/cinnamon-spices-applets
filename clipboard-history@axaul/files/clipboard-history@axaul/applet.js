// Cinnamon
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

// Applet params
const UUID = "clipboard-history@axaul";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
const _ = Gettext.domain(UUID).gettext;
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
const CONTENT_MAX_SIZE_TO_DISPLAY = 100;

function HistoriquePressePapiers(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

HistoriquePressePapiers.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        // *****************
        // ** Init params **
        // *****************

        this._preferences = this._getDefaultSettings();
        this.settings = new Settings.AppletSettings(this._preferences, UUID, instanceId);
        this._bindSettings();

        // ********************
        // ** Init applet UI **
        // ********************

        this.set_applet_icon_path(AppletDir + '/icon.png');
        this.set_applet_tooltip(_("Open clipboard history"));

        // Main menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Init & add static elements to the menu
        this._addStaticMenuItems();

        // Init dynamic section (clipboard history content)
        this.sectionHistorique = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.sectionHistorique);

        // ************************
        // ** Init default datas **
        // ************************
        this.historiquePressePapiers = [];
        this.menuItems = [];
        this.timeoutId = null;

        // *********************
        // ** Applet starting **
        // *********************
        this._reloadHistorique();
        this._startClipboardWatcher();
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    },

    // ***********************
    // ** MANAGE PARAMETERS **
    // ***********************
    _getDefaultSettings: function() {
        return {
            debug_mode: false,
            clipboard_history_limit: 15,
            poll_interval: 5,
            open_applet_shortcut: "<Ctrl><Alt>v"
        };
    },

    _bindSettings: function() {
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "debug_mode", // settings-schema.json key
            "debug_mode", // _preferences properties
            this._onSettingsChanged.bind(this), // callback
            null    
        );
        this.settings.bindProperty(Settings.BindingDirection.IN, "clipboard_history_limit", "clipboard_history_limit", this._onSettingsChanged.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "poll_interval", "poll_interval", this._onSettingsChanged.bind(this), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "open_applet_shortcut", "open_applet_shortcut", () => {
            Main.keybindingManager.addHotKey(
                UUID,
                this._preferences.open_applet_shortcut,
                () => this.menu.toggle()
            );
        }, null);
    },

    _onSettingsChanged: function() {
        this._logDebug(_("[SETTINGS] Settings change detected"));
        this._restartClipboardWatcher();
    },

    // ***************
    // ** MENU & UI **
    // ***************
    _addStaticMenuItems: function() {
        this.boutonEffacerTout = new PopupMenu.PopupMenuItem(_("🗑️ Clear entire history"));
        this.boutonEffacerTout.connect('activate', () => {
            this._clearHistorique();
            Main.notify(_("History emptied and clipboard erased!"));
        });
        this.menu.addMenuItem(this.boutonEffacerTout);

        // Separate buttons from menu
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    _reloadHistorique: function() {
        this.sectionHistorique.removeAll();
        this.menuItems = [];
        this.historiquePressePapiers.forEach(contenu => {
            let item = this._createClipboardMenuItem(contenu);
            this.sectionHistorique.addMenuItem(item);
            this.menuItems.unshift(item);
        });
    },

    _createClipboardMenuItem: function(contenu) {

        let ligneContenu = contenu.split("\n").map(line => line.trim()).join(" ");
        ligneContenu = ligneContenu.trim();

        let contenuAffiche = ligneContenu.length > CONTENT_MAX_SIZE_TO_DISPLAY
            ? ligneContenu.substring(0, CONTENT_MAX_SIZE_TO_DISPLAY - 3) + "..."
            : ligneContenu;
        let item = new PopupMenu.PopupMenuItem(contenuAffiche);
        item.connect('activate', () => {
            this._copyToClipboard(contenu);
            Main.notify(_("“%s” copied to clipboard.").format(contenuAffiche));
        });
        return item;
    },

    // ********************
    // ** MANAGE HISTORY **
    // ********************
    _clearHistorique: function() {
        this._logDebug(_("Clipboard has been emptied."));
        this.historiquePressePapiers = [];
        this._reloadHistorique();
        
        // When we clear history, we erase the current content of the clipboard
        let pressePapiers = St.Clipboard.get_default();
        pressePapiers.get_text(St.ClipboardType.CLIPBOARD, (clip, contenu) => {
            if (contenu !== null && contenu !== undefined) {
                this._copyToClipboard("");
                this._logDebug(_("Clipboard cleared (it contained text)."));
            } else {
                this._logDebug(_("Clipboard not cleared (non-text content)."));
            }
        });
    },

    _addToHistorique: function(contenu) {
        try {
            if(this.historiquePressePapiers.length >= this._preferences.clipboard_history_limit) {
                this.historiquePressePapiers.pop();
            }
            this.historiquePressePapiers.unshift(contenu);
            this._reloadHistorique();
        } catch(ex) {
            global.logError(_("An error occurred while adding content to clipboard history: %s").format(ex));
        }
    },

    _moveToTopHistorique: function(contenu) {
        // The purpose of this function is to move the selected element to be copied to the top of the history list.
        // First, we delete the existing occurrence, then we re-insert it at the top of the list, and finally we reload history.
        this.historiquePressePapiers = this.historiquePressePapiers.filter(c => c !== contenu);
        this.historiquePressePapiers.unshift(contenu);
        this._reloadHistorique();
    },

    _handleClipboardContent: function(contenu) {
        if(!contenu || contenu.trim() === "") return;
        if(this.historiquePressePapiers.includes(contenu)) {
            this._moveToTopHistorique(contenu);
        } else {
            this._addToHistorique(contenu);
        }
    },

    // ****************
    // ** MONITORING **
    // ****************
    _startClipboardWatcher: function() {
        let dernierContenu = "";
        const verifierPressePapiers = () => {
            let pressePapiers = St.Clipboard.get_default();
            pressePapiers.get_text(St.ClipboardType.CLIPBOARD, (clip, contenu) => {
                if(contenu && contenu !== dernierContenu) {
                    this._logDebug(_("New content detected: “%s”").format(contenu));
                    dernierContenu = contenu;
                    this._handleClipboardContent(contenu);
                } else {
                    this._logDebug(_("The contents of the clipboard have not changed since last %s seconds.").format(this._preferences.poll_interval));
                }
            });
            return true; // without it, the loop doesn't work
        }
        this._logDebug(_("Starting clipboard checking."));
        this._timeoutId = Mainloop.timeout_add_seconds(this._preferences.poll_interval, verifierPressePapiers);
    },

    _restartClipboardWatcher: function() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._startClipboardWatcher();
    },

    _copyToClipboard: function(contenu) {
        let pressePapiers = St.Clipboard.get_default();
        pressePapiers.set_text(St.ClipboardType.CLIPBOARD, contenu);
    },

    _logDebug: function(msg){
        if (this._preferences.debug_mode) global.log(`[DEBUG] ${msg}`);
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new HistoriquePressePapiers(metadata, orientation, panelHeight, instanceId);
}
