const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const CMenu = imports.gi.CMenu;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;
const Signals = imports.signals;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const UUID = "slingshot@jfarthing84";
const AppletPath = imports.ui.appletManager.applets['slingshot@jfarthing84'];
const Granite = AppletPath.granite;
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

/** App ***********************************************************************/

function App(app) {
    if (app instanceof CMenu.TreeEntry)
        this._init(app);
    else
        this._fromCommand(app);
}

App.prototype = {

    _init: function(entry) {

        let info = entry.get_app_info();

        this.name = info.get_display_name();
        this.description = info.get_description() || this.name;
        this.exec = info.get_commandline();
        this.desktopId = entry.get_desktop_file_id();
        this.desktopPath = entry.get_desktop_file_path();
        this.genericName = info.get_generic_name() || '';
        this.icon = info.get_icon();
    },

    _fromCommand: function(command) {

        this.name = command;
        this.description = _('Run this command...');
        this.exec = command;
        this.desktopId = command;
        this.icon = new Gio.ThemedIcon({ name: 'system-run' });

        this._isCommand = true;
    },

    launch: function() {
        try {
            if (this._isCommand) {
                global.log('Launching command: ' + this.name);
                GLib.spawn_command_line_async(this.exec);
            } else {
                this.emit('launched', this);
                Gio.DesktopAppInfo.new(this.desktopId).launch([], null);
                global.log('Launching application: ' + this.name);
            }
        } catch (e) {
            global.log(e);
        }
    }
}
Signals.addSignalMethods(App.prototype);

/** AppSystem *****************************************************************/

function AppSystem() {
    this._init();
}

AppSystem.prototype = {

    _init: function() {

        this._categories = null;
        this._apps = null;

        this._appsMenu = Cinnamon.AppSystem.get_default().get_tree();
        this._appsMenu.connect('changed', Lang.bind(this, this._updateAppSystem));

        this._updateAppSystem();
    },

    _updateAppSystem: function() {

        this._appsMenu.load_sync();

        this._updateCategoriesIndex();
        this._updateApps();

        this.emit('changed');
    },

    _updateCategoriesIndex: function() {

        global.log('Updating categories...');

        this._categories = [];

        let iter = this._appsMenu.get_root_directory().iter();
        let type;

        while ((type = iter.next()) != CMenu.TreeItemType.INVALID) {
            if (type == CMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                if (!dir.get_is_nodisplay())
                    this._categories.push(dir);
            }
        }
    },

    _updateApps: function() {

        global.log('Updating apps...');

        this._apps = {};

        this._categories.forEach(function(cat, index) {
            this._apps[cat.get_name()] = this.getAppsByCategory(cat);
        }, this);
    },

    getCategories: function() {
        return this._categories;
    },

    getAppsByCategory: function(category) {

        let appList = [];

        let iter = category.iter();
        let type;

        while ((type = iter.next()) != CMenu.TreeItemType.INVALID) {
            switch (type) {
                case CMenu.TreeItemType.DIRECTORY:
                    appList.concat(this.getAppsByCategory(iter.get_directory()));
                    break;
                case CMenu.TreeItemType.ENTRY:
                    let entry = iter.get_entry();
                    if (!entry.get_app_info().get_nodisplay()) {
                        let app = new App(entry);
                        appList.push(app);
                    }
                    break;
            }
        }
        return appList;
    },

    getApps: function() {
        return this._apps;
    },

    getAppsByName: function() {

        let sortedAppList = [];
        let sortedAppExecs = [];

        for (let category in this._apps) {
            let apps = this._apps[category];
            apps.forEach(function(app) {
                if (sortedAppExecs.indexOf(app.exec) == -1) {
                    sortedAppList.push(app);
                    sortedAppExecs.push(app.exec);
                }
            });
        }

        sortedAppList.sort(function(a, b) {
            return a.name.toLowerCase() > b.name.toLowerCase();
        });

        return sortedAppList;
    },

    searchResults: function(search) {

        global.log('Searching for "' + search + '"');

        let filtered = [];

        for (let category in this._apps) {
            this._apps[category].forEach(function(app) {
                if (app.name.toLowerCase().indexOf(search) != -1) {
                    if (search == app.name.toLowerCase().slice(0, search.length))
                        app.relevancy = 0.5;
                    else
                        app.relevancy = app.name.length / search.length;
                    filtered.push(app);
                } else if (app.exec.toLowerCase().indexOf(search) != -1) {
                    app.relevancy = app.exec.length / search.length * 10.0;
                    filtered.push(app);
                } else if (app.description.toLowerCase().indexOf(search) != -1) {
                    app.relevancy = app.description.length / search.length;
                    filtered.push(app);
                } else if (app.genericName.toLowerCase().indexOf(search) != -1) {
                    app.relevancy = app.genericName.length / search.length;
                    filtered.push(app);
                }
            });
        }

        filtered.sort(function(a, b) {
            return (a.relevancy * 1000 - b.relevancy * 1000);
        });

        global.log('Found ' + filtered.length + ' apps');

        if (filtered.length > 20) {
            return filtered.slice(0, 20);
        } else {
            return filtered;
        }
    }
}
Signals.addSignalMethods(AppSystem.prototype);

/** AppEntry ******************************************************************/

function AppEntry(app) {
    this._init(app);
}

AppEntry.prototype = {

    _init: function(app) {

        this._appplication = app;
        this.appName = app.name;
        this.execName = app.exec;
        this.iconSize = Slingshot.iconSize;
        this.icon = app.icon;

        this.actor = new St.Button({
            style_class: 'button app',
            x_fill: true,
            y_fill: true
        });
        this.actor.set_size(130, 130);
        this.actor._delegate = this;

        let layout = new St.BoxLayout({
            margin_top: 5,
            margin_right: 5,
            margin_bottom: 5,
            margin_left: 5,
            vertical: true
        });

        let appIcon = new St.Icon({
            icon_size: this.iconSize,
            gicon: this.icon
        });
        layout.add_actor(appIcon);

        let appLabel = new St.Label({
            text: this.appName,
            margin_top: 9,
            style: 'text-align: center',
            x_align: Clutter.ActorAlign.CENTER
        });
        appLabel.clutter_text.set_line_wrap(true);
        appLabel.clutter_text.set_single_line_mode(false);
        appLabel.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        appLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        layout.add_actor(appLabel);

        let appTooltip = new Tooltips.Tooltip(this.actor, app.description);

        this.actor.add_actor(layout);

        this.actor.connect('clicked', Lang.bind(this, this.launchApp));
    },

    launchApp: function() {
        this._appplication.launch();
        this.emit('app-launched');
    }
}
Signals.addSignalMethods(AppEntry.prototype);

