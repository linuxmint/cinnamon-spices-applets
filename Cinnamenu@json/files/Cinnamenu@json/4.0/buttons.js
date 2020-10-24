const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const {AppState} = imports.gi.Cinnamon;
const {EllipsizeMode} = imports.gi.Pango;
const Main = imports.ui.main;
const {PopupBaseMenuItem, PopupSubMenu, PopupIconMenuItem} = imports.ui.popupMenu;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;
const {getUserDesktopDir, changeModeGFile} = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const {spawnCommandLine, spawn, unref} = imports.misc.util;
const MessageTray = imports.ui.messageTray;

const {SEARCH_DEBUG, _, APPTYPE, tryFn, showTooltip, hideTooltip} = require('./utils');
const PlacementTOOLTIP = 1, PlacementUNDER = 2, PlacementNONE = 3;
const SHOW_SEARCH_MARKUP_IN_TOOLTIP = true;
const USER_DESKTOP_PATH = getUserDesktopDir();
const CAN_UNINSTALL = GLib.file_test('/usr/bin/cinnamon-remove-application', GLib.FileTest.EXISTS);

class CategoryListButton extends PopupBaseMenuItem {
    constructor(appThis, dir, altNameText, altIconNames/*array of names*/) {
        super({ hover: false, activate: false });
        this.appThis = appThis;
        this.signals = new SignalManager(null);

        this.index = -1;
        let isStrDir = typeof dir === 'string';
        let dirName = !isStrDir ? dir.get_name() : null;
        this.id = typeof dir === 'string' || dir instanceof String ? dir : altNameText;
        let categoryNameText = isStrDir ? altNameText : dirName ? dirName : '';
        this.disabled = false;
        this.entered = null;

        if (!isStrDir) {
            let icon = dir.get_icon();
            let iconName;
            if (icon && icon.get_names) {
                iconName = icon.get_names().toString();
            } else {
                iconName = '';
            }
            if (iconName) {
                this.icon = St.TextureCache.get_default().load_gicon(null, icon,
                                                                this.appThis.settings.categoryIconSize);
            } else {
                icon = dir.get_icon() && typeof dir.get_icon().get_names === 'function' ?
                                                    dir.get_icon().get_names().toString() : 'error';
                this.icon = new St.Icon({   icon_name: icon,
                                            icon_size: this.appThis.settings.categoryIconSize});
            }
        } else {
            this.icon = new St.Icon({   gicon: Gio.ThemedIcon.new_from_names(altIconNames),
                                        icon_size: this.appThis.settings.categoryIconSize,
                                        icon_type: St.IconType.FULLCOLOR });
        }
        if (this.appThis.settings.categoryIconSize > 0) {
            this.addActor(this.icon);
        }


        this.categoryNameText = categoryNameText;
        this.label = new St.Label({ text: this.categoryNameText,
                                    style_class: 'menu-category-button-label' });
        this.addActor(this.label);
        this.label.realize();

        //?undo
        this.actor._delegate = {
                handleDragOver: (source /*, actor, x, y, time */) => {
                        if (!source.index || source.index === this.index) {
                                return DragMotionResult.NO_DROP;
                        }
                        this.appThis.resetCategoryOpacity();
                        this.actor.set_opacity(50);
                        return DragMotionResult.MOVE_DROP; },
                acceptDrop: (source /*, actor, x, y, time */) => {
                        if (!source.index || source.index === this.index) {
                            this.appThis.resetCategoryOpacity();
                            return DragMotionResult.NO_DROP;
                        }
                        this.appThis.moveCategoryToPos(source.id, this.id);
                        return true; },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                isDraggableApp: false,
                index: this.index,
                id: this.id };

        this.draggable = makeDraggable(this.actor);

        // Connect signals
        this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
        this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
        this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
        //?undo

        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
    }

    onDragBegin() {
        this.actor.set_opacity(51);
        //this.appThis.categoryDragged = true;
    }

    onDragCancelled() {
        this.actor.set_opacity(255);
        //this.appThis.categoryDragged = false;
    }

    onDragEnd() {
        this.appThis.resetCategoryOpacity();
        //this.actor.set_opacity(255);
        //setTimeout(() => { this.appThis.categoryDragged = false; }, 0);
    }

    selectCategory() {
        if (this.disabled) {
            return false;
        }
        if (this.id) {
            this.appThis.setActiveCategory(this.id);
        }
    }

