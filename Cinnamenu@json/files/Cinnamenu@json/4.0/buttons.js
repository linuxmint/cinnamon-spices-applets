const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const {AppState} = imports.gi.Cinnamon;
const {EllipsizeMode} = imports.gi.Pango;
const XApp = imports.gi.XApp;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const {PopupBaseMenuItem, PopupMenu, PopupSeparatorMenuItem} = imports.ui.popupMenu;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;
const {getUserDesktopDir, changeModeGFile} = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const {spawnCommandLine, spawn, unref} = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const ApplicationsViewModeLIST = 0, ApplicationsViewModeGRID = 1;
const {SEARCH_DEBUG, _, APPTYPE, tryFn, wordWrap, showTooltip, hideTooltip} = require('./utils');
const {MODABLE, MODED} = require('./emoji');
const PlacementTOOLTIP = 1, PlacementUNDER = 2, PlacementNONE = 3;
const SHOW_SEARCH_MARKUP_IN_TOOLTIP = true;
const USER_DESKTOP_PATH = getUserDesktopDir();

class CategoryButton extends PopupBaseMenuItem {
    constructor(appThis, dir, altNameText, altIconName) {
        super({ hover: false, activate: false });
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.actor.set_style_class_name('menu-category-button');
        this.disabled = false;
        this.entered = null;
        let iconName;
        let isStrDir = typeof dir === 'string';
        if (isStrDir) {
            this.id = dir;
            this.categoryNameText = altNameText;
            iconName = altIconName;
        } else {
            this.id = altNameText;
            const dirName = dir.get_name();
            this.categoryNameText = dirName ? dirName : '';
            //
            let icon = dir.get_icon();
            if (icon) {
                if (icon.names) {
                    iconName = icon.names[0];
                }
                if (!iconName && icon.get_names) {
                    iconName = icon.get_names()[0];
                }
            }
            if (!iconName) {
                iconName = 'folder';
            }
        }
        this.icon = new St.Icon({   icon_name: iconName, icon_type: St.IconType.FULLCOLOR,
                                    icon_size: this.appThis.settings.categoryIconSize});
        if (this.appThis.settings.categoryIconSize > 0) {
            this.addActor(this.icon);
        }

        this.label = new St.Label({ text: this.categoryNameText,
                                    style_class: 'menu-category-button-label' });
        this.addActor(this.label);
        this.label.realize();

        //?undo
        this.actor._delegate = {
                handleDragOver: (source /*, actor, x, y, time */) => {
                        if (!source.categoryNameText || source.categoryNameText === this.categoryNameText) {
                            return DragMotionResult.NO_DROP;
                        }
                        this.resetAllCategoriesOpacity();
                        this.actor.set_opacity(50);
                        return DragMotionResult.MOVE_DROP; },
                acceptDrop: (source /*, actor, x, y, time */) => {
                        if (!source.categoryNameText || source.categoryNameText === this.categoryNameText) {
                            this.resetAllCategoriesOpacity();
                            return DragMotionResult.NO_DROP;
                        }
                        //move category to new position
                        let categories = this.appThis.settings.categories.slice();
                        const oldIndex = categories.indexOf(source.id);
                        const newIndex = categories.indexOf(this.id);
                        categories.splice(oldIndex, 1);
                        this.appThis.settings.categories = categories.slice(0, newIndex).concat(
                                                            [source.id]).concat(categories.slice(newIndex));
                        this.resetAllCategoriesOpacity();
                        this.appThis.categories.update();
                        this.appThis.categoriesView.populate();
                        this.appThis.setActiveCategory(this.appThis.currentCategory);
                        return true; },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                isDraggableApp: false,
                categoryNameText: this.categoryNameText,
                id: this.id };

        this.draggable = makeDraggable(this.actor);

        // Connect signals
        this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
        this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
        this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
        //?undo
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        //Allow motion-event to trigger handleEnter because previous enter-event may have been
        //invalidated by this.appThis.badAngle === true when this is no longer the case.
        this.signals.connect(this.actor, 'motion-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
    }

    setHighlight(on) {
        if (on) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
    }

    onDragBegin() {
        this.actor.set_opacity(51);
    }

    onDragCancelled() {
        this.actor.set_opacity(255);
    }

    onDragEnd() {
        this.resetAllCategoriesOpacity();
    }

    selectCategory() {
        if (this.appThis.settings.categoryClick) {
            this.actor.set_style(null);//undo fixes applied in handleEnter();
        }
        this.appThis.setActiveCategory(this.id);
    }

    handleEnter(actor, event) {
        //this method handles enter-event, motion-event and keypress
        if (this.entered || this.disabled || this.appThis.contextMenu.isOpen ||
                            this.appThis.badAngle && event && !this.appThis.settings.categoryClick) {
            return Clutter.EVENT_PROPAGATE;
        }
        if (event) {//mouse
            this.appThis.clearEnteredActors();
        } else {//keypress
            this.appThis.scrollToButton(this, true);
        }

        this.entered = true;
        if (this.appThis.settings.categoryClick) {
            if (this.id != this.appThis.currentCategory) {
                this.actor.set_style_class_name('menu-category-button-hover');
                //Also use menu-category-button-selected as menu-category-button-hover not defined in most themes
                this.actor.add_style_class_name('menu-category-button-selected');
                //some style tweaks for menu-category-button-hover class.
                let themePath = Main.getThemeStylesheet();
                if (!themePath) themePath = 'Cinnamon default';
                [['/Mint-Y/',           'background-color: #d8d8d8; color: black;'],
                ['/Mint-Y-Dark/',       'background-color: #404040;'],
                ['/Mint-X/',            'background-color: #d4d4d4; color: black; border-image: none;'],
                ['/Pragmatic-Darker-Blue/','background-color: #383838;'],
                ['/Faded-Dream/',       'background-color: rgba(255,255,255,0.25);'],
                ['/Linux Mint/',        'box-shadow: none; background-gradient-end: rgba(90, 90, 90, 0.5);'],
                ['Cinnamon default',    'background-gradient-start: rgba(255,255,255,0.03); background-gradient-end: rgba(255,255,255,0.03);'],
                ['/Adapta-Nokto/',      'background-color: rgba(207, 216, 220, 0.12); color: #CFD8DC'],
                ['/Eleganse/',          'background-gradient-start: rgba(255,255,255,0.08); box-shadow: none;'],
                ['/Eleganse-dark/',     'background-gradient-start: rgba(255,255,255,0.08); box-shadow: none;'],
                ['/Adapta/',            'color: #263238; background-color: rgba(38, 50, 56, 0.12)'],
                ['/Adapta-Maia/',       'color: #263238; background-color: rgba(38, 50, 56, 0.12)'],
                ['/Adapta-Nokto-Maia/', 'color: #CFD8DC; background-color: rgba(207, 216, 220, 0.12);'],
                ['Cinnamox-',           'background-color: rgba(255,255,255,0.2);']
                ].forEach(fix => {
                    if (themePath.includes(fix[0])) {
                        this.actor.set_style(fix[1]);
                    }
                });
            }
            return Clutter.EVENT_STOP;
        } else {
            global.log('selectCategory');
            this.selectCategory();
            return Clutter.EVENT_STOP;
        }
    }

    handleLeave(actor, event) {
        if (this.disabled || this.appThis.contextMenu.isOpen) {
            return false;
        }
        this.entered = null;
        if ((!event || this.appThis.settings.categoryClick) && this.appThis.currentCategory !== this.id) {
            if (this.id != this.appThis.currentCategory) {
                this.actor.set_style_class_name('menu-category-button');
            } else {
                this.actor.set_style_class_name('menu-category-button-selected');
            }
            this.actor.set_style(null);//undo fixes applied in handleEnter();
        }
    }

    handleButtonRelease(actor, event) {
        if (this.disabled) {
            return;
        }
        if (this.appThis.contextMenu.isOpen) {
            this.appThis.contextMenu.close();
            return Clutter.EVENT_STOP;
        }
        const button = event.get_button();
        if (button === 1 && this.appThis.settings.categoryClick) {
            this.selectCategory();
            return Clutter.EVENT_STOP;
        } else if (button === 3) {
            if (this.actor.has_style_class_name('menu-category-button-hover')) {
                this.handleLeave();
            }
            this.openContextMenu(event);
            return Clutter.EVENT_STOP;
        }
    }

    openContextMenu(e) {
        this.appThis.contextMenu.open(this.id, e, this, true);
    }

    disable() {
        if (this.actor.has_style_class_name('menu-category-button-greyed')) {
            return false;
        }

        this.actor.set_style_class_name('menu-category-button-greyed');
        this.disabled = true;
        this.entered = null;
    }

    enable() {
        this.actor.set_style_class_name('menu-category-button');
        this.disabled = false;
    }

    resetAllCategoriesOpacity() {
        this.appThis.categories.buttons.forEach( (button) => button.actor.set_opacity(255) );
    }

    destroy() {
        this.signals.disconnectAllSignals();
        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        PopupBaseMenuItem.prototype.destroy.call(this);
        unref(this);
    }
}

class ContextMenuItem extends PopupBaseMenuItem {
    constructor(appThis, label, iconName, action) {
        super({focusOnHover: false});
        this.appThis = appThis;
        if (iconName) {
            const icon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: iconName,
                                                                icon_type: St.IconType.SYMBOLIC});
            this.addActor(icon, {span: 0});
        }
        this.addActor(new St.Label({text: label}));