/** CategoryView **************************************************************/

function CategoryView(parent) {
    this._init(parent);
}

CategoryView.prototype = {

    _init: function(parent) {

        this._view = parent;

        this._currentPosition = 0;
        this._fromCategory = false;
        this.categoryIds = [];

        this.actor = new St.BoxLayout();
        this.actor.set_size(this._view.columns * 130 + 17, this._view.viewHeight);
        this.actor._delegate = this;

        this._setupUi();
        this.setupSidebar();
        this._connectEvents();
    },

    _setupUi: function() {

        this._container = new St.Table({
            homogeneous: false,
            x_expand: true,
            y_expand: true
        });

        this.separator = new St.Bin({
            margin_right: 1,
            style_class: 'separator',
            width: 1
        });

        this._layout = new St.BoxLayout({
            clip_to_allocation: true,
            reactive: true
        });

        this.appView = new Grid(this._view.rows, this._view.columns - 1);
        this._layout.add(this.appView.actor, { expand: true });

        this.switcher = new Switcher();

        this._pageSwitcher = new St.Bin();
        this._pageSwitcher.add_actor(this.switcher.actor);

        this._container.add(this.separator, {
            col: 1,
            row: 0,
            col_span: 1,
            row_span: 2,
            x_expand: false
        });
        this._container.add(this._layout, {
            col: 2,
            row: 0,
            col_span: 1,
            row_span: 1,
            y_align: St.Align.START
        });

        this.actor.add(this._container, { expand: true });
    },

    setupSidebar: function() {

        if (this.categorySwitcher != null)
            this.categorySwitcher.actor.destroy();

        this.categorySwitcher = new Sidebar();
        this.categorySwitcher.actor.can_focus = false;

        for (let catName in this._view.apps) {
            this.categoryIds.push(catName);
            this.categorySwitcher.addCategory(GLib.dgettext('gnome-menus-3.0', catName));
        }

        this._container.add(this.categorySwitcher.actor, {
            col: 0,
            row: 0,
            col_span: 1,
            row_span: 2,
            x_expand: false
        });
        this.categorySwitcher.connect('selection-changed', Lang.bind(this, function(actor, name, nth) {

            this._view.resetCategoryFocus();
            let category = this.categoryIds[nth];
            this.showFilteredApps(category);
        }));
    },

    _connectEvents: function() {

        this._layout.connect('scroll-event', Lang.bind(this, function(actor, event) {
            switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.UP:
                case Clutter.ScrollDirection.LEFT:
                    this.switcher.setActive(this.switcher.active - 1);
                    break;
                case Clutter.ScrollDirection.DOWN:
                case Clutter.ScrollDirection.RIGHT:
                    this.switcher.setActive(this.switcher.active + 1);
                    break;
            }
            return true;
        }));

        this.appView.connect('new-page', Lang.bind(this, function(actor, page) {
            if (this.switcher.size == 0)
                this.switcher.append('1');
            this.switcher.append(page);

            /* Prevents pages from changing */
            this._fromCategory = true;
        }));

        this.switcher.connect('active-changed', Lang.bind(this, function() {
            if (this._fromCategory || this.switcher.active - this.switcher.oldActive == 0) {
                this._fromCategory = false;
                return;
            }

            this.movePage(this.switcher.active - this.switcher.oldActive);
            this._view.searchbar.grabFocus();
        }));

        this.categorySwitcher.selected = 0;
    },

    _addApp: function(app) {

        let appEntry = new AppEntry(app);
        appEntry.connect('app-launched', Lang.bind(this, function() {
            this._view.close(true);
        }));
        this.appView.append(appEntry.actor);
    },

    showFilteredApps: function(category) {

        this.switcher.clearChildren();
        this.appView.clear();

        this._view.apps[category].forEach(function(app) {
            this._addApp(app);
        }, this);

        this.switcher.setActive(0);

        this.appView.actor.set_x(0);
        this._currentPosition = 0;
    },

    movePage: function(step) {

        if (step == 0)
            return;
        if (step < 0 && this._currentPosition >= 0) //Left border
            return;
        if (step > 0 && (-this._currentPosition) >= ((this.appView.getNPages() - 1) * this.appView.getPageColumns() * 130)) //Right border
            return;

        let count = 0;
        let increment = -step * 130 * (this._view.columns - 1) / 10;
        Mainloop.timeout_add(30 / (this._view.columns - 1), Lang.bind(this, function() {

            if (count >= 10) {
                this._currentPosition += -step * 130 * (this._view.columns - 1) - 10 * increment; //We adjust to end of the page
                this.appView.actor.set_x(this._currentPosition);
                return false;
            }

            this._currentPosition += increment;
            this.appView.actor.set_x(this._currentPosition);
            count++;
            return true;
        }));
    },

    showPageSwitcher: function(show) {

        if (this._pageSwitcher.get_parent() == null) {
            this._container.add(this._pageSwitcher, {
                col: 2,
                row: 1,
                col_span: 1,
                row_span: 1,
                x_expand: false,
                y_expand: false
            });
        }

        if (show) {
            this._pageSwitcher.show();
            this._view.bottom.hide();
        }
        else
            this._pageSwitcher.hide();

        this._view.searchbar.grabFocus();
    }
}
Signals.addSignalMethods(CategoryView.prototype);

/** Grid **********************************************************************/

function Grid(rows, columns) {
    this._init(rows, columns);
}