    handleEnter(actor, event) {
        if (this.disabled) {
            return Clutter.EVENT_STOP;
        }

        if (event) {//?undo
            this.appThis.clearEnteredActors();
        } else {
            this.appThis.scrollToButton(this, true);
        }

        //this.appThis.scrollToButton(this, true);

        this.entered = true;
        if (this.appThis.settings.categoryClick) {
            if (this.id != this.appThis.currentCategory) {
                this.actor.set_style_class_name('menu-category-button-selected menu-category-button-hover');
            }
            return Clutter.EVENT_STOP;
        } else {
            this.selectCategory();
            return Clutter.EVENT_STOP;
        }
    }

    handleLeave(actor, event) {
        if (this.disabled) {
            return false;
        }
        this.entered = null;
        if ((!event || this.appThis.settings.categoryClick) && this.appThis.currentCategory !== this.id) {
            if (this.id != this.appThis.currentCategory) {
                this.actor.set_style_class_name('menu-category-button');
            } else {
                this.actor.set_style_class_name('menu-category-button-selected');
            }
        }
    }

    handleButtonRelease(actor, event) {
        if (this.disabled || (event && event.get_button() > 1) || !this.appThis.settings.categoryClick) {
            return;
        }
        this.selectCategory();
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

    _onKeyFocusIn() {
        this.appThis.setKeyFocus();//set key focus on search entry.
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

class ContextMenuItem extends PopupIconMenuItem {
    constructor(appThis, label, iconName, action) {
        super(label, iconName, St.IconType.SYMBOLIC, {focusOnHover: false});

        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.action = action;

        if (this.action == null) {
            this.actor.style = "font-weight: bold";
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

    _onKeyFocusIn() {
        this.appThis.setKeyFocus();
    }

    activate(event) {
        if (!this.action) {
            return false;
        }
        if (event && event.get_button() === 3) {
            global.log("activatecontextmenuitem with event?");
            /*this.buttonState.trigger('toggleMenu');
            return false;*/
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
        this.menu = new PopupSubMenu(this.appThis.actor);
        this.menu.actor.set_style_class_name('menu menu-context-menu menu-background starkmenu-background');
        this.contextMenuBox = new St.BoxLayout({ style_class: '', vertical: true, reactive: true });
        this.contextMenuBox.add_actor(this.menu.actor);
        this.contextMenuBox.height = 0;
        appThis.mainBox.add(this.contextMenuBox, {expand: false, x_fill: false,
                                                x_align: St.Align.START, y_align: St.Align.MIDDLE});
        this.contextMenuButtons = [];
        this.isOpen = false;
    }

    open(app, e) {
        for (let i = 0; i < this.contextMenuButtons.length; i++) {
            this.contextMenuButtons[i].destroy();
            this.contextMenuButtons[i] = null;
        }
        this.contextMenuButtons = [];


        if (app.type == APPTYPE._applications) {
            this.addAppItems(app);
        } else if (app.type == APPTYPE._recent) {
            if (!GLib.file_test(Gio.File.new_for_uri(app.uri).get_path(), GLib.FileTest.EXISTS)) {
                Main.notify(_("This file is no longer available"),'');
                return;
            }
            const addMenuItem = (item) => {
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            const hasLocalPath = (file) => (file.is_native() && file.get_path() != null);
            //
            addMenuItem( new ContextMenuItem(this.appThis, _("Open with"), null, null ));
            const file = Gio.File.new_for_uri(app.uri);
            const defaultInfo = Gio.AppInfo.get_default_for_type(app.mimeType, !hasLocalPath(file));
            if (defaultInfo) {
                addMenuItem( new ContextMenuItem(   this.appThis, defaultInfo.get_display_name(), null,
                                                    () => { defaultInfo.launch([file], null);
                                                            this.appThis.closeMenu(); } ));
            }
            //
            const infos = Gio.AppInfo.get_all_for_type(app.mimeType);
            for (let i = 0; i < infos.length; i++) {
                const info = infos[i];
                //const file = Gio.File.new_for_uri(app.uri);
                if (!hasLocalPath(file) || !info.supports_uris() || info.equal(defaultInfo)) {
                    continue;
                }
                addMenuItem( new ContextMenuItem(   this.appThis, info.get_display_name(), null,
                                                    () => { info.launch([file], null);
                                                            this.appThis.closeMenu(); } ));
            }
            //
            addMenuItem( new ContextMenuItem(   this.appThis, _('Other application...'), null,
                                                () => { spawnCommandLine("nemo-open-with " + app.uri);
                                                        this.appThis.closeMenu(); } ));
        }

        this.isOpen = true;

        const contextMenuWidth = this.menu.actor.width;
        const contextMenuHeight = this.menu.actor.height;

        const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
        let [mx, my] = e.get_coords(); //get mouse position
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

    addAppItems(app) { //add items to context menu of type: application
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
                Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER)
                                                                            .acceptNewLauncher(app.get_id());
                this.close(); } ));
        if (USER_DESKTOP_PATH) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to desktop'), 'computer',
                () => { const destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + app.get_id());
                        tryFn(() => {
                            Gio.file_new_for_path(app.get_app_info().get_filename())
                                .copy(  Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + app.get_id()), 0, null, null);
                            changeModeGFile(destFile, 755);
                        }, function(e) {
                            global.log(e);
                        });
                        this.close(); } ));
        }
        if (this.appThis.appFavorites.isFavorite(app.get_id())) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                                            () => { this.appThis.appFavorites.removeFavorite(app.get_id()); } ));
        } else {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                                        () => { this.appThis.appFavorites.addFavorite(app.get_id()); } ));
        }
        if (CAN_UNINSTALL) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Uninstall'), 'edit-delete',
                        () => { spawnCommandLine('/usr/bin/cinnamon-remove-application \'' +
                                                                app.get_app_info().get_filename() + '\'');
                                this.appThis.closeMenu();} ));
        }
    }

    close() {
        /*if (this.isOpen) {
            this.menu.toggle_with_options(this.appThis.settings.enableAnimation);
        }*/
        this.menu.close();
        this.isOpen = false;
    }

    destroy() {
        return true;
    }
}

