const uuid = "gpaste-reloaded@feuerfuchs.eu";

const Util          = imports.misc.util;
const St            = imports.gi.St;
const Main          = imports.ui.main;
const PopupMenu     = imports.ui.popupMenu;
const Applet        = imports.ui.applet;
const Settings      = imports.ui.settings;
const ModalDialog   = imports.ui.modalDialog;
const SignalManager = imports.misc.signalManager;

let GPaste; // Will be assigned in entry point

const _                        = require('./__init__')._;
const GPasteSearchItem         = require('./GPasteSearchItem');
const GPasteHistoryItem        = require('./GPasteHistoryItem');
const GPasteHistoryListItem    = require('./GPasteHistoryListItem');
const GPasteNewItemDialog      = require('./GPasteNewItemDialog');
const GPasteNotInstalledDialog = require('./GPasteNotInstalledDialog');

//
// Entry point
// ------------------------------------------------------------------------------------------------------

function main(metadata, orientation, panel_height, instance_id) {
    try {
        GPaste = imports.gi.GPaste;
        
        return new GPasteApplet(orientation, panel_height, instance_id);
    } catch(e) {
        return new GPasteFallbackApplet(orientation, panel_height, instance_id);
    }
};

//
// Debug logging
// ------------------------------------------------------------------------------------------------------
function debugLog(...args) {
   // Un-comment the line blow to enable debug logging
   //global.log(...args);
}

class GPasteFallbackApplet extends Applet.TextApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        try {
            //
            // Applet icon

            this.set_applet_label(_("[GPaste is not installed]"));

            //
            // Dialogs

            this.dExplanation = new GPasteNotInstalledDialog.GPasteNotInstalledDialog();
            //this.dExplanation.open(global.get_current_time());
        }
        catch (e) {
            global.logError(e);
        }
    }

    on_applet_clicked(event) {
        this.dExplanation.open(global.get_current_time());
    }
}

//
// Applet
// ------------------------------------------------------------------------------------------------------

class GPasteApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        try {
            //
            // Applet icon

            this.set_applet_icon_symbolic_name("edit-paste");
            this.set_applet_tooltip(_("GPaste clipboard"));
            Main.systrayManager.registerRole("gpaste-applet", uuid);

            //
            // Context menu items

            this.cmitemUI            = new PopupMenu.PopupIconMenuItem(_("GPaste Main Program"), "edit-paste", St.IconType.SYMBOLIC);
            this.cmitemUI.connect('activate', () => this.openUI());

            this.cmsep               = new PopupMenu.PopupSeparatorMenuItem();

            this.cmitemSelectHistory = new PopupMenu.PopupSubMenuMenuItem(_("Select History"));

            //
            // Primary menu

            this.menuManager          = new PopupMenu.PopupMenuManager(this);
            this.menu                 = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.mitemTrack           = new PopupMenu.PopupSwitchMenuItem(_("Track clipboard changes"), true);
            this.mitemTrack.connect('toggled', () => this.toggleDaemon());

            this.mitemSearch          = new GPasteSearchItem.GPasteSearchItem();
            this.mitemSearch.connect('text-changed', (a, text) =>  this.search(text));

            this.msepTop              = new PopupMenu.PopupSeparatorMenuItem();

            this.mitemHistoryIsEmpty  = new PopupMenu.PopupMenuItem(_("(Empty)"));
            this.mitemHistoryIsEmpty.setSensitive(false);

            this.mitemNoSearchResults = new PopupMenu.PopupMenuItem(_("(No results)"));
            this.mitemNoSearchResults.setSensitive(false);

            this.msepBottom           = new PopupMenu.PopupSeparatorMenuItem();

            this.mitemNewItem         = new PopupMenu.PopupIconMenuItem(_("New item"), "list-add", St.IconType.SYMBOLIC);
            this.mitemNewItem.connect('activate', () => this.showNewItemDialog());

            this.mitemEmptyHistory    = new PopupMenu.PopupIconMenuItem(_("Empty history"), "edit-clear-all", St.IconType.SYMBOLIC);
            this.mitemEmptyHistory.connect('activate', () => this.emptyHistory());

            this.msepBottom2          = new PopupMenu.PopupSeparatorMenuItem();

            this.mitemUI              = new PopupMenu.PopupIconMenuItem(_("GPaste Main Program"), "edit-paste", St.IconType.SYMBOLIC);
            this.mitemUI.connect('activate', () => this.openUI());