Grid.prototype = {

    _init: function(rows, columns) {

        this._currentRow = 0;
        this._currentCol = 0;

        this.rowSpacing = 20;
        this.columnSpacing = 0;

        this._pageRows = rows;
        this._pageCols = columns;
        this._pageNumber = 1;

        //global.log('Grid Columns: ' + this._pageCols);
        //global.log('Grid Rows: ' + this._pageRows);

        this.actor = new St.Table({
            homogeneous: true,
            style:
                'spacing-rows: ' + this.rowSpacing + 'px;' +
                'spacing-columns: ' + this.columnSpacing + 'px;'
        });
        this.actor._delegate = this;
    },

    append: function(actor) {

        this._updatePosition();

        let col = this._currentCol + this._pageCols * (this._pageNumber - 1);

        //global.log('Adding actor to grid view at' + ' Col: '+ this._currentCol + ' Row: ' + this._currentRow + ' Page: ' + this._pageNumber + ')');

        this.actor.add(actor, {
            col: col,
            row: this._currentRow,
            col_span: 1,
            row_span: 1
        });
        this._currentCol++;
    },

    _updatePosition: function() {

        if (this._currentCol == this._pageCols) {
            this._currentCol = 0;
            this._currentRow++;
        }

        if (this._currentRow == this._pageRows) {
            this._pageNumber++;
            this.emit('new-page', this._pageNumber);
            this._currentRow = 0;
        }
    },

    clear: function() {

        this.actor.get_children().forEach(function(child, index) {
            if (child.get_parent() != null)
                this.actor.remove_actor(child);
            child.destroy();
        }, this);

        this._currentRow = 0;
        this._currentCol = 0;
        this._pageNumber = 1;
    },

    getPageColumns: function() {
        return this._pageCols;
    },

    getPageRows: function() {
        return this._pageRows;
    },

    getNPages: function() {
        return this._pageNumber;
    },

    resize: function(rows, columns) {

        this.clear();
        this._pageRows = rows;
        this._pageCols = columns;
        this._pageNumber = 1;
    },

    getChildAt: function(column, row) {
        let children = this.actor.get_children();
        let child;

        for (let index in children) {
            let meta = this.actor.get_child_meta(children[index]);
            if (column == meta.col && row == meta.row) {
                child = children[index];
                break;
            }
        }

        return child;
    }
}
Signals.addSignalMethods(Grid.prototype);

/** SearchItem ****************************************************************/

function SearchItem(app) {
    this._init(app);
}

SearchItem.prototype = {

    _init: function(app) {

        this.inBox = false;
        this.iconSize = 64;

        this._app = app;

        this._icon = new St.Icon({
            icon_size: this.iconSize,
            gicon: app.icon,
            margin_left: 74 - this.iconSize
        });

        this._nameLabel = new St.Label({
            text: '<b><span size="larger">' + this._fix(app.name) + '</span></b>'
        });
        this._nameLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        this._nameLabel.clutter_text.use_markup = true;

        this._descLabel = new St.Label({ text: this._fix(app.description) });
        this._descLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);

        let vbox = new St.BoxLayout({
            margin_top: 5,
            margin_left: 78 - this.iconSize,
            vertical: true
        });
        vbox.add_actor(this._nameLabel);
        vbox.add_actor(this._descLabel);

        let layout = new St.BoxLayout();
        layout.add_actor(this._icon);
        layout.add_actor(vbox);

        this.actor = new St.Button({
            height: this.iconSize + 10,
            style_class: 'button app',
            x_align: Clutter.ActorAlign.START,
            x_fill: true
        });
        this.actor.add_actor(layout);
        this.actor._delegate = this;

        this.actor.connect('queue-redraw', Lang.bind(this, this._onRedraw));
        this.connect('launch-app', Lang.bind(this, function() {
            this._app.launch();
        }));
    },

    _onRedraw: function() {
        this.actor.set_height(this.iconSize + 10);
        this._icon.set_icon_size(this.iconSize);
        this._icon.set_margin_left(74 - this.iconSize);
    },

    _fix: function(text) {
        return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
    }
}
Signals.addSignalMethods(SearchItem.prototype);

/** SearchView ****************************************************************/

function SearchView(parent) {
    this._init(parent);
}

SearchView.prototype = {

    _init: function(parent) {

        this._selected = 0;
        this.appsShowed = 0;

        this._view = parent;

        this.actor = new St.BoxLayout({ can_focus: true, vertical: true });
        this.actor.set_width(this._view.columns * 130);
        this.actor._delegate = this;

        this._items = {};
        this._separator = new St.Bin({
            margin_top: 4,
            margin_bottom: 4,
            style_class: 'separator',
            height: 1
        });
        this._separator.inBox = false
    },

    addApps: function(apps) {

        apps.forEach(function(app) {
            let searchItem = new SearchItem(app);

            this.appendApp(app, searchItem);
        }, this);
    },

    appendApp: function(app, searchItem) {

        searchItem.actor.connect('clicked', Lang.bind(this, function() {
            app.launch();
            this.emit('app-launched');
            return true;
        }));

        this._items[app.name] = searchItem;
    },

    showApp: function(app) {

        if (!(this._items.hasOwnProperty(app.name))) {
            let searchItem = new SearchItem(app);
            this.appendApp(app, searchItem);
        }

        if (this.appsShowed == 1)
            this._showSeparator();

        if (!(this._items[app.name].inBox)) {
            this.actor.add_actor(this._items[app.name].actor, {
                expand: true,
                x_fill: true,
                y_fill: true
            });
            this._items[app.name].inBox = true;
            this._items[app.name].iconSize = 48;
            this._items[app.name].actor.queue_redraw();
        }

        this._items[app.name].actor.show();
        this.appsShowed++;

        if (this.appsShowed == 1) {
            this._items[app.name].iconSize = 64;
            this._items[app.name].actor.queue_redraw();
            this.selected = 0;
        }
    },

    hideApp: function(app) {
        this._items[app.name].actor.hide();
        this.appsShowed--;
    },

    hideAll: function() {

        this._hideSeparator();

        for (let appName in this._items) {
            let app = this._items[appName];
            app.actor.hide();
            if (app.inBox) {
                this.actor.remove_actor(app.actor);
                app.inBox = false;
            }
        }
        this.appsShowed = 0;
    },

    addCommand: function(command) {

        let app = new App(command, true);
        let item = new SearchItem(app);

        this.appendApp(app, item);

        this.showApp(app);
    },

    _showSeparator: function() {

        if (!(this._separator.inBox)) {
            this.actor.add_actor(this._separator);
            this._separator.inBox = true;
        }
        this._separator.show();
    },

    _hideSeparator: function() {

        this._separator.hide();
        if (this._separator.inBox) {
            this.actor.remove_actor(this._separator);
            this._separator.inBox = false;
        }
    },

    _selectNth: function(index) {

        if (this._selectedApp != null)
            this._selectedApp.actor.remove_style_pseudo_class('hover');

        let selectedActor = this.actor.get_child_at_index(index);
        // Lame
        for (let appName in this._items) {
            let searchItem = this._items[appName];
            if (selectedActor == searchItem.actor) {
                this._selectedApp = searchItem;
                break;
            }
        }
        this._selectedApp.actor.add_style_pseudo_class('hover');
    },

    launchSelected: function() {

        this._selectedApp.emit('launch-app');
    },

    get selected() {
        return this._selected;
    },

    set selected(value) {
        if (value < 0 || value > this.actor.get_children().length - 1)
            return;

        if (value != 1) {
            this._selectNth(value);
            this._selected = value;
        } else if (this._selected - value > 0) {
            /* Get a sort of direction */
            this._selectNth(value - 1);
            this._selected = value -1;
        } else {
            this._selectNth(value + 1);
            this._selected = value + 1;
        }
    }
}
Signals.addSignalMethods(SearchView.prototype);