        this.signals = new SignalManager(null);
        this.action = action;
        if (this.action === null) {
            this.actor.style = "font-weight: bold;";
        }
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    }

    handleEnter(actor, e) {
        if (this.action === null) {
            return Clutter.EVENT_STOP;
        }
        this.entered = true;
        this.actor.add_style_pseudo_class('hover');// Should be 'hover' only, add 'active' for
        this.actor.add_style_pseudo_class('active');//compatability with existing themes
        return Clutter.EVENT_STOP;//true;
    }

    handleLeave(actor, e) {
        this.entered = null;
        this.actor.remove_style_pseudo_class('hover');
        this.actor.remove_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    activate(event) {
        if (!this.action || event && event.get_button() !== 1) {
            return false;
        }
        this.action();
        return false;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        PopupBaseMenuItem.prototype.destroy.call(this);
        unref(this);
    }
}

class ContextMenu {
    constructor(appThis) {
        this.appThis = appThis;
        this.menu = new PopupMenu(this.appThis.actor /*,St.Side.TOP*/);
        this.menu.actor.hide();
        this.contextMenuBox = new St.BoxLayout({ style_class: '', vertical: true, reactive: true });
        this.contextMenuBox.add_actor(this.menu.actor);
        //Note: The context menu is not fully model. Instead, it is added to the stage by adding it to
        //mainBox with it's height set to 0. contextMenuBox is then positioned at mouse coords and above
        //siblings. The context menu is not fully model because then it would be difficult to close both
        //the context menu and the applet menu when the user clicks outside of both.
        this.contextMenuBox.height = 0;
        this.appThis.mainBox.add(this.contextMenuBox, {expand: false, x_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE,});
        this.contextMenuButtons = [];
        this.isOpen = false;
    }