            //
            // Dialogs

            this.dNewItem             = new GPasteNewItemDialog.GPasteNewItemDialog(text => {
                this._client.add(text, (client, result) => {
                    this._client.add_finish(result);
                });
            });

            //
            // Applet settings

            this._appletSettings = new Settings.AppletSettings(this, uuid, instance_id);

            this._appletSettings.bind("always-show-icon",      "alwaysShowIcon",      this._onDisplaySettingsUpdated);
            this._appletSettings.bind("display-track-switch",  "displayTrackSwitch",  this._onDisplaySettingsUpdated);
            this._appletSettings.bind("display-new-item",      "displayNewItem",      this._onDisplaySettingsUpdated);
            this._appletSettings.bind("display-searchbar",     "displaySearchBar",    this._onDisplaySettingsUpdated);
            this._appletSettings.bind("display-gpaste-ui",     "displayGPasteUI",     this._onDisplaySettingsUpdated);
            this._appletSettings.bind("display-empty-history", "displayEmptyHistory", this._onDisplaySettingsUpdated);
            
            this._appletSettings.bind("kb-show-history", "kbShowHistory", this._onKeybindingUpdated);
            this._onKeybindingUpdated();

            //
            // Create GPaste Client

            this._clientSettings   = new GPaste.Settings();
            this._searchResults    = [];
            this._historyName      = "Testing";
            this._historyItems     = [];
            this._historyListItems = [];
            this._signalManager    = new SignalManager.SignalManager(null);

            GPaste.Client.new( (obj, result) => {
                this._client = GPaste.Client.new_finish(result);

                //
                // Watch client signals

                // Client
                this._signalManager.connect(this._client, 'update',         this._onClientUpdate.bind(this));
                this._signalManager.connect(this._client, 'show-history',   this._onClientShowHistory.bind(this));
                this._signalManager.connect(this._client, 'switch-history', this._onClientSwitchHistory.bind(this));
                this._signalManager.connect(this._client, 'tracking',       this._onClientTracking.bind(this));
                this._signalManager.connect(this._client, 'delete-history', this._onClientDeleteHistory.bind(this));

                // Client settings
                this._signalManager.connect(this._clientSettings, 'changed::max-displayed-history-size', this._createHistoryItems.bind(this));

                //
                // Init

                // Get tracking status
                this.mitemTrack.setToggleState(this._client.is_active());

                // Get current history name
                this._client.get_history_name( (client, result) => {
                    this._historyName = this._client.get_history_name_finish(result);

                    // Get history list
                    this._client.list_histories(this._onClientHistoriesListed.bind(this));

                    // Load history and populate applet
                    this._createHistoryItems();
                    this._populateMenus();
                });
            });