/** Sidebar *******************************************************************/

function Sidebar() {
    this._init();
}

Sidebar.prototype = {

    _init: function() {

        this.actor = new St.BoxLayout({
            reactive: true,
            vertical: true,
            width: 145
        });
        this.actor.add_style_class_name('sidebar');
        this.actor._delegate = this;

        this.actor.connect('scroll-event', Lang.bind(this, function(actor, event) {
            switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.UP:
                case Clutter.ScrollDirection.LEFT:
                    this.selectNth(this.selected - 1);
                    break;
                case Clutter.ScrollDirection.DOWN:
                case Clutter.ScrollDirection.RIGHT:
                    this.selectNth(this.selected + 1);
                    break;
            }
            return true;
        }));
    },

    addCategory: function(entryName) {

        let button = new St.Button({
            label: entryName,
            toggle_mode: true,
            style: 'padding-left: 12px;' +
                   'padding-right: 12px;',
            style_class: 'button',
            x_align: St.Align.START
        });
        button.connect('clicked', Lang.bind(this, this.selectionChange));

        this.actor.add_actor(button);
    },

    selectionChange: function(button) {

        if (this._selected != null)
            this.actor.get_child_at_index(this._selected).set_checked(false);

        button.set_checked(true);

        let nth = this.actor.get_children().indexOf(button);
        let name = button.get_label();

        this._selected = nth;
        this.emit('selection-changed', name, nth);
    },

    selectNth: function(nth) {

        let button;

        if (nth < this.catSize) {
            button = this.actor.get_child_at_index(nth);
        } else {
            return false;
        }

        this.selectionChange(button);
        return true;
    },

    get catSize() {
        return this.actor.get_children().length;
    },

    get selected() {
        return this._selected;
    },
    set selected(value) {
        if (value >= 0 && value < this.catSize) {
            this.selectNth(value);
            this._selected = value;
        }
    }
}
Signals.addSignalMethods(Sidebar.prototype);

/** Switcher ******************************************************************/

function Switcher() {
    this._init();
}

Switcher.prototype = {

    _init: function() {

        this.active = -1;
        this.oldActive = -1;

        this.actor = new St.BoxLayout({
            can_focus: false,
            style: 'spacing: 4px;'
        });
        this.actor._delegate = this;
    },

    append: function(label) {

        let button = new St.Button({
            label: label.toString(),
            width: 30,
            can_focus: false,
            style_class: 'button switcher',
            toggle_mode: true
        });

        button.connect('clicked', Lang.bind(this, function(event) {
            let select = this.actor.get_children().indexOf(button);
            this.setActive(select);
            return true;
        }));

        this.actor.add_actor(button);
    },

    setActive: function(newActive) {

        if (newActive >= this.actor.get_children().length)
            return;

        // Why is this needed here but not in the Vala version?
        if (newActive < 0)
            return;

        if (this.active >= 0)
            this.actor.get_children()[this.active].set_checked(false);

        this.oldActive = this.active;
        this.active = newActive;

        this.emit('active-changed');

        this.actor.get_children()[this.active].set_checked(true);
    },

    clearChildren: function() {

        this.actor.get_children().forEach(function(button, index) {
            button.hide();
            if (button.get_parent() != null)
                this.actor.remove_actor(button);
        }, this);

        this.oldActive = 0;
        this.active = 0;
    },

    get size() {
        return this.actor.get_children().length;
    }
}
Signals.addSignalMethods(Switcher.prototype);

/** SlingshotView *************************************************************/

function SlingshotView(launcher, orientation) {
    this._init(launcher, orientation);
}