class AppListGridButton extends PopupBaseMenuItem {
    constructor(appThis, app, appIndex) {
        super({ hover: false, activate: false });
        this.appThis = appThis;
        this.buttonState = {    app: app,
                                appType: app.type,
                                appIndex: appIndex,
                                column: -1};

        this.actor.set_style_class_name('menu-application-button');
        if (!this.appThis.isListView) {
            this.actor.set_style('padding-left: 0px; padding-right: 0px;');
        }
        this.actor.x_align = this.appThis.isListView ? St.Align.START : St.Align.MIDDLE;
        this.actor.y_align = St.Align.MIDDLE;

        if (!this.appThis.isListView) {
            this.actor.width = this.appThis.appsView.applicationsGridBox.width /
                                                                this.appThis.settings.appsGridColumnCount;
        }

        // DND
        this.actor._delegate = {
                handleDragOver: (source /*, actor, x, y, time */) => {
                        if (typeof source.appIndex === 'undefined' || source.appIndex < 0 ||
                                                        source.appIndex === this.buttonState.appIndex ||
                                                            this.appThis.currentCategory !== 'favorites') {
                            return DragMotionResult.NO_DROP;
                        }
                        this.appThis.dragIndex = this.buttonState.appIndex;
                        // TODO: We need to set a real placeholder, but to do so, the actor must be attached
                        // to applicationsGridBox, or inserted into applicationsListBox.
                        this.appThis.resetOpacity();
                        this.actor.set_opacity(50);
                        return DragMotionResult.MOVE_DROP; },
                acceptDrop: (source /*, actor, x, y, time */) => {
                        if (source.appIndex < 0 || source.appIndex === this.buttonState.appIndex ||
                                                        this.appThis.currentCategory !== 'favorites') {
                            this.appThis.resetOpacity();
                            this.appThis.dragIndex = -1;
                            return DragMotionResult.NO_DROP;
                        }
                        this.appThis.moveFavoriteToPos(source.get_app_id(), this.buttonState.appIndex);
                        return true; },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                get_app_id: () => this.buttonState.app.get_id(),
                appIndex: this.buttonState.appIndex
        };

        this.signals = new SignalManager(null);
        this.entered = null;

        // Icons //create icon even if iconSize is 0 so dnd has something to drag
        if (this.buttonState.appType === APPTYPE._applications) {
            this.icon = this.buttonState.app.create_icon_texture(this.appThis.getIconSize());
        } else if (this.buttonState.appType === APPTYPE._places) {
            let iconObj = { icon_size: this.appThis.getIconSize() };
            if (this.file) {
                iconObj.icon_name = this.buttonState.app.icon === undefined ? 'unknown' : 'folder';
                iconObj.icon_type = St.IconType.FULLCOLOR;
            } else {
                iconObj.gicon = this.buttonState.app.icon;
            }
            this.icon = new St.Icon(iconObj);
        } else if (this.buttonState.appType === APPTYPE._recent) {
            if (this.buttonState.app.clearList) {
                this.icon = new St.Icon({   icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC,
                                            icon_size: this.appThis.getIconSize()});
            } else {
                this.icon = new St.Icon({ gicon: this.buttonState.app.icon, icon_size: this.appThis.getIconSize()});
            }
        } else if (this.buttonState.appType === APPTYPE._providers) {
            this.icon = this.buttonState.app.icon;
        }
        if (!this.icon) {
            this.icon = new St.Icon({   icon_name: 'error',
                                        icon_size: this.appThis.getIconSize(),
                                        icon_type: St.IconType.FULLCOLOR});
        }

        this.label = new St.Label({ style_class: 'menu-application-button-label',
                                    style: 'padding-right: 2px; padding-left: 2px;'});
        if (!this.appThis.isListView && this.appThis.settings.descriptionPlacement === PlacementUNDER) {
            this.label.set_style('text-align: center;');
        }
        this.formatLabel();
        this.dot = new St.Widget({
                style: this.appThis.isListView ?
                'width: 2px; height: 12px; background-color: ' + this.appThis.theme.foregroundColor +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;' :
                'width: 32px; height: 2px; background-color: ' + this.appThis.theme.foregroundColor +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;',
                layout_manager: new Clutter.BinLayout(),
                x_expand: false,
                y_expand: false});
        this.iconContainer = new St.BoxLayout();
        if (this.icon && this.appThis.getIconSize() > 0) {
            this.iconContainer.add(this.icon, { x_fill: false, y_fill: false,
                                                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
        }

        this.buttonBox = new St.BoxLayout({ vertical: !this.appThis.isListView, y_expand: false });
        if (!this.appThis.isListView) {
            this.buttonBox.width = 600;//bigger than needed to ensure it centers in it's grid space
        } else {
            this.buttonBox.width = this.appThis.appBoxWidth - 30;//omitting this causes list scrolling to slow down
        }
        this.buttonBox.add(this.iconContainer, {
                                x_fill: false, y_fill: false,
                                x_align: this.appThis.isListView ? St.Align.START : St.Align.MIDDLE,
                                y_align: St.Align.MIDDLE});
        this.buttonBox.add(this.dot, {  x_fill: false, y_fill: false,
                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.buttonBox.add(this.label, {
                                x_fill: false, y_fill: false,
                                x_align: this.appThis.isListView ? St.Align.START : St.Align.MIDDLE,
                                y_align: St.Align.MIDDLE});

        this.addActor(this.buttonBox);

        if (this.icon) {
            this.icon.realize();
        }

        // Connect signals
        if (this.buttonState.appType === APPTYPE._applications) {
            this.actor._delegate.isDraggableApp = true;
            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.buttonState.app, 'notify::state', (...args) => this.onStateChanged(...args));
            this.signals.connect(this.draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
            this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
            this.signals.connect(this.draggable, 'drag-end', (...args) => this.onDragEnd(...args));
        }

        // Check if running state
        this.dot.opacity = 0;
        this.onStateChanged();

        this.signals.connect(this.actor, 'button-press-event', (...args) => this.handleButtonPress(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        //this.signals.connect(this.actor, 'parent-set', (...args) => this.handleParentChange(...args));
    }

    onDragBegin() {
        this.actor.set_opacity(51);
        if (this.tooltip) {
            hideTooltip();
            this.tooltip = false;
        }
    }

    onDragCancelled() {
        this.appThis.resetOpacity();
        //this.actor.set_opacity(255);
    }

    onDragEnd() {
        this.appThis.resetOpacity();
        //this.actor.set_opacity(255);
    }

    handleParentChange() {
        this.formatLabel();
    }

    formatLabel() {
        let name = this.buttonState.app.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let description = this.buttonState.app.description ?
                            this.buttonState.app.description.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';

        if (this.buttonState.app.newAppShouldHighlight) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
        let markup = '<span>' + name + '</span>';
        if (this.appThis.settings.descriptionPlacement === PlacementUNDER) {
            markup += '\n<span size="small">' + description + '</span>';
        }
        const clutterText = this.label.get_clutter_text();
        clutterText.set_markup(markup);
        clutterText.ellipsize = EllipsizeMode.END;
    }

    _onKeyFocusIn() {
        this.appThis.setKeyFocus();
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen || this.appThis.dragIndex > -1) {
            return false;
        }

        if (event) {
            this.appThis.clearEnteredActors();
        } else {
            this.appThis.scrollToButton(this);
        }

        this.entered = true;
        this.actor.set_style_class_name('menu-application-button-selected');

        if (this.appThis.settings.descriptionPlacement === PlacementTOOLTIP) {
            const wordWrap = text => text.match( /.{1,80}(\s|$|-|=|\+)|\S+?(\s|$|-|=|\+)/g ).join('\n');
            let tooltipMarkup = '<span>' + wordWrap((this.buttonState.app.nameWithSearchMarkup &&
                                        SHOW_SEARCH_MARKUP_IN_TOOLTIP) ? this.buttonState.app.nameWithSearchMarkup :
                                        this.buttonState.app.name) + '</span>';
            if (this.buttonState.app.description) {
                tooltipMarkup += '\n<span size="small">' + wordWrap((this.buttonState.app.descriptionWithSearchMarkup &&
                                SHOW_SEARCH_MARKUP_IN_TOOLTIP) ? this.buttonState.app.descriptionWithSearchMarkup :
                                this.buttonState.app.description) + '</span>';
            }
            if (SEARCH_DEBUG) {
                if (SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.buttonState.app.keywordsWithSearchMarkup) {
                    tooltipMarkup += '\n<span size="small">' +
                                                wordWrap(this.buttonState.app.keywordsWithSearchMarkup) + '</span>';
                }
                if (SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.buttonState.app.idWithSearchMarkup) {
                    tooltipMarkup += '\n<span size="small">' + wordWrap(this.buttonState.app.idWithSearchMarkup) +
                                                                                                            '</span>';
                }
            }
            tooltipMarkup = tooltipMarkup.replace(/&/g, '&amp;');

            let [x, y] = this.actor.get_transformed_position();
            let {width, height} = this.actor;
            let center_x = false; //should tooltip x pos. be centered on x
            if (this.appThis.isListView) {
                x += 175 * global.ui_scale;
                y += height + 8 * global.ui_scale;
            } else {//grid view
                x += Math.floor(width / 2);
                y += height + 8 * global.ui_scale;
                center_x = true;
            }
            if (!this.tooltip) {/*handleEnter may have been called twice, once with key nav and again with mouse.
                                 *In which case, don't create new tooltip*/
                showTooltip(this.actor, x, y, center_x, tooltipMarkup);
                this.tooltip = true;
            }
        }
        return false;
    }

    handleLeave(actor, event) {
        if (this.appThis.contextMenu.isOpen || this.appThis.dragIndex > -1) {
            return false;
        }

        this.entered = null;
        this.actor.set_style_class_name('menu-application-button');
        if (this.tooltip) {
            hideTooltip();
            this.tooltip = false;
        }
    }

    handleButtonPress() {
        //this.appThis.categoryDragged = true;
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
                this.activate(e);
            }
            return Clutter.EVENT_STOP;
        } else if (button === 3) {//right click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.contextMenu.close();
                this.appThis.clearEnteredActors();
                this.handleEnter();
                return Clutter.EVENT_STOP;
            } else {
                if (this.buttonState.appType == APPTYPE._applications ||
                        this.buttonState.appType == APPTYPE._recent && !this.buttonState.app.clearList) {
                    if (this.tooltip) {
                        hideTooltip();
                        this.tooltip = false;
                    }
                    this.openContextMenu(e);
                }
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.file) {
            if (this.handler) {
                this.handler.launch([this.file], null);
            } else {
                tryFn(
                    () => spawn(['gvfs-open', this.buttonState.app.uri]),
                    () => global.logError('No handler available to open ' + this.buttonState.app.uri)
                );
            }
        } else if (this.buttonState.appType === APPTYPE._applications) {
            //this.appThis.state.autofavs.incrementApp(this.buttonState.app.get_id());
            this.buttonState.app.newAppShouldHighlight = false;
            this.buttonState.app.open_new_window(-1);
        } else if (this.buttonState.appType === APPTYPE._places) {
            if (this.buttonState.app.uri) {
                this.buttonState.app.app.launch_uris([this.buttonState.app.uri], null);
            } else {
                this.buttonState.app.launch();
            }
        } else if (this.buttonState.appType === APPTYPE._recent) {
            if (this.buttonState.app.clearList) {
                Gtk.RecentManager.get_default().purge_items();
                this.appThis.setActiveCategory('all');
                return;//don't closeMenu
            } else {
                try {
                    Gio.app_info_launch_default_for_uri(this.buttonState.app.uri, global.create_app_launch_context());
                } catch (e) {
                    Main.notify(_("This file is no longer available"),e.message);
                    return;//don't closeMenu
                }
            }
        } else if (this.buttonState.appType === APPTYPE._providers) {
            this.buttonState.app.activate(this.buttonState.app);
        }
        this.appThis.closeMenu();
    }

    onStateChanged() {
        if (!this.buttonState.app || this.dot.is_finalized()) {
            return false;
        }
        if (this.buttonState.appType === APPTYPE._applications) {
            this.dot.opacity = this.buttonState.app.state !== AppState.STOPPED ? 255 : 0;
        }
        return true;
    }

    openContextMenu(e) {
        this.actor.set_style_class_name('menu-application-button-selected');
        if (!this.actor.get_parent()) {
            return; // Favorite change ??
        }
        this.appThis.contextMenu.open(this.buttonState.app, e);
    }

    destroy(skipDestroy) {
        this.signals.disconnectAllSignals();

        if (this.tooltip) {
            hideTooltip();
            this.tooltip = false;
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
        unref(this);
    }
}

class GroupButton extends PopupBaseMenuItem {
    constructor(appThis, icon, app, name, description, callback) {
        super({ hover: false, activate: false });
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.app = app;
        this.name = name;
        this.description = description;
        this.callback = callback;

        //this.actor.style = 'padding-top: ' + (iconSize / 3) +
        //                                        'px;padding-bottom: ' + (iconSize / 3) + 'px;';
        this.actor.set_style_class_name('menu-favorites-button');
        this.entered = null;

        if (icon) {
            this.icon = icon;
            this.addActor(this.icon);
            this.icon.realize();
        }
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.handleButtonRelease(...args));
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
                if (this.callback) {
                    this.callback();
                }
            }
            return Clutter.EVENT_STOP;
        } else if (button === 3) {//right click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.contextMenu.close();
                this.appThis.clearEnteredActors();
                this.handleEnter();
            } else {
                if (this.app != null) {
                    if (this.tooltip) {
                        hideTooltip();
                        this.tooltip = false;
                    }
                    //this.actor.set_style_class_name('menu-application-button-selected');
                    this.appThis.contextMenu.open(this.app, e);
                }
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    handleEnter(actor) {
        if (this.appThis.contextMenu.isOpen || this.appThis.dragIndex > -1) {
            return true;
        }
        if (actor) {
            this.appThis.clearEnteredActors();
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
            text += '\n<span size="small">' + this.description + '</span>';
        }
        showTooltip(this.actor, x, y, false /*don't center x*/, text);
        this.tooltip = true;
        return true;
    }

    handleLeave() {
        if (this.appThis.contextMenu.isOpen || this.appThis.dragIndex > -1) {
            return true;
        }
        this.entered = null;
        this.actor.remove_style_pseudo_class('hover');
        if (this.tooltip) {
            hideTooltip();
            this.tooltip = false;
        }
        return true;
    }

    /*setIcon(iconName) {
        this.removeActor(this.icon);
        this.icon.destroy();
        this.icon = this.icon = new St.Icon({
            icon_name: iconName,
            icon_size: this.iconSize,
            icon_type: St.IconType.FULLCOLOR
        });
        this.addActor(this.icon);
        this.icon.realize();
    }*/

    destroy() {
        this.signals.disconnectAllSignals();

        if (this.icon) {
            this.icon.destroy();
        }

        super.destroy();
        unref(this);
    }
}

module.exports = {CategoryListButton, AppListGridButton, ContextMenu, GroupButton};
