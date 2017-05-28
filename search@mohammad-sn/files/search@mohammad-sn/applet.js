const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const FileDialog = imports.misc.fileDialog;
const Gio = imports.gi.Gio;
const Tooltips = imports.ui.tooltips;

let iconsize = 22;

function trimIfNeeded(text, length) {
    if (text.length > length) {
        text = text.substring(0, length / 2) + " ... " + text.substring(text.length - length / 2, text.length);
    }
    return text;
}

function OpenWithItem(info, file, pmenu) {
    this._init(info, file, pmenu);
}

OpenWithItem.prototype = {
    _init: function(info, file, pmenu) {
        try {
            this.info = info;
            this.file = file;
            this.parentmenu = pmenu;
    
            let appIcon = new St.Icon({
                gicon: info.get_icon(),
                icon_type: St.IconType.FULLCOLOR,
                icon_size: iconsize
            });
            if (appIcon.gicon == null)
                appIcon.icon_name = 'application-x-executable';
    
            this.actor = new St.Button({
                style_class: 'popup-menu-item',
                x_align: St.Align.MIDDLE
            });
    
            this.actor.style = 'padding: .5em 0em .5em 0em;';
    
            this.actor.set_child(appIcon);
    
            new Tooltips.Tooltip(this.actor, info.get_display_name() + ' (' + info.get_executable() + ' - ' + info.get_description() +')');
    
            this.actor.connect('notify::hover', function(actor) {
                let active = actor.hover;
                if (active) {
                    actor.add_style_pseudo_class('active');
                } else {
                    actor.remove_style_pseudo_class('active');
                }
            });
    
            this.actor.connect('button-release-event', Lang.bind(this, function(actor, event) {
                this.info.launch([this.file], null, null);
                this.parentmenu.close();
            }));
        } catch (e) { global.log(e); }
    }
};

function RMenuItem(label, app) {
    this._init(label, app);
}

RMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,
    _init: function(text, applet) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._path = text;
        this._app = applet;
        this.file = Gio.file_new_for_path(this._path);
        this.fileinfo = this.file.query_info('standard::*', 0, null);

        let filename = trimIfNeeded(text.substring(text.lastIndexOf('/') + 1, text.length), 65);
        let location = trimIfNeeded(text.substring(0, text.lastIndexOf('/')), 85);

        new Tooltips.Tooltip(this.actor, this._path);

        let fileIcon = new St.Icon({
            gicon: this.fileinfo.get_icon(),
            icon_type: St.IconType.FULLCOLOR,
            icon_size: iconsize
        });
        if (fileIcon.gicon == null)
            fileIcon.icon_name = 'unknown';
        let label = new St.Label({
            text: filename
        });

        label.set_margin_left(6.0);

        this.description = new St.Label({
            text: location,
            x_align: St.Align.START,
            style: 'font-size: .75em; font-style: italic;',
            opacity: 150
        });

        this.description.set_margin_left(6.0);

        let locationIcon = new St.Icon({
            icon_name: 'folder',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon'
        });

        this.locationButton = new St.Button({
            child: locationIcon,
            opacity: 0
        });

        this.locationButton.set_margin_left(11.0);

        let table = new St.Table({
            homogeneous: false,
            reactive: true
        });

        table.add(fileIcon, {
            row: 0,
            col: 0,
            col_span: 1,
            row_span: 1,
            x_expand: false,
            x_align: St.Align.START
        });

        table.add(label, {
            row: 0,
            col: 1,
            col_span: 1,
            x_align: St.Align.START
        });

        table.add(this.description, {
            row: 1,
            col: 1,
            col_span: 1,
            x_align: St.Align.START
        });

        table.add(this.locationButton, {
            row: 0,
            col: 2,
            col_span: 1,
            row_span: 2,
            x_expand: false,
            x_align: St.Align.END
        });

        this.addActor(table, {
            expand: true,
            span: 2,
            align: St.Align.START
        });

        this.locationButton.connect('clicked', Lang.bind(this, function() {
            Util.spawnCommandLine('nemo "' + this._path + '"');
            this._app.menu.close();
        }));

        this.locationButton.connect('enter-event', Lang.bind(this, function() {
            this.description.opacity = this.locationButton.opacity = 255;
        }));

        this.locationButton.connect('leave-event', Lang.bind(this, function() {
            this.description.opacity = this.locationButton.opacity = 150;
        }));

        this.actor.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));

        this.actor.connect('enter-event', Lang.bind(this, function() {
            if (this.locationButton.opacity == 0)
                this.locationButton.opacity = 150;
        }));

        this.actor.connect('leave-event', Lang.bind(this, function() {
            this.locationButton.opacity = 0;
        }));

        this.menu = new PopupMenu.PopupSubMenu(this.actor);

    },

    activate: function (event) {
        //Util.spawnCommandLine('xdg-open "' + this._path + '"');
        Gio.app_info_launch_default_for_uri(this.file.get_uri(),
                    global.create_app_launch_context());
        this._app.menu.close();
    },

    toggleMenu: function() {
        if (!this.menu.isOpen) {
            if (!this.menu._populated) {
                this.menu._populated = 1;

                let table = new St.Table({
                    homogeneous: false,
                    reactive: true
                });

                let menuItem = new St.Button({
                    style_class: 'popup-menu-item',
                    x_align: St.Align.START,
                    child: new St.Label({ text: _("Open with...") })
                });
                menuItem.connect('notify::hover', function(actor) {
                    let active = actor.hover;
                    if (active) {
                        actor.add_style_pseudo_class('active');
                    } else {
                        actor.remove_style_pseudo_class('active');
                    }
                });
                menuItem.connect('button-release-event', Lang.bind(this, function(actor, event) {
                    Util.spawnCommandLine('nemo-open-with "' + this.file.get_uri() + '"');
                    this._app.menu.close();
                }));

                table.add(menuItem, {
                    row: 0,
                    col: 0,
                    col_span: 1,
                    expand: true,
                    x_align: St.Align.START
                });

                let infos = Gio.AppInfo.get_all_for_type(this.fileinfo.get_content_type());

                for (let i = 0; i < infos.length && i < 6; i++) {
                    let appButton = new OpenWithItem(infos[i], this.file, this._app.menu);
                    table.add(appButton.actor, {
                        row: 0,
                        col: i + 1,
                        expand: true,
                        x_align: St.Align.MIDDLE
                    });
                }

                this.menu.box.insert_child_at_index(table, 0);
            }
            this._app.closeAllContextMenus();
        }
        this.menu.toggle();
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            if (Gio.AppInfo.get_all_for_type(this.fileinfo.get_content_type()).length == 0)
                this.toggleMenu();
            else
                this.activate();
        }
        if (event.get_button() == 3) {
            this.toggleMenu();
        }
        return true;
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        let char = String.fromCharCode(symbol);
        if (char > '0' && char < 'z') {
            this._app.searchEntry.set_text(char);
            global.stage.set_key_focus(this._app.searchEntry);
            return true;
        }
        return false;
    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.metadata = metadata;
        this.instance_id = instance_id;
        this.AppletDir = AppletManager.appletMeta[this.metadata.uuid].path;
        try {
            this.set_applet_icon_symbolic_name("edit-find");
            this.set_applet_tooltip(_("Search files"));

            this.settings = new Settings.AppletSettings(this, "search@mohammad-sn", instance_id);

            this.settings.bind("include-long-text", "include_dirs", this.on_settings_changed);
            this.settings.bind("exclude-long-text", "exclude_dirs", this.on_settings_changed);
            this.settings.bind("keybinding", "keybinding", this.on_keybinding_changed);
            this.settings.bind("history", "history", function() {});
            this.settings.bind("include-hidden-dirs", "include_hidden", this.on_settings_changed);
            this.settings.bind("icon-size", "icon_size", this.on_icon_settings_changed);

            this.dbs = '';

            if (this.include_dirs.split('\n').join('') == '')
                this.include_dirs = GLib.get_home_dir() + '\n';


            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.actor.add_style_class_name('panel-status-button');

            this.SMenuItem = new PopupMenu.PopupBaseMenuItem({
                reactive: false
            });
            let searchIcon = new St.Icon({
                style_class: 'menu-search-entry-icon',
                icon_name: 'edit-find',
                icon_type: St.IconType.SYMBOLIC
            });

            this.searchBox = new St.BoxLayout();
            this.searchEntry = new St.Entry({
                name: 'menu-search-entry',
                hint_text: _("Type to search..."),
                track_hover: true,
                can_focus: true
            });

            this.searchEntry.set_secondary_icon(searchIcon);
            this.searchBox.add_actor(this.searchEntry);

            this.searchEntryText = this.searchEntry.clutter_text;
            this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
            this._previousSearchPattern = "";

            this.resultsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Results"));
            this.resultsMenu.menu.actor.remove_style_class_name('popup-sub-menu');
            this.resultsMenu.actor.visible = false;
            this.menu.addMenuItem(this.resultsMenu);

            this.SMenuItem.addActor(this.searchBox, {
                expand: true
            });
            this.menu.addMenuItem(this.SMenuItem);
            this.menu.connect('open-state-changed', Lang.bind(this, this._onToggled));

            this.on_settings_changed();
            this.on_icon_settings_changed();
            this.on_keybinding_changed();

            this.historyindex = 0;

            this.theID = 0;

        } catch (e) {
            global.logError(e);
        }
    },

    on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
    },

    on_hotkey_triggered: function() {
        if (this.menu.isOpen)
            this.searchEntry.set_text('');
        else
            this.menu.toggle();
    },

    on_icon_settings_changed: function() {
        iconsize = this.icon_size;
    },

    on_settings_changed: function() {
        idirs = this.include_dirs.split('\n');
        this.dbs = '';
        if (idirs.join('').length > 0) {
            _dbs = [];
            for (i = 0; i < idirs.length; i++) {
                if (idirs[i].length == 0) continue;
                let updatedb = this.AppletDir + '/mlocate/updatedbnh';
                if (this.include_hidden)
                    updatedb = this.AppletDir + '/mlocate/updatedb';
                Util.spawnCommandLine(updatedb + ' -l 0 -o ' + this.AppletDir + '/db/db_file' + i.toString() + ' -U "' + idirs[i] +
                    '" --prunepaths "' + this.exclude_dirs.split(' ').join('?').split('\n').join(' ') + '"');
                _dbs.push(this.AppletDir + '/db/db_file' + i.toString());
            }
            this.dbs = '-d "' + _dbs.join(':') + '"';
        }
    },

    on_include_button_pressed: function() {
        FileDialog.openFolder(Lang.bind(this, function(path) {
            this.include_dirs += path;
            this.on_settings_changed();
        }), {});
    },

    on_exclude_button_pressed: function() {
        FileDialog.openFolder(Lang.bind(this, function(path) {
            this.exclude_dirs += path;
            this.on_settings_changed();
        }), {});
    },

    _onToggled: function(actor, isOpening) {
        if (isOpening) {
            global.stage.set_key_focus(this.searchEntry);
        } else {
            this.searchEntry.set_text('');
            this.resultsMenu.menu.removeAll();
            this.historyindex = 0;
        }
    },

    _onSearchTextChanged: function(se, prop) {
        if (this.searchEntry.get_text().length > 1) {
            if (this.theID)
                Mainloop.source_remove(this.theID);
            if (this.searchEntry.get_text().length > 0)
                this.theID = Mainloop.timeout_add(400, Lang.bind(this, this._performSearch));
        }
    },

    _performSearch: function() {
        this.theID = 0;
        let query = this.searchEntry.get_text();
        let response = this._spawn_sync(this.AppletDir + '/mlocate/locate ' + this.dbs + ' -A -i -l 100 ' + query)[1].toString().split('\n');
        this.resultsMenu.menu.removeAll();

        response.splice(-1);
        if (!this.include_hidden) {
            for (i = 0; i < response.length; i++) {
                if(response[i].indexOf('/.') > -1) {
                    response.splice(i, 1);
                    i--;
                }
            }
        }
        response = this._sortResults(response, query).slice(0, 12);

        for (i = 0; i < response.length; i++) {
            this.resultsMenu.menu.addMenuItem(new RMenuItem(response[i], this));
        }
        this.resultsMenu.menu.open();
    },

    _sortResults: function(results, query) {
        results.sort(function(a, b) {

            a = a.toLowerCase();
            b = b.toLowerCase();
            query = query.split(' ')[0].toLowerCase();

            let anameIndex = a.lastIndexOf(query) - a.lastIndexOf('/');
            let bnameIndex = b.lastIndexOf(query) - b.lastIndexOf('/');
            let ascore = 0;
            let bscore = 0;

            if (anameIndex == 1) {
                ascore += 3;
                    if (a.substr(a.lastIndexOf('/') + 1) == query)
                        ascore += 1;
            } else if (anameIndex > 1) {
                ascore += 1;
                if (anameIndex < bnameIndex || bnameIndex < 0)
                    ascore += 1;
            }
            if (bnameIndex == 1) {
                bscore += 3;
                    if (b.substr(b.lastIndexOf('/') + 1) == query)
                        bscore += 1;
            } else if (bnameIndex > 1) {
                bscore += 1;
                if (bnameIndex < anameIndex || anameIndex < 0)
                    bscore += 1;
            }

            if (ascore > bscore) return -1;
            if (ascore < bscore) return 1;
            if (anameIndex > bnameIndex) return 1;

            return 0;
        });
        return results;
    },

    _spawn_sync: function(script) {
        return GLib.spawn_sync(null, ['bash', '-c', script],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null);
    },

    closeAllContextMenus: function() {
        this.resultsMenu.menu._getMenuItems().forEach(function(item, index, arr) {
            item.menu.close();
        });
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }

};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