SlingshotView.prototype = {

    __proto__: Granite.Widgets.PopOver.prototype,

    _init: function(launcher, orientation) {

        Granite.Widgets.PopOver.prototype._init.call(this, launcher, orientation);

        this.Modality = {
            NORMAL_VIEW: 0,
            CATEGORY_VIEW: 1,
            SEARCH_VIEW: 2
        }

        this._currentPosition = 0;
        this._searchViewPosition = 0;
        this._modality = null;

        this._columnFocus = 0;
        this._rowFocus = 0;

        this._categoryColumnFocus = 0;
        this._categoryRowFocus = 0;

        this._readSettings(true);

        this.appSystem = new AppSystem();

        this._categories = this.appSystem.getCategories();
        this.apps = this.appSystem.getApps();

        let resolution = Main.layoutManager.primaryMonitor.width + 'x' + Main.layoutManager.primaryMonitor.height;
        if (Slingshot.screenResolution != resolution)
            this._setupSize();
        this.box.set_height(this._defaultRows * 145 + 140);
        this._setupUi();
        this._connectSignals();
    },

    _setupSize: function() {

        global.log('Setting up size...');
        Slingshot.screenResolution = Main.layoutManager.primaryMonitor.width + 'x' + Main.layoutManager.primaryMonitor.height;
        this._defaultColumns = 5;
        this._defaultRows = 3;

        while ((this._defaultColumns * 130 + 48 >= 2 * Main.layoutManager.primaryMonitor.width / 3)) {
            this._defaultColumns--;
        }

        while ((this._defaultRows * 145 + 72 >= 2 * Main.layoutManager.primaryMonitor.height / 3)) {
            this._defaultRows--;
        }

        if (Slingshot.columns != this._defaultColumns)
            Slingshot.columns = this._defaultColumns;
        if (Slingshot.rows != this._defaultRows)
            Slingshot.rows = this._defaultRows;

        //global.log('Default Columns: ' + this._defaultColumns);
        //global.log('Default Rows: ' + this._defaultRows);
    },

    _setupUi: function() {

        global.log('Setting up UI...');

        this.container = new St.BoxLayout({
            vertical: true
        });

        this.top = new St.BoxLayout({
            margin_top: 12,
            margin_right: 12,
            margin_bottom: 12,
            margin_left: 12
        });

        let topSeparator = new St.Label({ text: '' });

        this.viewSelector = new Granite.Widgets.ModeButton();

        let image = new St.Icon({
            icon_size: 16,
            gicon: new Gio.ThemedIcon({ name: 'view-grid-symbolic' })
        });
        this.viewSelector.append(image, _('View as Grid'));

        image = new St.Icon({
            icon_size: 16,
            gicon: new Gio.ThemedIcon({ name: 'view-list-symbolic' })
        });
        this.viewSelector.append(image, _('View by Category'));

        if (Slingshot.useCategory)
            this.viewSelector.selected = 1;
        else
            this.viewSelector.selected = 0;

        this.searchbar = new Granite.Widgets.SearchBar(_("Search Apps..."));
        this.searchbar.pauseDelay = 200;
        this.searchbar.actor.set_width(250);
        this.searchbar.actor.set_x_align(Clutter.ActorAlign.END);
        this.searchbar.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
            return event.button === 3;
        }));

        this.top.add(this.viewSelector.actor);
        this.top.add(topSeparator, { expand: true });
        this.top.add(this.searchbar.actor);

        this.center = new St.BoxLayout({
            margin_top: 0,
            margin_right: 12,
            margin_bottom: 12,
            margin_left: 12
        });

        // Create the layout which works like view_manager
        this.viewManager = new St.BoxLayout({
            clip_to_allocation: true
        });
        this.viewManager.set_size(this._defaultColumns * 130, this._defaultRows * 145);
        this.center.add(this.viewManager, { expand: true, x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START });

        // Create the "NORMAL_VIEW"
        this._gridView = new Grid(this._defaultRows, this._defaultColumns);
        this.viewManager.add(this._gridView.actor, { expand: true, x_fill: true, y_fill: false, x_align: St.Align.START, y_align: St.Align.START });

        // Create the "SEARCH_VIEW"
        this._searchView = new SearchView(this);
        for (let category in this.apps) {
            this._searchView.addApps(this.apps[category]);
        }
        this.viewManager.add(this._searchView.actor, { expand: true, x_fill: true, y_fill: true, x_align: St.Align.START, y_align: St.Align.START });

        // Create the "CATEGORY_VIEW"
        this._categoryView = new CategoryView(this);
        this.viewManager.add(this._categoryView.actor, { expand: true, x_fill: true, y_fill: false, x_align: St.Align.START, y_align: St.Align.START });

        this.pageSwitcher = new Switcher();

        this.bottom = new St.Bin({
            margin_top: 0,
            margin_right: 24,
            margin_bottom: 12,
            margin_left: 24
        });
        this.bottom.add_actor(this.pageSwitcher.actor);

        this.container.add(this.top, {});
        this.container.add(this.center, { expand: true, x_fill: false, y_fill: true });
        this.container.add(this.bottom, {});

        this.box.add(this.container, { expand: true, x_fill: true, y_fill: true });

        if (Slingshot.useCategory)
            this._setModality(this.Modality.CATEGORY_VIEW);
        else
            this._setModality(this.Modality.NORMAL_VIEW);

        global.log('UI setup complete.');
    },

    _connectSignals: function() {

        this.box.connect('key-focus-in', Lang.bind(this, function() {
            this.searchbar.grabFocus();
            return false;
        }));

        this.box.connect('key-press-event', Lang.bind(this, this._onKeyPress));
        this.searchbar.connect('text-changed-pause', Lang.bind(this, function(actor, text) {
            this._search(text);
        }));
        this.searchbar.grabFocus();

        this.searchbar.connect('activate', Lang.bind(this, function() {
            if (this._modality == this.Modality.SEARCH_VIEW) {
                this._searchView.launchSelected();
                this.close(true);
            } else {
                let keyFocus = global.stage.get_key_focus();
                if (keyFocus._delegate && keyFocus._delegate instanceof AppEntry)
                    keyFocus._delegate.launchApp();
            }
        }));

        this._searchView.connect('app-launched', Lang.bind(this, function() {
            this.close(true);
        }));

        this._gridView.connect('new-page', Lang.bind(this, function(actor, pageNumber) {
            this.pageSwitcher.append(pageNumber);
        }));
        this.populateGridView();

        this.pageSwitcher.connect('active-changed', Lang.bind(this, function() {
            this._movePage(this.pageSwitcher.active - this.pageSwitcher.oldActive);
            this.searchbar.grabFocus();
        }));

        this.viewSelector.connect('mode-changed', Lang.bind(this, function() {
            this._setModality(this.viewSelector.selected);
        }));

        this.appSystem.connect('changed', Lang.bind(this, function() {

            this._categories = this.appSystem.getCategories();
            this.apps = this.appSystem.getApps();

            this.populateGridView();
            this._categoryView.setupSidebar();
        }));

        // Make some connections that are there by default in GTK/Granite
        this.box.set_reactive(true);
        this.box.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
    },

    _changeViewMode: function(key) {
        switch (key) {
            case 1: // Normal view
                this.viewSelector.selected = 0;
                break;
            default: // Category view
                this.viewSelector.selected = 1;
                break;
        }
    },

    _onKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        let modifierType = Cinnamon.get_event_state(event);

        switch (symbol) {
            case Clutter.KEY_F4:
                if (modifierType == Clutter.ModifierType.MOD1_MASK)
                    this.close(true);
                break;

            case Clutter.KEY_Escape:
                if (this.searchbar.actor.text.length > 0) {
                    this.searchbar.actor.text = '';
                } else {
                    this.close(true);
                }

                return true;

            case Clutter.KP_Enter:
            case Clutter.KEY_Return:
            case Clutter.KEY_KP_Enter:
                if (this._modality == this.Modality.SEARCH_VIEW) {
                    this._searchView.launchSelected();
                    this.close(true);
                } else {
                    let keyFocus = global.stage.get_key_focus();
                    if (keyFocus._delegate && keyFocus._delegate instanceof AppEntry)
                        keyFocus._delegate.launchApp();
                }
                return true;

            case Clutter.KEY_Alt_L:
            case Clutter.KEY_Alt_R:
                break;

            case Clutter.KEY_0:
            case Clutter.KEY_1:
            case Clutter.KEY_2:
            case Clutter.KEY_3:
            case Clutter.KEY_4:
            case Clutter.KEY_5:
            case Clutter.KEY_6:
            case Clutter.KEY_7:
            case Clutter.KEY_8:
            case Clutter.KEY_9:
                break;

            case Clutter.KEY_Tab:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this.viewSelector.selected = 1;
                    let newFocus = this._categoryView.appView.getChildAt(this._categoryColumnFocus, this._categoryRowFocus);
                    if (newFocus != null)
                        newFocus.grab_key_focus();
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    this.viewSelector.selected = 0;
                    let newFocus = this._gridView.getChildAt(this._columnFocus, this._rowFocus);
                    if (newFocus != null)
                        newFocus.grab_key_focus();
                }
                break;

            case Clutter.KEY_Left:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    if (modifierType == Clutter.ModifierType.SHIFT_MASK) // Shift + Left
                        this.pageSwitcher.setActive(this.pageSwitcher.active - 1);
                    else
                        this._normalMoveFocus(-1, 0);
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    if (modifierType == Clutter.ModifierType.SHIFT_MASK) // Shift + Left
                        this._categoryView.switcher.setActive(this._categoryView.switcher.active - 1);
                    else if (!this.searchbar.hasFocus()) {// the user has already selected an AppEntry
                        this._categoryMoveFocus(-1, 0);
                    }
                } else
                    return false;
                break;

            case Clutter.KEY_Right:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    if (modifierType == Clutter.ModifierType.SHIFT_MASK) // Shift + Right
                        this.pageSwitcher.setActive(this.pageSwitcher.active + 1);
                    else
                        this._normalMoveFocus(+1, 0);
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    if (modifierType == Clutter.ModifierType.SHIFT_MASK) // Shift + Right
                        this._categoryView.switcher.setActive(this._categoryView.switcher.active + 1);
                    else if (this.searchbar.hasFocus()) // there's no AppEntry selected, the user is switching category
                        this._topLeftFocus();
                    else // the user has already selected an AppEntry
                        this._categoryMoveFocus(+1, 0);
                } else {
                    return false;
                }
                break;

            case Clutter.KEY_Up:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this._normalMoveFocus(0, -1);
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    if (modifierType == Clutter.ModifierType.SHIFT_MASK) { // Shift + Up
                        if (this._categoryView.categorySwitcher.selected != 0) {
                            this._categoryView.categorySwitcher.selected--;
                            this._topLeftFocus();
                        }
                    } else if (this.searchbar.hasFocus()) {
                        this._categoryView.categorySwitcher.selected--;
                    } else {
                        this._categoryMoveFocus(0, -1);
                    }
                } else if (this._modality == this.Modality.SEARCH_VIEW) {
                    this._searchView.selected--;
                    this._searchViewUp();
                }
                break;

            case Clutter.KEY_Down:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this._normalMoveFocus(0, +1);
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    if (modifierType == Clutter.ModifierType.SHIFT_MASK) { // Shift + Down
                        this._categoryView.categorySwitcher.selected++;
                        this._topLeftFocus();
                    } else if (this.searchbar.hasFocus()) {
                        this._categoryView.categorySwitcher.selected++;
                    } else { // the user has already selected an AppEntry
                        this._categoryMoveFocus(0, +1);
                    }
                } else if (this._modality == this.Modality.SEARCH_VIEW) {
                    this._searchView.selected++;
                    if (this._searchView.selected > 7)
                        this._searchViewDown();
                }
                break;

            case Clutter.KEY_Page_Up:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this.pageSwitcher.setActive(this.pageSwitcher.active - 1);
                    if (this.pageSwitcher.active != 0) // we don't wanna lose focus if we don't actually change page
                        this.searchbar.grabFocus(); // this is because otherwise focus isn't the current page
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    this._categoryView.categorySwitcher.selected--;
                    this._topLeftFocus();
                }
                break;

            case Clutter.KEY_Page_Down:
                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this.pageSwitcher.setActive(this.pageSwitcher.active + 1);
                    if (this.pageSwitcher.active != this._gridView.getNPages() - 1) // we don't wanna lose focus if we don't actually change page
                        this.searchbar.grabFocus(); //this is because otherwise focus isn't the current page
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    this._categoryView.categorySwitcher.selected++;
                    this._topLeftFocus();
                }
                break;

            case Clutter.KEY_BackSpace:
                if (modifierType == Clutter.ModifierType.SHIFT_MASK) { // Shift + Delete
                    this.searchbar.actor.text = "";
                } else if (this.searchbar.hasFocus()) {
                    return false;
                } else {
                    this.searchbar.grabFocus();
                    this.searchbar.actor.clutter_text.set_cursor_position(this.searchbar.actor.text.length);
                    return false;
                }
                break;

            case Clutter.KEY_Home:
                if (this.searchbar.actor.text.size > 0) {
                    return false;
                }

                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this.pageSwitcher.setActive(0);
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    this._categoryView.categorySwitcher.selected = 0;
                    this._topLeftFocus();
                }
                break;

            case Clutter.KEY_End:
                if (this.searchbar.actor.text.size > 0) {
                    return false;
                }

                if (this._modality == this.Modality.NORMAL_VIEW) {
                    this.pageSwitcher.setActive(this._gridView.getNPages() - 1);
                } else if (this._modality == this.Modality.CATEGORY_VIEW) {
                    this._categoryView.categorySwitcher.selected = this._categoryView.categorySwitcher.catSize - 1;
                    this._topLeftFocus();
                }
                break;

            default:
                if (!this.searchbar.hasFocus()) {
                    this.searchbar.grabFocus();
                    this.searchbar.actor.clutter_text.set_cursor_position(this.searchbar.actor.text.length);
                }
                return false;
        }

        return true;
    },

    _onScrollEvent: function(actor, event) {

        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
                if (this._modality == this.Modality.NORMAL_VIEW)
                    this.pageSwitcher.setActive(this.pageSwitcher.active - 1);
                else if (this._modality == this.Modality.SEARCH_VIEW)
                    this._searchViewUp();
                else
                    this._categoryView.switcher.setActive(this._categoryView.switcher.active - 1);
                break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
                if (this._modality == this.Modality.NORMAL_VIEW)
                    this.pageSwitcher.setActive(this.pageSwitcher.active + 1);
                else if (this._modality == this.Modality.SEARCH_VIEW)
                    this._searchViewDown();
                else
                    this._categoryView.switcher.setActive(this._categoryView.switcher.active + 1);
                break;
        }
    },

    showSlingshot: function() {

        this.open(true);

        this.searchbar.actor.text = '';
        this.searchbar.grabFocus();
        this._setModality(this.viewSelector.selected);
    },

    _movePage: function(step) {

        if (step == 0)
            return;
        if (step < 0 && this._currentPosition >= 0)
            return;
        if (step > 0 && (-this._currentPosition) >= ((this._gridView.getNPages() - 1) * this._gridView.getPageColumns() * 130))
            return;

        let count = 0;
        let increment = -step * 130 * this.columns / 10;
        Mainloop.timeout_add(30 / this.columns, Lang.bind(this, function() {

            if (count >= 10) {
                this._currentPosition += -step * 130 * this.columns - 10 * increment;
                this._gridView.actor.set_x(this._currentPosition);
                return false;
            }

            this._currentPosition += increment;
            this._gridView.actor.set_x(this._currentPosition);
            count++;
            return true;
        }));
    },

    _searchViewDown: function() {

        if (this._searchView.appsShowed < this._defaultRows * 3)
            return;

        if ((this._searchViewPosition) > -(this._searchView.appsShowed * 48)) {
            this._searchView.actor.set_y(this._searchViewPosition - 2 * 38);
            this._searchViewPosition -= 2 * 38;
        }
    },

    _searchViewUp: function() {

        if (this._searchViewPosition < 0) {
            this._searchView.actor.set_y(this._searchViewPosition + 2 * 38);
            this._searchViewPosition += 2 * 38;
        }
    },

    _setModality: function(newModality) {

        this._modality = newModality;

        switch (this._modality) {
            case this.Modality.NORMAL_VIEW:

                if (Slingshot.useCategory)
                    Slingshot.useCategory = false;
                this.bottom.show();
                this.viewSelector.actor.show();
                this.pageSwitcher.actor.show();
                this._categoryView.showPageSwitcher(false);
                this._searchView.actor.hide();
                this._categoryView.actor.hide();
                this._gridView.actor.show();

                // change the paddings/margins back to normal
                //get_content_area().set_margin_left(PADDINGS.left + SHADOW_SIZE + 5);
                this.box.set_style('padding-left: 5px');
                this.center.set_margin_left(12);
                this.top.set_margin_left(12);
                this.viewManager.set_size(this._defaultColumns * 130, this._defaultRows * 145);
                break;

            case this.Modality.CATEGORY_VIEW:

                if (!Slingshot.useCategory)
                    Slingshot.useCategory = true;
                this.bottom.show();
                this.viewSelector.actor.show();
                this.pageSwitcher.actor.hide();
                this._categoryView.showPageSwitcher(true);
                this._gridView.actor.hide();
                this._searchView.actor.hide();
                this._categoryView.actor.show();

                // remove the padding/margin on the left
                //get_content_area().set_margin_left(PADDINGS.left + SHADOW_SIZE);
                this.box.set_style('padding-left: 0px');
                this.center.set_margin_left(0);
                this.top.set_margin_left(17);
                this.viewManager.set_size(this._defaultColumns * 130 + 17, this._defaultRows * 145);
                break;

            case this.Modality.SEARCH_VIEW:

                this.viewSelector.actor.hide();
                this.bottom.hide(); // Hide the switcher
                this._gridView.actor.hide();
                this._categoryView.actor.hide();
                this._searchView.actor.show();

                // change the paddings/margins back to normal
                //get_content_area().set_margin_left(PADDINGS.left + SHADOW_SIZE + 5);
                this.box.set_style('padding-left: 5px');
                this.center.set_margin_left(12);
                this.top.set_margin_left(12);
                this.viewManager.set_size(this._defaultColumns * 130, this._defaultRows * 145);
                break;
        }
    },

    _search: function(text) {

        let stripped = text.toLowerCase().trim();

        if (stripped == '') {
            this._setModality(this.viewSelector.selected);
            return;
        }

        if (this._modality != this.Modality.SEARCH_VIEW)
            this._setModality(this.Modality.SEARCH_VIEW);
        this._searchViewPosition = 0;
        this._searchView.actor.set_position(0, this._searchViewPosition);
        this._searchView.hideAll();

        let filtered = this.appSystem.searchResults(stripped);

        filtered.forEach(function(app) {
            this._searchView.showApp(app);
        }, this);

        this._searchView.addCommand(text);
    },

    populateGridView: function() {

        this.pageSwitcher.clearChildren();
        this._gridView.clear();

        this.pageSwitcher.append('1');
        this.pageSwitcher.setActive(0);

        this.appSystem.getAppsByName().forEach(function(app, index) {
            let appEntry = new AppEntry(app);
            appEntry.connect('app-launched', Lang.bind(this, function() {
                this.close(true);
            }));
            this._gridView.append(appEntry.actor);
        }, this);

        this._gridView.actor.show();
        this._gridView.actor.set_x(0);
        this._currentPosition = 0;
    },

    _readSettings: function(firstStart, checkColumns, checkRows) {

        if (checkColumns == null)
            checkColumns = true;
        if (checkRows == null)
            checkRows = true;

        if (checkColumns) {
            if (Slingshot.columns > 3)
                this._defaultColumns = Slingshot.columns;
            else
                this._defaultColumns = Slingshot.columns = 4;
            global.log("Cols: " + Slingshot.columns);
        }

        if (checkRows) {
            if (Slingshot.rows > 1)
                this._defaultRows = Slingshot.rows;
            else
                this._defaultRows = Slingshot.rows = 2;
            global.log("Rows: " + this._defaultRows);
        }

        if (!firstStart) {
            this._gridView.resize(this._defaultRows, this._defaultColumns);
            this.populateGridView();
            this.box.set_height(this._defaultRows * 145 + 140);

            this._categoryView.appView.resize(this._defaultRows, this._defaultColumns);
            this._categoryView.actor.set_size(this.columns * 130 + 17, this.viewHeight);
            this._categoryView.showFilteredApps(this._categoryView.categoryIds[this._categoryView.categorySwitcher.selected]);
        }
    },

    _normalMoveFocus: function(deltaColumn, deltaRow) {
        if (global.stage.get_key_focus()._delegate instanceof AppEntry) { // we check if any AppEntry has focus. If it does, we move
            let newFocus = this._gridView.getChildAt(this._columnFocus + deltaColumn, this._rowFocus + deltaRow); // we check if the new widget exists
            if (newFocus == null) {
                if (deltaColumn <= 0)
                    return;
                else {
                    newFocus = this._gridView.getChildAt(this._columnFocus + deltaColumn, 0);
                    deltaRow = -this._rowFocus; // so it's 0 at the end
                    if (newFocus == null)
                        return;
                }
            }
            this._columnFocus += deltaColumn;
            this._rowFocus += deltaRow;
            if (deltaColumn > 0 && this._columnFocus % this._gridView.getPageColumns() == 0 ) //check if we need to change page
                this.pageSwitcher.setActive(this.pageSwitcher.active + 1);
            else if (deltaColumn < 0 && (this._columnFocus + 1) % this._gridView.getPageColumns() == 0) //check if we need to change page
                this.pageSwitcher.setActive(this.pageSwitcher.active - 1);
            newFocus.grab_key_focus();
        }
        else { // we move to the first app in the top left corner of the current page
            this._gridView.getChildAt(this.pageSwitcher.active * this._gridView.getPageColumns(), 0).grab_key_focus();
            this._columnFocus = this.pageSwitcher.active * this._gridView.getPageColumns();
            this._rowFocus = 0;
        }
    },

    _categoryMoveFocus: function(deltaColumn, deltaRow) {
        try {
            let newFocus = this._categoryView.appView.getChildAt(this._categoryColumnFocus + deltaColumn, this._categoryRowFocus + deltaRow);
            if (newFocus == null) {
                if (deltaRow < 0 && this._categoryView.categorySwitcher.selected != 0) {
                    global.log('Switching to previous category...');
                    this._categoryView.categorySwitcher.selected--;
                    this._topLeftFocus();
                    return;
                }
                else if (deltaRow > 0 && this._categoryView.categorySwitcher.selected != this._categoryView.categorySwitcher.catSize - 1) {
                    global.log('Switching to next category...');
                    this._categoryView.categorySwitcher.selected++;
                    this._topLeftFocus();
                    return;
                }
                else if (deltaColumn > 0 && (this._categoryColumnFocus + deltaColumn) % this._categoryView.appView.getPageColumns() == 0
                          && this._categoryView.switcher.active + 1 != this._categoryView.appView.getNPages()) {
                    this._categoryView.switcher.setActive(this._categoryView.switcher.active + 1);
                    this._topLeftFocus();
                    return;
                }
                else if (this._categoryColumnFocus == 0 && deltaColumn < 0) {
                    this.searchbar.grabFocus();
                    this._categoryColumnFocus = 0;
                    this._categoryRowFocus = 0;
                    return;
                }
                else
                    return;
            }
            this._categoryColumnFocus += deltaColumn;
            this._categoryRowFocus += deltaRow;
            if (deltaColumn > 0 && this._categoryColumnFocus % this._categoryView.appView.getPageColumns() == 0 ) { // check if we need to change page
                this._categoryView.switcher.setActive(this._categoryView.switcher.active + 1);
            }
            else if (deltaColumn < 0 && (this._categoryColumnFocus + 1) % this._categoryView.appView.getPageColumns() == 0) {
                // check if we need to change page
                this._categoryView.switcher.setActive(this._categoryView.switcher.active - 1);
            }
            newFocus.grab_key_focus();
        } catch(e) {
            global.logError(e);
        }
    },

    // this method moves focus to the first AppEntry in the top left corner of the current page. Works in CategoryView only
    _topLeftFocus: function() {
        // this is the first column of the current page
        let firstColumn = this._categoryView.switcher.active * this._categoryView.appView.getPageColumns();
        this._categoryView.appView.getChildAt(firstColumn, 0).grab_key_focus();
        this._categoryColumnFocus = firstColumn;
        this._categoryRowFocus = 0;
    },

    resetCategoryFocus: function() {
        this._categoryColumnFocus = 0;
        this._categoryRowFocus = 0;
        this.searchbar.grabFocus(); // So we don't loose focus
    },

    get columns() {
        return this._gridView.getPageColumns();
    },

    get rows() {
        return this._gridView.getPageRows();
    },

    get viewHeight() {
        return (this.rows * 130 + this.rows * this._gridView.rowSpacing + 35);
    }
}
Signals.addSignalMethods(SlingshotView.prototype);