    open(app, e, button, isACategoryButton = false) {
        //e is used to position context menu at mouse coords. If keypress opens menu then
        // e is undefined and button position is used instead.
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = [];

        if (isACategoryButton) {
            const addMenuItem = (item) => {
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            addMenuItem( new ContextMenuItem(this.appThis, _('Reset category order'), null,
                                () => { this.appThis.settings.categories = [];
                                        this.appThis.categories.update();
                                        this.appThis.categoriesView.populate();
                                        this.close(); } ));
        } else if (app.type === APPTYPE.application) {
            this.populateContextMenu_apps(app);
        } else if (app.type === APPTYPE.file && !app.isBackButton) {
            if (!this.populateContextMenu_files(app)) {
                return;
            }
        } else if (app.type == APPTYPE.provider && app.emoji) {
            if (!MODABLE.includes(app.emoji)) {
                return;
            }
            const addMenuItem = (char, text) => {
                const i = MODABLE.indexOf(app.emoji);//Find if emoji is in list of emoji that can have
                                                     //skin tone modifiers.
                let newEmoji = MODED[i].replace('\u{1F3FB}', char); //replace light skin tone character in
                                                                    // MODED[i] with skin tone chosen by user.
                newEmoji = newEmoji.replace('\u{1F3FB}', char);
                const item = new ContextMenuItem(this.appThis, newEmoji + ' ' + text, null,
                                        () => { const clipboard = St.Clipboard.get_default();
                                                clipboard.set_text(St.ClipboardType.CLIPBOARD, newEmoji);
                                                this.appThis.closeMenu(); } );
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            addMenuItem('\u{1F3FB}', 'light skin tone');
            addMenuItem('\u{1F3FC}', 'medium-light skin tone');
            addMenuItem('\u{1F3FD}', 'medium skin tone');
            addMenuItem('\u{1F3FE}', 'medium-dark skin tone');
            addMenuItem('\u{1F3FF}', 'dark skin tone');
        } else {
            return;
        }

        this.isOpen = true;
        this.appThis.resizer.inhibit_resizing = true;

        const contextMenuWidth = this.menu.actor.width;
        const contextMenuHeight = this.menu.actor.height;

        const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
        let mx, my;
        if (e) {
            [mx, my] = e.get_coords(); //get mouse position
        } else {//activated by keypress, no e supplied
            [mx, my] = button.actor.get_transformed_position();
            mx += 20;
            my += 20;
        }
        if (mx > monitor.x + monitor.width - this.menu.actor.width) {
            mx -= this.menu.actor.width;
        }
        if (my > monitor.y + monitor.height - this.menu.actor.height - 40/*allow for panel*/) {
            my -= this.menu.actor.height;
        }
        //setting anchor_x & anchor_y sets it relative to it's current position but negative???
        let [cx, cy] = this.contextMenuBox.get_transformed_position();
        cx = Math.round(mx - cx);
        cy = Math.round(my - cy);

        this.menu.actor.anchor_x = -cx;
        this.menu.actor.anchor_y = -cy;

        this.menu.toggle_with_options(this.appThis.settings.enableAnimation);
        return;
    }

    populateContextMenu_apps(app) { //add items to context menu of type: application
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };
        if (this.appThis.gpu_offload_supported) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Run with NVIDIA GPU'), 'cpu',
                                () => { try {
                                            app.launch_offloaded(0, [], -1);
                                        } catch (e) {
                                            logError(e, 'Could not launch app with dedicated gpu: ');
                                        }
                                        this.appThis.closeMenu(); } ));
        } else if (this.appThis.isBumblebeeInstalled) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Run with NVIDIA GPU'), 'cpu',
                                () => { spawnCommandLine('optirun gtk-launch ' + app.get_id());
                                        this.appThis.closeMenu(); } ));
        }
        addMenuItem( new ContextMenuItem(this.appThis, _('Add to panel'), 'list-add',
            () => {
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    const new_applet_id = global.settings.get_int('next-applet-id');
                    global.settings.set_int('next-applet-id', (new_applet_id + 1));
                    const enabled_applets = global.settings.get_strv('enabled-applets');
                    enabled_applets.push('panel1:right:0:panel-launchers@cinnamon.org:' + new_applet_id);
                    global.settings.set_strv('enabled-applets', enabled_applets);
                }
                const launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                if (launcherApplet) {
                    launcherApplet.acceptNewLauncher(app.get_id());
                }
                this.close(); } ));
        if (USER_DESKTOP_PATH) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to desktop'), 'computer',
                () => { const file = Gio.file_new_for_path(app.get_app_info().get_filename());
                        const destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + file.get_basename());
                        tryFn(() => {
                            file.copy( destFile, 0, null, null);
                            changeModeGFile(destFile, 755);
                        }, (e) => {
                            global.log(e);
                        });
                        this.close(); } ));
        }
        if (this.appThis.appFavorites.isFavorite(app.get_id())) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                                            () => { this.appThis.appFavorites.removeFavorite(app.get_id());
                                                    this.close(); } ));
        } else {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                                        () => { this.appThis.appFavorites.addFavorite(app.get_id());
                                                this.close(); } ));
        }
    }

    populateContextMenu_files(app) {
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };
        const hasLocalPath = (file) => (file.is_native() && file.get_path() != null);
        const file = Gio.File.new_for_uri(app.uri);
        const fileExists = GLib.file_test(file.get_path(), GLib.FileTest.EXISTS);
        if (!fileExists && !app.isFavoriteFile) {
            Main.notify(_("This file is no longer available"),'');
            return false; //no context menu
        }
        //
        if (fileExists) {
            addMenuItem( new ContextMenuItem(this.appThis, _("Open with"), null, null ));
            const defaultInfo = Gio.AppInfo.get_default_for_type(app.mimeType, !hasLocalPath(file));
            if (defaultInfo) {
                addMenuItem( new ContextMenuItem(   this.appThis, defaultInfo.get_display_name(), null,
                                                    () => { defaultInfo.launch([file], null);
                                                            this.appThis.closeMenu(); } ));
            }
            Gio.AppInfo.get_all_for_type(app.mimeType).forEach(info => {
                if (!hasLocalPath(file) || !info.supports_uris() || info.equal(defaultInfo)) {
                    return;
                }
                addMenuItem( new ContextMenuItem(   this.appThis, info.get_display_name(), null,
                                                    () => { info.launch([file], null);
                                                            this.appThis.closeMenu(); } ));
            });
            addMenuItem( new ContextMenuItem(   this.appThis, _('Other application...'), null,
                                                () => { spawnCommandLine("nemo-open-with " + app.uri);
                                                        this.appThis.closeMenu(); } ));
        }

        const favs = XApp.Favorites ? XApp.Favorites.get_default() : null;
        if (favs) {//prior to cinnamon 4.8, XApp favorites are not available
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
            if (favs.find_by_uri(app.uri)) { //favorite
                addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                                                        () => { favs.remove(app.uri);
                                                                this.appThis.updateAfterFavFileChange();
                                                                this.close(); } ));
            } else {
                addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                        () =>   {   favs.add(app.uri);
                                    //favs list doesn't update synchronously after adding fav so add small
                                    //delay before updating menu
                                    Mainloop.timeout_add(100, () => { this.appThis.updateAfterFavFileChange(); });
                                    this.close();
                                } ));
            }
        }
        const folder = file.get_parent();
        if (app.isRecentFile || app.isFavoriteFile) { //not a browser folder/file
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
            addMenuItem( new ContextMenuItem(   this.appThis, _('Open containing folder'), 'go-jump',
                        () => { const fileBrowser = Gio.AppInfo.get_default_for_type('inode/directory', true);
                                fileBrowser.launch([folder], null);
                                this.appThis.closeMenu(); } ));
        }
        if (!app.isFavoriteFile) {
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
            addMenuItem( new ContextMenuItem(   this.appThis, _('Move to trash'), 'user-trash',
                        () => { const file = Gio.File.new_for_uri(app.uri);
                                try {
                                    file.trash(null);
                                } catch (e) {
                                    Main.notify(_("Error while moving file to trash:"),e.message);
                                }
                                this.appThis.sidebar.populate();
                                this.appThis.updateMenuWidth();
                                this.appThis.updateMenuHeight();
                                this.appThis.setActiveCategory(this.appThis.currentCategory);
                                this.close(); } ));
        }
        return true; //success.
    }

    close() {
        this.menu.close();
        this.isOpen = false;
        this.appThis.resizer.inhibit_resizing = false;
    }

    destroy() {
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = null;
        //this.menu.destroy(); //causes errors in .xsession-errors??
        this.contextMenuBox.destroy();
    }
}