            //
            // Events

            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    if (this.displaySearchBar) {
                        global.stage.set_key_focus(this.mitemSearch.entry);
                    }
                    this.actor.visible = true;
                } else {
                    this.mitemSearch.reset();
                    this.actor.visible = this.alwaysShowIcon;
                }
            });
            
            global.settings.connect('changed::panel-edit-mode', () => this._on_panel_edit_mode_changed());
        }
        catch (e) {
            global.logError(e);
        }
    }

    /*
     * Compares the current GPaste version with the given version string (only first 2 digits).
     * -1 = older, 0 = same, 1 = newer
     */
    _compareVersion(version) {
        version          = version.split(".");
        const curVersion = this._client.get_version().split(".");
        const maxLen     = Math.min(curVersion.length, version.length);

        for (let i = 0; i < maxLen; ++i) {
            const cv = parseInt(curVersion[i], 10);
            const v  = parseInt(version[i],    10);
            if (cv == v) {
                continue;
            }
            return ((cv < v) ? -1 : 1);
        }
        return 0;
    }

    /*
     * Applet settings were changed
     */
    _onDisplaySettingsUpdated() {
        this.mitemSearch.reset();

        this.actor.visible = this.alwaysShowIcon;
        this.mitemTrack.actor.visible        = this.displayTrackSwitch;
        this.msepTop.actor.visible           = this.displayTrackSwitch;
        this.mitemSearch.actor.visible       = this.displaySearchBar;

        this.msepBottom.actor.visible        = this.displayNewItem || this.displayGPasteUI || this.displayEmptyHistory;
        this.mitemNewItem.actor.visible      = this.displayNewItem;
        this.mitemEmptyHistory.actor.visible = this.displayEmptyHistory;

        this.msepBottom2.actor.visible       = this.displayGPasteUI;
        this.mitemUI.actor.visible           = this.displayGPasteUI;
    }

    /*
     * Generate the required number of history items (or delete excessive ones)
     */
    _createHistoryItems() {
        const oldSize = this._historyItems.length;
        const newSize = this._clientSettings.get_max_displayed_history_size();

        if (newSize > oldSize) {
            for (let i = oldSize; i < newSize; ++i) {
                this._historyItems[i] = new GPasteHistoryItem.GPasteHistoryItem(this);
            }
        } else {
            for (let i = newSize; i < oldSize; ++i) {
                this._historyItems.pop().destroy();
            }
        }

        if (this.mitemSearch.entry.get_text() == '') {
            this._historyItems[0].actor.set_style("font-weight: bold;");
        }

        this.refresh(oldSize);
    }

    /*
     * Add all necessary menu items to the menus
     */
    _populateMenus() {
        //
        // Context menu

        let i = -1;
        if (this._compareVersion("3.18") != -1) {
            this._applet_context_menu.addMenuItem(this.cmitemUI, ++i);
            this._applet_context_menu.addMenuItem(this.cmsep, ++i);
        }
        this._applet_context_menu.addMenuItem(this.cmitemSelectHistory, ++i);
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), ++i);

        //
        // Primary menu

        this.menu.addMenuItem(this.mitemTrack);
        this.menu.addMenuItem(this.mitemSearch);

        this.menu.addMenuItem(this.msepTop);

        for (let i = 0, len = this._historyItems.length; i < len; ++i) {
            this.menu.addMenuItem(this._historyItems[i]);
        }
        this.menu.addMenuItem(this.mitemHistoryIsEmpty);
        this.menu.addMenuItem(this.mitemNoSearchResults);

        this.menu.addMenuItem(this.msepBottom);

        this.menu.addMenuItem(this.mitemNewItem);
        this.menu.addMenuItem(this.mitemEmptyHistory);

        if (this._compareVersion("3.18.2") != -1) {
            this.menu.addMenuItem(this.msepBottom2);
            this.menu.addMenuItem(this.mitemUI);
        }

        //
        // Hide disabled menu items

        this._onDisplaySettingsUpdated();
    }
    
    _onKeybindingUpdated () {
        Main.keybindingManager.addHotKey("show-history-" + this.instance_id, this.kbShowHistory, () => {
            if (!Main.overview.visible && !Main.expo.visible) {
                this.menu.toggle();
            }
        });
    }

    /*
     * Getters
     */
    get client() {
        return this._client;
    }

    get clientSettings() {
       return this._clientSettings;
    }

    get contextMenu() {
        return this._applet_context_menu;
    }

    /*
     * Refresh the history items
     */
    refresh (startID) {
        if (this._searchResults.length > 0) { // Search field isn't empty
            this.search(this.mitemSearch.getText());
        } else {
            this._client.get_history_size(this._historyName, (client, result) => {
                let   size    = client.get_history_size_finish(result);
                const maxSize = this._historyItems.length;

                if (size > maxSize) {
                    size = maxSize;
                }

                for (let i = startID; i < size; ++i) {
                    this._historyItems[i].setIndex(i);
                }
                for (let i = size; i < maxSize; ++i) {
                    this._historyItems[i].setIndex(-1);
                }

                if (size == 0) { // There aren't any history items, display "(Empty)"
                    this.mitemHistoryIsEmpty.actor.show();
                } else {
                    this.mitemHistoryIsEmpty.actor.hide();
                }
            });
        }
    }

    /*
     * Search the history for the given string
     */
    search(searchStr) {
        searchStr = searchStr.toLowerCase();

        if (searchStr.length > 0) {
            this.mitemHistoryIsEmpty.actor.hide();

            this._client.search(searchStr, (client, result) => {
                this._searchResults = client.search_finish(result);
                let   results = this._searchResults.length;
                const maxSize = this._historyItems.length;

                if (results > maxSize) {
                    results = maxSize;
                }

                this._historyItems.slice(0, results).forEach((item, index) => {
                    item.setIndex(this._searchResults[index]);
                });
                this._historyItems.slice(results, maxSize).forEach((item, index) => {
                    item.setIndex(-1);
                });

                this._historyItems[0].actor.set_style(null);

                if (results == 0) { // There aren't any results, display "(No results)"
                    this.mitemNoSearchResults.actor.show();
                } else {
                    this.mitemNoSearchResults.actor.hide();
                }
            });
        } else {
            this.mitemNoSearchResults.actor.hide();

            this._searchResults = [];
            this.refresh(0);
            this._historyItems[0].actor.set_style("font-weight: bold;");
        }
    }

    /*
     * Toggle GPaste's tracking status
     */
    toggleDaemon () {
        this._client.track(this.mitemTrack.state, null);
    }

    /*
     * Select another history
     */
    selectHistory(name) {
        this._client.switch_history(name, (client, result) => {
            this._client.switch_history_finish(result);
        });
    }

    /*
     * Empty the history
     */
    emptyHistory() {
        new ModalDialog.ConfirmDialog(_("Do you really want to empty the current history?"), () => {
            this._client.empty_history(this._historyName, null);
        }).open(global.get_current_time());
    }

    /*
     * Open GPaste's own GUI
     */
    openUI() {
        try {
            GPaste.util_spawn('Ui');
        }
        catch (e) { // Native approach didn't work, try alternative
            Util.spawnCommandLine("gpaste-client ui");
        }
    }

    /*
     *
     */
    showNewItemDialog() {
        this.dNewItem.open(global.get_current_time());
    }

    //
    // Events
    // ---------------------------------------------------------------------------------

    /*
     * The history has changed
     */
    _onClientUpdate(client, action, target, position) {
        debugLog("[" + uuid + "] Client event: _onClientUpdate");

        switch (target) {
            case GPaste.UpdateTarget.ALL:
                this.refresh(0);
                break;

            case GPaste.UpdateTarget.POSITION:
                switch (action) {
                    case GPaste.UpdateAction.REPLACE:
                        this._historyItems[position].refresh();
                        break;
                    case GPaste.UpdateAction.REMOVE:
                        this.refresh(position);
                        break;
                }
                break;
        }
    }

    /*
     * GPaste returned the list of histories
     */
    _onClientHistoriesListed(client, result) {
        debugLog("[" + uuid + "] Client event: _onClientHistoriesListed");

        const histories = this._client.list_histories_finish(result);

        for (let n in this._historyListItems) {
            this._historyListItems[n].destroy();
            delete this._historyListItems[n];
        }

        histories.forEach((name, index) => {
            if (name == "") return;

            const item = new GPasteHistoryListItem.GPasteHistoryListItem(this, name);

            if (name == this._historyName) {
                item.setShowDot(true);
            }

            this.cmitemSelectHistory.menu.addMenuItem(item);
            this._historyListItems[name] = item;
        });
    }

    /*
     * A history was deleted
     */
    _onClientDeleteHistory(client, name) {
        debugLog("[" + uuid + "] Client event: _onClientDeleteHistory");

        for (let n in this._historyListItems) {
            if (n == name) {
                this._historyListItems[n].destroy();
                delete this._historyListItems[n];
            }
        }
    }

    /*
     * Show menu
     */
    _onClientShowHistory() {
        debugLog("[" + uuid + "] Client event: _onClientShowHistory");

        this.menu.open();
    }

    /*
     *
     */
    _onClientSwitchHistory() {
        debugLog("[" + uuid + "] Client event: _onClientSwitchHistory");

        this._client.list_histories(this._onClientHistoriesListed.bind(this));

        this._client.get_history_name((client, result) => {
            this._historyName = this._client.get_history_name_finish(result);

            this.refresh();

            for (let n in this._historyListItems) {
                const item = this._historyListItems[n];
                item.setShowDot(item.histName == this._historyName);
            }
        });
    }

    /*
     * GPaste's tracking status has changed
     */
    _onClientTracking(client, state) {
        debugLog("[" + uuid + "] Client event: _onClientTracking");

        this.mitemTrack.setToggleState(state);
    }

    //
    // Overrides
    // ---------------------------------------------------------------------------------

    /*
     * Applet has been removed, disconnect signal handlers
     */
    on_applet_removed_from_panel() {
        debugLog("GPaste applet was removed from panel");

        this._signalManager.disconnectAllSignals();
    }

    /*
     * Applet has been clicked, display menu
     */
    on_applet_clicked(event) {
        this.menu.toggle();
    }

    /*
     * Panel edit mode has been toggled
     */
    _on_panel_edit_mode_changed() {
        this.actor.visible = global.settings.get_boolean('panel-edit-mode') || this.alwaysShowIcon;
    }
};