/** Slingshot *****************************************************************/

var Slingshot = {

    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.settings = new Settings.AppletSettings(this, 'slingshot@jfarthing84', instanceId);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'slingshot-icon-size', 'iconSize');
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'slingshot-columns', 'columns', Lang.bind(this, function() {
                this._view._readSettings(false, true, false);
            }));
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'slingshot-rows', 'rows', Lang.bind(this, function() {
                this._view._readSettings(false, false, true);
            }));
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'slingshot-use-category', 'useCategory');
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, 'slingshot-screen-resolution', 'screenResolution');

            this.settings.bindProperty(Settings.BindingDirection.IN, 'menu-icon-custom', 'menuIconCustom', this._updateIconAndLabel);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'menu-icon', 'menuIcon', this._updateIconAndLabel);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'menu-label', 'menuLabel', this._updateIconAndLabel);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'overlay-key', 'overlayKey', this._updateKeybinding);

            this._updateKeybinding();

            Main.themeManager.connect('theme-set', Lang.bind(this, this._updateIconAndLabel));
            this._updateIconAndLabel();

            this._view = new SlingshotView(this, orientation);
            this._view.box.add_style_class_name('slingshot');

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menuManager.addMenu(this._view);

        } catch (e) {
            global.logError(e);
        }
    },

    _set_default_menu_icon: function() {
        let path = global.datadir + "/theme/menu.svg";
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_path(path);
            return;
        }

        path = global.datadir + "/theme/menu-symbolic.svg";
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_symbolic_path(path);
            return;
        }
        /* If all else fails, this will yield no icon */
        this.set_applet_icon_path("");
    },

    _updateIconAndLabel: function(){
        try {
            if (this.menuIconCustom) {
                if (this.menuIcon == "") {
                    this.set_applet_icon_name("");
                } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
                    if (this.menuIcon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_path(this.menuIcon);
                    else
                        this.set_applet_icon_path(this.menuIcon);
                } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
                    if (this.menuIcon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.menuIcon);
                    else
                        this.set_applet_icon_name(this.menuIcon);
                }
            } else {
                this._set_default_menu_icon();
            }
        } catch(e) {
           global.logWarning("Could not load icon file \""+this.menuIcon+"\" for menu button");
        }

        if (this.menuIconCustom && this.menuIcon == "") {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.menuLabel != "")
            this.set_applet_label(_(this.menuLabel));
        else
            this.set_applet_label("");
    },

    _updateKeybinding: function() {
        Main.keybindingManager.addHotKey("overlay-key", this.overlayKey, Lang.bind(this, function() {
            if (!Main.overview.visible && !Main.expo.visible)
                this.on_applet_clicked();
        }));
    },

    _launch_editor: function() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    },

    on_applet_clicked: function(event) {
        if (this._view.isOpen)
            this._view.close(true);
        else
            this._view.showSlingshot();
    },

    destroy: function() {
        this.actor._delegate = null;
        this._view.destroy();
        this.actor.destroy();
        this.emit('destroy');
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    Slingshot._init(orientation, panelHeight, instanceId);
    return Slingshot;
}