class AppButton extends PopupBaseMenuItem {
    constructor(appThis, app) {
        super({ hover: false, activate: false });
        this.appThis = appThis;
        this.app = app;
        const isListView = this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST;
        this.setButtonStyle(false);//normal style (not slected)
        this.actor.x_align = isListView ? St.Align.START : St.Align.MIDDLE;
        this.actor.y_align = St.Align.MIDDLE;
        if (!isListView) {
            //remove l/r padding in grid view to allow maximum space for label
            this.actor.set_style('padding-left: 0px; padding-right: 0px;');
            this.setButtonWidth();
        }
        this.signals = new SignalManager(null);
        this.entered = null;
        //----------ICON---------------------------------------------
        //create icon even if iconSize is 0 so dnd has something to drag
        if (this.app.icon) { //APPTYPE.place or APPTYPE.provider //instanceof St.Icon
            this.icon = this.app.icon;
        } else if (this.app.gicon) { //APPTYPE.file or APPTYPE.place
            this.icon = new St.Icon({ gicon: this.app.gicon, icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.emoji) {
            const iconLabel = new St.Label({ style_class: '', style: 'color: white; font-size: ' +
                                            (Math.round(this.appThis.getAppIconSize() * 0.85)) + 'px;'});
            iconLabel.get_clutter_text().set_markup(this.app.emoji);
            this.icon = iconLabel;
        } else if (this.app.type === APPTYPE.application) {
            this.icon = this.app.create_icon_texture(this.appThis.getAppIconSize());
        } else if (this.app.isBackButton) {
            this.icon = new St.Icon({ icon_name: 'edit-undo-symbolic', icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.type === APPTYPE.clearlist_button) {
            this.icon = new St.Icon({   icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC,
                                        icon_size: this.appThis.getAppIconSize()});
        }
        if (!this.icon) {
            this.icon = new St.Icon({icon_name: 'dialog-error', icon_size: this.appThis.getAppIconSize()});
        }
        //--------Label------------------------------------
        this.label = new St.Label({ style_class: 'menu-application-button-label',
                                    style: 'padding-right: 2px; padding-left: 2px;'});
        if (!isListView && this.appThis.settings.descriptionPlacement === PlacementUNDER) {
            this.label.set_style('text-align: center;');
        }
        this.formatLabel();
        this.iconContainer = new St.BoxLayout();
        if (this.icon && this.appThis.getAppIconSize() > 0) {
            this.iconContainer.add(this.icon, { x_fill: false, y_fill: false,
                                                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }
        this.dot = new St.Widget({ //app running indicator
                style: isListView ?
                'width: 2px; height: 12px; background-color: ' + this.appThis.getThemeForegroundColor() +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;' :
                'width: 32px; height: 2px; background-color: ' + this.appThis.getThemeForegroundColor() +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;',
                layout_manager: new Clutter.BinLayout(),
                x_expand: false,
                y_expand: false});
        //-------------------buttonBox-------------------------
        this.buttonBox = new St.BoxLayout({ vertical: !isListView, y_expand: false });
        if (!isListView) {
            this.buttonBox.width = 600;//bigger than needed to ensure it centers in it's grid space
        }
        this.buttonBox.add(this.iconContainer, {
                                x_fill: false, y_fill: false,
                                x_align: isListView ? St.Align.START : St.Align.MIDDLE,
                                y_align: St.Align.MIDDLE});
        this.buttonBox.add(this.dot, {  x_fill: false, y_fill: false,
                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.buttonBox.add(this.label, {
                                x_fill: false, y_fill: false,
                                x_align: isListView ? St.Align.START : St.Align.MIDDLE,
                                y_align: St.Align.MIDDLE});
        this.addActor(this.buttonBox);
        if (this.icon) {
            this.icon.realize();
        }
        //----------dnd--------------
        if (this.app.type === APPTYPE.application) {
            this.actor._delegate = {
                    handleDragOver: (source) => {
                            if (source.isDraggableApp && source.get_app_id() !== this.app.get_id() &&
                                                            this.appThis.currentCategory === 'favorite_apps') {
                                this.resetAllAppsOpacity();
                                this.actor.set_opacity(40);
                                return DragMotionResult.MOVE_DROP;
                            }
                            return DragMotionResult.NO_DROP; },
                    handleDragOut: () => {  this.actor.set_opacity(255); },
                    acceptDrop: (source) => {
                            if (source.isDraggableApp && source.get_app_id() !== this.app.get_id() &&
                                                            this.appThis.currentCategory === 'favorite_apps') {
                                this.actor.set_opacity(255);
                                this.appThis.addFavoriteAppToPos(source.get_app_id(), this.app.get_id());
                                return true;
                            } else {
                                this.actor.set_opacity(255);
                                return DragMotionResult.NO_DROP;
                            } },
                    getDragActorSource: () => this.actor,
                    _getDragActor: () => new Clutter.Clone({source: this.actor}),
                    getDragActor: () => new Clutter.Clone({source: this.icon}),
                    get_app_id: () => this.app.get_id(),
                    isDraggableApp: this.app.type === APPTYPE.application
            };

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
            this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
            this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
        }

        //----running state
        this.dot.opacity = 0;
        if (this.app.type === APPTYPE.application) {
            this.signals.connect(this.app, 'notify::state', (...args) => this.onStateChanged(...args));
            this.onStateChanged();
        }

        this.signals.connect(this.actor, 'button-press-event', (...args) => this.handleButtonPress(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    }

    setButtonStyle(selected) {
        if (selected) {
            this.actor.set_style_class_name('menu-application-button-selected');
        } else {
            this.actor.set_style_class_name('menu-application-button');
        }
    }

    onDragBegin() {
        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
    }

    onDragCancelled() {
    }

    onDragEnd() {
        this.resetAllAppsOpacity();
    }

    formatLabel() {
        let name = this.app.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let description = this.app.description ?
                            this.app.description.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';

        if (this.app.newAppShouldHighlight) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
        let markup = '<span>' + name + '</span>';
        if (this.appThis.settings.descriptionPlacement === PlacementUNDER && description) {
            markup += '\n<span size="small">' + description + '</span>';
        }
        const clutterText = this.label.get_clutter_text();
        clutterText.set_markup(markup);
        /*if (this.app.type === APPTYPE.file && !description) {
            clutterText.set_line_wrap(true);
            clutterText.set_line_wrap_mode(2);//WORD_CHAR
            const lines = clutterText.get_layout().get_lines();
            global.log(clutterText.get_text());
        } else {*/
            clutterText.ellipsize = EllipsizeMode.END;
        //}
    }

    setButtonWidth() {
        //set width of grid button
        this.actor.width = this.appThis.getGridValues().columnWidth;
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen ) {
            return false;
        }

        if (event) {
            this.appThis.clearEnteredActors();
        } else {
            this.appThis.scrollToButton(this);
        }

        this.entered = true;
        this.setButtonStyle(true);//selected style

        if (this.appThis.settings.descriptionPlacement === PlacementTOOLTIP) {
            let tooltipMarkup = '<span>' + wordWrap((this.app.nameWithSearchMarkup &&
                                            SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.appThis.searchActive) ?
                                            this.app.nameWithSearchMarkup : this.app.name) + '</span>';
            if (this.app.description) {
                tooltipMarkup += '\n<span size="small">' + wordWrap((this.app.descriptionWithSearchMarkup &&
                                    SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.appThis.searchActive) ?
                                    this.app.descriptionWithSearchMarkup : this.app.description) + '</span>';
            }
            if (SEARCH_DEBUG) {
                if (SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.app.keywordsWithSearchMarkup &&
                                                                                this.appThis.searchActive) {
                    tooltipMarkup += '\n<span size="small">' +
                                                wordWrap(this.app.keywordsWithSearchMarkup) + '</span>';
                }
                if (SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.app.idWithSearchMarkup && this.appThis.searchActive) {
                    tooltipMarkup += '\n<span size="small">' + wordWrap(this.app.idWithSearchMarkup) + '</span>';
                }
            }
            tooltipMarkup = tooltipMarkup.replace(/&/g, '&amp;');
            let [x, y] = this.actor.get_transformed_position();
            let {width, height} = this.actor;
            let center_x = false; //should tooltip x pos. be centered on x
            if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                x += 175 * global.ui_scale;
                y += height + 8 * global.ui_scale;
            } else {//grid view
                x += Math.floor(width / 2);
                y += height + 8 * global.ui_scale;
                center_x = true;
            }
            if (!this.tooltipVisible) { //handleEnter may have been called twice, once with key nav and again
                                        //with mouse. in which case, don't create new tooltip
                showTooltip(this.actor, x, y, center_x, tooltipMarkup);
                this.tooltipVisible = true;
            }
        }
        return false;
    }

    handleLeave(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            return false;
        }

        this.entered = null;
        this.setButtonStyle(false);//normal style (not selected)
        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
    }

    handleButtonPress() {
    }

    handleButtonRelease(actor, e) {
        const button = e.get_button();
        if (button === 1) {//left click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.clearEnteredActors();
                this.handleEnter();
            } else {
                this.activate(e);
            }
            return Clutter.EVENT_STOP;
        } else if (button === 3) {//right click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.clearEnteredActors();
                this.handleEnter();
                return Clutter.EVENT_STOP;
            } else {
                if (this.app.type == APPTYPE.application || this.app.type == APPTYPE.file || this.app.emoji ){
                    this.openContextMenu(e);
                }
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.app.type === APPTYPE.application) {
            if (this.app.newAppShouldHighlight) {
                this.app.newAppShouldHighlight = false;
                this.formatLabel();
            }
            this.app.open_new_window(-1);
            this.appThis.closeMenu();
        } else if (this.app.type === APPTYPE.place) {
            if (this.app.uri) {
                this.app.app.launch_uris([this.app.uri], null);
            } else {
                this.app.launch();
            }
            this.appThis.closeMenu();
        } else if (this.app.type === APPTYPE.file) {
            if (this.app.isDirectory) {//broswer view
                this.appThis.setActiveCategory(Gio.File.new_for_uri(this.app.uri).get_path());
            } else {
                try {
                    Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                    this.appThis.closeMenu();
                } catch (e) {
                    Main.notify(_("This file is no longer available"),e.message);
                    //don't closeMenu
                }
            }
        } else if (this.app.type === APPTYPE.clearlist_button) {
            Gtk.RecentManager.get_default().purge_items();
            this.appThis.recentsJustCleared = true;
            this.appThis.setActiveCategory('recents');
            //don't closeMenu
        } else if (this.app.type === APPTYPE.provider) {
            this.app.activate(this.app);
            this.appThis.closeMenu();
        }
    }

    onStateChanged() {
        if (!this.app || this.dot.is_finalized()) {
            return false;
        }
        if (this.app.type === APPTYPE.application) {
            this.dot.opacity = this.app.state !== AppState.STOPPED ? 255 : 0;
        }
        return true;
    }

    openContextMenu(e) {
        this.setButtonStyle(true);//selected style
        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
        this.appThis.contextMenu.open(this.app, e, this);
    }

    resetAllAppsOpacity() {
        this.appThis.appsView.getActiveContainer().get_children().forEach( child => child.set_opacity(255) );
    }

    destroy(skipDestroy) {
        this.signals.disconnectAllSignals();

        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
        if (!skipDestroy) {
            this.dot.destroy();
            this.label.destroy();
            if (this.icon) {
                this.icon.destroy();
            }
            if (this.iconContainer) {
                this.iconContainer.destroy();
            }
            this.buttonBox.destroy();
        }
        PopupBaseMenuItem.prototype.destroy.call(this);
        //unref(this);
    }
}

class SidebarButton extends PopupBaseMenuItem {
    constructor(appThis, icon, app, name, description, callback) {
        super({ hover: false, activate: false });
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.app = app;
        this.name = name;
        this.description = description;
        this.callback = callback;
        this.actor.set_style_class_name('menu-favorites-button');
        this.entered = null;
        if (icon) {
            this.icon = icon;
            this.addActor(this.icon);
            this.icon.realize();
        }

        if (this.app && this.app.type === APPTYPE.application) { //----------dnd--------------
            this.actor._delegate = {
                    handleDragOver: (source) => {
                            if (source.isDraggableApp === true && source.get_app_id() !== this.app.get_id()) {
                                this.actor.set_opacity(40);
                                return DragMotionResult.MOVE_DROP;
                            }
                            return DragMotionResult.NO_DROP; },
                    handleDragOut: () => { this.actor.set_opacity(255); },
                    acceptDrop: (source) => {
                            if (source.isDraggableApp === true && source.get_app_id() !== this.app.get_id()) {
                                this.actor.set_opacity(255);
                                this.appThis.addFavoriteAppToPos(source.get_app_id(), this.app.get_id());
                                return true;
                            } else {
                                this.actor.set_opacity(255);
                                return DragMotionResult.NO_DROP;
                            } },
                    getDragActorSource: () => this.actor,
                    _getDragActor: () => new Clutter.Clone({source: this.actor}),
                    getDragActor: () => new Clutter.Clone({source: this.icon}),
                    get_app_id: () => this.app.get_id(),
                    isDraggableApp: true
            };

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
            //this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
            //this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
        }

        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
    }

    onDragBegin() {
        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
    }

    handleButtonRelease(actor, e) {
        const button = e.get_button();
        if (button === 1) {//left click
            if (this.appThis.contextMenu.isOpen) {
                //if (this.menuIsOpen && this.menu._activeMenuItem) {
                //    this.menu._activeMenuItem.activate();
                this.appThis.contextMenu.close();
                this.appThis.clearEnteredActors();
                this.handleEnter();
            } else {
                this.activate();
            }
            return Clutter.EVENT_STOP;
        } else if (button === 3) {//right click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.contextMenu.close();
                this.appThis.clearEnteredActors();
                this.handleEnter();
            } else {
                if (this.app != null) {
                    this.openContextMenu(e);
                }
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.callback) {
            this.callback();
        } else if (this.app.type === APPTYPE.application) {
            this.app.newAppShouldHighlight = false;
            this.app.open_new_window(-1);
            this.appThis.closeMenu();
        } else if (this.app.type === APPTYPE.file) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.appThis.closeMenu();
            } catch (e) {
                Main.notify(_("This file is no longer available"),e.message);
            }
        }
    }

    openContextMenu(e) {
        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
        this.appThis.contextMenu.open(this.app, e, this);
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            return true;
        }

        if (event) {
            this.appThis.clearEnteredActors();
        } else {
            this.appThis.scrollToButton(this);
        }

        this.entered = true;
        if (!this.actor) return;
        this.actor.add_style_pseudo_class('hover');

        //show tooltip
        let [x, y] = this.actor.get_transformed_position();
        x += this.actor.width + 2 * global.ui_scale;
        y += this.actor.height + 6 * global.ui_scale;
        let text = `<span>${this.name}</span>`;
        if (this.description) {
            text += '\n<span size="small">' + wordWrap(this.description) + '</span>';
        }
        text = text.replace(/&/g, '&amp;');
        showTooltip(this.actor, x, y, false /*don't center x*/, text);
        this.tooltipVisible = true;
        return true;
    }

    handleLeave() {
        if (this.appThis.contextMenu.isOpen) {
            return true;
        }
        this.entered = null;
        this.actor.remove_style_pseudo_class('hover');
        if (this.tooltipVisible) {
            hideTooltip();
            this.tooltipVisible = false;
        }
        return true;
    }

    destroy() {
        this.signals.disconnectAllSignals();

        if (this.icon) {
            this.icon.destroy();
        }

        super.destroy();
        unref(this);
    }
}

module.exports = {CategoryButton, AppButton, ContextMenu, SidebarButton};
