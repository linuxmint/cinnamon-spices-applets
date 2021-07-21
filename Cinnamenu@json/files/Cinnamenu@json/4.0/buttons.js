const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
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
const {spawnCommandLine} = imports.misc.util;
const {addTween} = imports.ui.tweener;
const MessageTray = imports.ui.messageTray;
const ApplicationsViewModeLIST = 0, ApplicationsViewModeGRID = 1;
const {_, wordWrap, getThumbnail_gicon, showTooltip, hideTooltipIfVisible} = require('./utils');
const {MODABLE, MODED} = require('./emoji');
const PlacementTOOLTIP = 1, PlacementUNDER = 2, PlacementNONE = 3;

function scrollToButton(button, enableAnimation) {
    let scrollBox = button.actor.get_parent();
    let i = 0;
    while (!(scrollBox instanceof St.ScrollView)) {
        i++;
        scrollBox = scrollBox.get_parent();
    }

    const adjustment = scrollBox.vscroll.adjustment;
    let [value, lower, upper, stepIncrement, pageIncrement, pageSize] = adjustment.get_values();

    let offset = 0;
    const vfade = scrollBox.get_effect('fade');//this always seems to return null?
    if (vfade) {
        offset = vfade.vfade_offset;
    }

    const box = button.actor.get_allocation_box();
    const y1 = box.y1, y2 = box.y2;
    //global.log('value', value,' y1:',y1,' y2:',y2);
    const PADDING_ALLOWANCE = 20; //In case button parent(s) have padding meaning y1 won't go to 0
    if (y1 < value + offset) {
        if (y1 < PADDING_ALLOWANCE) {
            value = 0;
        } else {
            value = Math.max(0, y1 - offset);
        }
    } else if (y2 > value + pageSize - offset) {
        if (y2 > upper - offset - PADDING_ALLOWANCE) {
            value = upper - pageSize;
        } else {
            value = Math.min(upper, y2 + offset - pageSize);
        }
    } else {
        return false;
    }

    if (enableAnimation) {
        addTween(adjustment, {value: value, time: 0.1, transition: 'easeOutQuad'});
    } else {
        adjustment.set_value(value);
    }
}

class CategoryButton {
    constructor(appThis, category_id, category_name, icon_name, gicon) {
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.disabled = false;
        //Note: When option "Activate categories on click" is on, this.entered category is the one that
        //has keyboard focus or mouse hover and is not necessarily the same as the currently selected
        //category (this.appThis.currentCategory)
        this.entered = false;
        this.id = category_id;
        this.actor = new St.BoxLayout({ style_class: 'menu-category-button', reactive: true,
                                                                accessible_role: Atk.Role.MENU_ITEM});
        //----icon
        if (icon_name) {
            this.icon = new St.Icon({   icon_name: icon_name, icon_type: St.IconType.FULLCOLOR,
                                        icon_size: this.appThis.settings.categoryIconSize});
        } else {
            this.icon = new St.Icon({   gicon: gicon, icon_type: St.IconType.FULLCOLOR,
                                        icon_size: this.appThis.settings.categoryIconSize});
        }
        if (this.appThis.settings.categoryIconSize > 0) {
            this.actor.add(this.icon, {x_fill: false, y_fill: false, y_align: St.Align.MIDDLE});
        }
        //---label
        category_name = category_name ? category_name : '';//is this needed?
        this.label = new St.Label({ text: category_name, style_class: 'menu-category-button-label' });
        this.actor.add(this.label, {x_fill: false, y_fill: false, y_align: St.Align.MIDDLE});
        //---dnd
        this.actor._delegate = {
                handleDragOver: (source) => {
                        if (!source.isDraggableCategory || source.id === this.id || this.appThis.searchActive) {
                            return DragMotionResult.NO_DROP;
                        }
                        this._resetAllCategoriesOpacity();
                        this.actor.set_opacity(50);
                        return DragMotionResult.MOVE_DROP; },
                acceptDrop: (source) => {
                        if (!source.isDraggableCategory || source.id === this.id || this.appThis.searchActive) {
                            this._resetAllCategoriesOpacity();
                            return DragMotionResult.NO_DROP;
                        }
                        //move category to new position
                        let categories = this.appThis.settings.categories.slice();
                        const oldIndex = categories.indexOf(source.id);
                        const newIndex = categories.indexOf(this.id);
                        categories.splice(oldIndex, 1);
                        categories.splice(newIndex, 0, source.id);
                        this.appThis.settings.categories = categories;
                        this._resetAllCategoriesOpacity();
                        this.appThis.categoriesView.update();
                        this.appThis.setActiveCategory(this.appThis.currentCategory);
                        return true; },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                isDraggableCategory: true,
                id: this.id };

        this.draggable = makeDraggable(this.actor);

        // Connect signals
        this.signals.connect(this.draggable, 'drag-begin', () => this.actor.set_opacity(51));
        this.signals.connect(this.draggable, 'drag-cancelled', () => this.actor.set_opacity(255));
        this.signals.connect(this.draggable, 'drag-end', () => this._resetAllCategoriesOpacity());

        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        //Allow motion-event to trigger handleEnter because previous enter-event may have been
        //invalidated by this.appThis.badAngle === true when this is no longer the case.
        this.signals.connect(this.actor, 'motion-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this._handleButtonRelease(...args));
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

    setButtonStyleNormal() {
        this.actor.set_style_class_name('menu-category-button');
        this.actor.set_style(null);//undo fixes that may have been applied in _setButtonStyleHover();
    }

    setButtonStyleSelected() {
        this.actor.set_style_class_name('menu-category-button-selected');
        this.actor.set_style(null);//undo fixes that may have been applied in _setButtonStyleHover();
    }

    _setButtonStyleHover() {
        this.actor.set_style_class_name('menu-category-button-hover');
        //Also use menu-category-button-selected as menu-category-button-hover not defined in most themes
        this.actor.add_style_class_name('menu-category-button-selected');

        //-----some style tweaks for menu-category-button-hover class.-----
        let themePath = Main.getThemeStylesheet();
        if (!themePath) themePath = 'Cinnamon default';
        [
        ['/Mint-Y',             'background-color: #d8d8d8; color: black;'],//Mint-Y & Mint-Y-<color>
        ['/Mint-Y-Dark',        'background-color: #404040;'],//Mint-Y-Dark & Mint-Y-Dark-<color>
        ['/Mint-X/',            'background-color: #d4d4d4; color: black; border-image: none;'],
        ['/Mint-X-',            'background-color: #d4d4d4; color: black; border-image: none;'],//Mint-X-<color>
        ['/Mint-X-Dark',        ''],//undo previous '/Mint-X-' changes for '/Mint-X-Dark'
        ['/Linux Mint/',        'box-shadow: none; background-gradient-end: rgba(90, 90, 90, 0.5);'],
        ['Cinnamon default',    'background-gradient-start: rgba(255,255,255,0.03); ' +
                                                    'background-gradient-end: rgba(255,255,255,0.03);'],
        ['/Adapta-Maia/',       'color: #263238; background-color: rgba(38, 50, 56, 0.12)'],//Manjaro
        ['/Adapta-Nokto-Maia/', 'color: #CFD8DC; background-color: rgba(207, 216, 220, 0.12);'],//Manjaro default
        ['/Cinnamox-',          'background-color: rgba(255,255,255,0.2);'],//Cinnamox- themes
        ['/Dracula',            'background-color: #2d2f3d'],
        ['/Eleganse/',          'background-gradient-start: rgba(255,255,255,0.08); box-shadow: none;'],
        ['/Eleganse-dark/',     'background-gradient-start: rgba(255,255,255,0.08); box-shadow: none;'],
        ['/Matcha-',            'background-color: white;'],//other Matcha- and Matcha-light- themes
        ['/Matcha-dark-aliz',   'background-color: #2d2d2d;'],
        ['/Matcha-dark-azul',   'background-color: #2a2d36;'],
        ['/Matcha-dark-sea',    'background-color: #273136;'],
        ['/Matcha-dark-cold',   'background-color: #282b33;'],
        ['/Monternos/',         'color: rgb(70, 70, 70); background-color: rgb(201, 204, 238); ' +
                                                                                'border-image: none;'],
        ['/Vivaldi',            'background-color: rgba(50,50,50,1);'],//Vivaldi & Vivaldi-ZorinOS
        //Yaru are ubuntu cinnamon themes:
        ['/Yaru-Cinnamon-Light/','background-color: #d8d8d8; color: black;'],
        ['/Yaru-Cinnamon-Dark/','background-color: #404040;']
        ].forEach(fix => {
            if (themePath.includes(fix[0])) {
                this.actor.set_style(fix[1]);
            }
        });
    }

    _setButtonStyleGreyed() {
        this.actor.set_style_class_name('menu-category-button-greyed');
        this.actor.set_style(null);//undo fixes that may have been applied in _setButtonStyleHover();
    }

    selectCategory() {
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
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }

        this.entered = true;
        if (this.id === this.appThis.currentCategory) {//No need to select category as already selected
            return Clutter.EVENT_STOP;
        }
        if (this.appThis.settings.categoryClick) {
            this._setButtonStyleHover();
        } else {
            this.selectCategory();
        }
        return Clutter.EVENT_STOP;
    }

    handleLeave(actor, event) {
        if (this.disabled || this.appThis.contextMenu.isOpen) {
            return false;
        }
        this.entered = false;
        if ((!event || this.appThis.settings.categoryClick) && this.appThis.currentCategory !== this.id) {
            if (this.id !== this.appThis.currentCategory) {
                this.setButtonStyleNormal();
            } else {
                this.setButtonStyleSelected();
            }
        }
    }

    _handleButtonRelease(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            this.appThis.contextMenu.close();
            return Clutter.EVENT_STOP;
        }
        if (this.disabled) {
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
        this._setButtonStyleGreyed();
        this.disabled = true;
        this.entered = false;
    }

    enable() {
        this.setButtonStyleNormal();
        this.disabled = false;
    }

    _resetAllCategoriesOpacity() {
        this.appThis.categoriesView.buttons.forEach(button => button.actor.set_opacity(255));
    }

    destroy() {
        this.signals.disconnectAllSignals();
        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        this.actor.destroy();
    }
}

class ContextMenuItem extends PopupBaseMenuItem {
    constructor(appThis, label, iconName, action, insensitive = false) {
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
        if (this.action === null && !insensitive) {//"Open with" item
            this.actor.style = 'font-weight: bold;';
        } else if (insensitive) {//greyed out item
            this.actor.add_style_pseudo_class('insensitive');
        }
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    }

    handleEnter(actor, e) {
        if (this.action === null) {
            return Clutter.EVENT_STOP;
        }
        this.entered = true;
        this.actor.add_style_pseudo_class('hover');
        this.actor.add_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    handleLeave(actor, e) {
        this.entered = false;
        this.actor.remove_style_pseudo_class('hover');
        this.actor.remove_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    activate(event) {
        if (!this.action || event && event.get_button() !== 1) {
            return Clutter.EVENT_STOP;
        }
        this.action();
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        PopupBaseMenuItem.prototype.destroy.call(this);
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

        //------populate menu
        if (isACategoryButton) {
            const addMenuItem = (item) => {
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            addMenuItem( new ContextMenuItem(this.appThis, _('Reset category order'), null,
                                () => { this.appThis.settings.categories = [];
                                        this.appThis.categoriesView.update();
                                        this.close(); } ));
        } else if (app.isApplication) {
            this._populateContextMenu_apps(app);
        } else if (app.isFolderviewFile || app.isFolderviewDirectory || app.isRecentFile || app.isFavoriteFile) {
            if (!this._populateContextMenu_files(app)) {
                return;
            }
        } else if (app.isSearchResult && app.emoji) {
            const i = MODABLE.indexOf(app.emoji);//Find if emoji is in list of emoji that can have
                                                 //skin tone modifiers.
            if (i < 0) {
                return;
            }
            const addMenuItem = (char, text) => {
                const newEmoji = MODED[i].replace(/\u{1F3FB}/ug, char); //replace light skin tone character in
                                                                       // MODED[i] with skin tone option.
                const item = new ContextMenuItem(this.appThis, newEmoji + ' ' + text, null,
                                        () => { const clipboard = St.Clipboard.get_default();
                                                clipboard.set_text(St.ClipboardType.CLIPBOARD, newEmoji);
                                                this.appThis.closeMenu(); } );
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            addMenuItem('\u{1F3FB}', _('light skin tone'));
            addMenuItem('\u{1F3FC}', _('medium-light skin tone'));
            addMenuItem('\u{1F3FD}', _('medium skin tone'));
            addMenuItem('\u{1F3FE}', _('medium-dark skin tone'));
            addMenuItem('\u{1F3FF}', _('dark skin tone'));
        } else {
            return;
        }

        this.isOpen = true;
        this.appThis.resizer.inhibit_resizing = true;
        //----Position and open menu----
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

        //This context menu doesn't have an St.Side and so produces errors in .xsession-errors
        //enable animation for the sole reason that it spams .xsession-errors less. Can't add an
        //St.Side because in some themes it looks like it should be attached to a panel but isn't.
        this.menu.open(true);
        return;
    }

    _populateContextMenu_apps(app) {
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
                                () => { spawnCommandLine('optirun gtk-launch ' + app.id);
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
                    launcherApplet.acceptNewLauncher(app.id);
                }
                this.close(); } ));
        const userDesktopPath = getUserDesktopDir();
        if (userDesktopPath) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to desktop'), 'computer',
                () => { const file = Gio.file_new_for_path(app.get_app_info().get_filename());
                        const destFile = Gio.file_new_for_path(userDesktopPath + '/' + file.get_basename());
                        try {
                            file.copy( destFile, 0, null, null);
                            changeModeGFile(destFile, 755);
                        } catch(e) {
                            global.logError('Cinnamenu: Error creating desktop file', e);
                        }
                        this.close(); } ));
        }
        if (this.appThis.appFavorites.isFavorite(app.id)) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                                            () => { this.appThis.appFavorites.removeFavorite(app.id);
                                                    this.close(); } ));
        } else {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                                        () => { this.appThis.appFavorites.addFavorite(app.id);
                                                this.close(); } ));
        }
    }

    _populateContextMenu_files(app) {
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };
        const hasLocalPath = (file) => (file.is_native() && file.get_path() != null);
        const file = Gio.File.new_for_uri(app.uri);
        const fileExists = file.query_exists(null);
        if (!fileExists && !app.isFavoriteFile) {
            Main.notify(_('This file is no longer available'),'');
            return false; //no context menu
        }
        //Note: a file can be an isFavoriteFile and also not exist so continue below and add option to
        //remove from favorites.
        if (fileExists) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Open with'), null, null ));
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
                                                () => { spawnCommandLine('nemo-open-with ' + app.uri);
                                                        this.appThis.closeMenu(); } ));
        }

        const favs = XApp.Favorites ? XApp.Favorites.get_default() : null;
        if (favs) {//prior to cinnamon 4.8, XApp favorites are not available
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
            const updateAfterFavFileChange = () => {
                    this.appThis.sidebar.populate();
                    this.appThis.categoriesView.update();//in case fav files category needs adding/removing
                    this.appThis.updateMenuSize();
                    if (this.appThis.currentCategory === 'favorite_files') {
                        this.appThis.setActiveCategory(this.appThis.currentCategory);
                    } };
            if (favs.find_by_uri(app.uri)) { //favorite
                addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                                                        () => { favs.remove(app.uri);
                                                                updateAfterFavFileChange();
                                                                this.close(); } ));
            } else {
                addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                        () =>   {   favs.add(app.uri);
                                    //favs list doesn't update synchronously after adding fav so add small
                                    //delay before updating menu
                                    Mainloop.timeout_add(100, () => { updateAfterFavFileChange(); });
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

            const fileInfo = file.query_info('access::can-trash', Gio.FileQueryInfoFlags.NONE, null);
            const canTrash = fileInfo.get_attribute_boolean('access::can-trash');
            if (canTrash) {
                addMenuItem( new ContextMenuItem(this.appThis, _('Move to trash'), 'user-trash',
                            () => { const file = Gio.File.new_for_uri(app.uri);
                                    try {
                                        file.trash(null);
                                    } catch (e) {
                                        Main.notify(_('Error while moving file to trash:'), e.message);
                                    }
                                    this.appThis.setActiveCategory(this.appThis.currentCategory);
                                    this.close(); } ));
            } else {//show insensitive item
                addMenuItem( new ContextMenuItem(this.appThis, _('Move to trash'), 'user-trash',
                                                                            null, true /*insensitive*/));
            }
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

class AppButton {
    constructor(appThis, app) {
        this.appThis = appThis;
        this.app = app;
        const isListView = this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST;
        this.signals = new SignalManager(null);
        //----------ICON---------------------------------------------
        if (this.app.icon) { //isSearchResult(excl. emoji), isClearRecentsButton, isBackButton
            this.icon = this.app.icon;
        } else if (this.app.gicon) { //isRecentFile, isFavoriteFile, isWebBookmark,
                                    //isFolderviewFile/Directory, isSearchResult(wikipedia)
            let gicon = this.app.gicon;
            if (!this.app.isWebBookmark && !this.app.isSearchResult) {
                gicon = getThumbnail_gicon(this.app.uri, this.app.mimeType) || gicon;
            }
            this.icon = new St.Icon({ gicon: gicon, icon_size: this.appThis.getAppIconSize()});
        } else if (this.app.emoji) {//emoji search result
            const iconLabel = new St.Label({ style: 'color: white; font-size: ' +
                                            (Math.round(this.appThis.getAppIconSize() * 0.85)) + 'px;'});
            iconLabel.get_clutter_text().set_markup(this.app.emoji);
            this.icon = iconLabel;
        } else if (this.app.isApplication) {//isApplication
            this.icon = this.app.create_icon_texture(this.appThis.getAppIconSize());
        } else if (this.app.iconFactory) {//isPlace
            this.icon = this.app.iconFactory(this.appThis.getAppIconSize());
            if (!this.icon) {
                this.icon = new St.Icon({ icon_name: 'folder', icon_size: this.appThis.getAppIconSize()});
            }
        }
        if (!this.icon) {
            this.icon = new St.Icon({icon_name: 'dialog-error', icon_size: this.appThis.getAppIconSize()});
        }
        //--------Label------------------------------------
        this.label = new St.Label({ style_class: 'menu-application-button-label' });
        //.menu-application-button-label{} in themes are designed for list view and may have uneven
        //padding, so in grid view make padding symmetrical and center text
        let labelStyle = '';
        if (!isListView) {
            labelStyle = 'padding-right: 2px; padding-left: 2px; text-align: center; ';
        }
        if (this.app.isClearRecentsButton) {
            labelStyle += 'font-weight: bold;';
        }
        this.label.style = labelStyle;
        //set label text
        let name = this.app.name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        let description = this.app.description ?
                            this.app.description.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
        let markup = '<span>' + name + '</span>';
        if (this.appThis.settings.descriptionPlacement === PlacementUNDER && description) {
            description = description.replace(/\n/g, ' ');//remove formatting intended for tooltip
            markup += '\n<span size="small">' + description + '</span>';
        }
        const clutterText = this.label.get_clutter_text();
        clutterText.set_markup(markup);
        clutterText.ellipsize = EllipsizeMode.END;
        //--------app running indicator--------------
        this.appRunningIndicator = new St.Widget({
                style: isListView ?
                'width: 2px; height: 12px; background-color: ' + this.appThis.getThemeForegroundColor() +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;' :
                'width: 32px; height: 2px; background-color: ' + this.appThis.getThemeForegroundColor() +
                                                    '; margin: 0px; border: 1px; border-radius: 10px;',
                x_expand: false,
                y_expand: false});
        //-------------actor---------------------
        this.actor = new St.BoxLayout({ vertical: !isListView, reactive: true,
                                            accessible_role: Atk.Role.MENU_ITEM});
        //remove l/r padding in grid view to allow maximum space for label
        if (!isListView) {
            this.actor.set_style('padding-left: 0px; padding-right: 0px;');
            this.setGridButtonWidth();
        }
        if (this.icon && this.appThis.getAppIconSize() > 0) {
            this.actor.add(this.icon, { x_fill: false, y_fill: false,
                                        x_align: isListView ? St.Align.START : St.Align.MIDDLE,
                                        y_align: St.Align.MIDDLE});
        }
        this.actor.add(this.appRunningIndicator, {  x_fill: false, y_fill: false,
                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.actor.add(this.label, {
                                x_fill: false, y_fill: false,
                                x_align: isListView ? St.Align.START : St.Align.MIDDLE,
                                y_align: St.Align.MIDDLE});
        this._setButtonNormal();
        this._setAppHighlightClass();
        //----------dnd--------------
        if (this.app.isApplication) {
            this.actor._delegate = {
                    handleDragOver: (source) => {
                            if (source.isDraggableApp && source.id !== this.app.id &&
                                                            this.appThis.currentCategory === 'favorite_apps') {
                                this._resetAllAppsOpacity();
                                this.actor.set_opacity(40);
                                return DragMotionResult.MOVE_DROP;
                            }
                            return DragMotionResult.NO_DROP; },
                    handleDragOut: () => {  this.actor.set_opacity(255); },
                    acceptDrop: (source) => {
                            if (source.isDraggableApp && source.id !== this.app.id &&
                                                            this.appThis.currentCategory === 'favorite_apps') {
                                this.actor.set_opacity(255);
                                this.appThis.addFavoriteAppToPos(source.id, this.app.id);
                                return true;
                            } else {
                                this.actor.set_opacity(255);
                                return DragMotionResult.NO_DROP;
                            } },
                    getDragActorSource: () => this.actor,
                    _getDragActor: () => new Clutter.Clone({source: this.actor}),
                    getDragActor: () => new Clutter.Clone({source: this.icon}),
                    id: this.app.id,
                    isDraggableApp: true
            };

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
            //this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this._onDragCancelled(...args));
            this.signals.connect(this.draggable, 'drag-end', () => this._resetAllAppsOpacity());
        }

        //----running state
        this._onRunningStateChanged();
        if (this.app.isApplication) {
            this.signals.connect(this.app, 'notify::state', (...args) => this._onRunningStateChanged(...args));
        }

        //this.signals.connect(this.actor, 'button-press-event', (...args) => this.handleButtonPress(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this._handleButtonRelease(...args));
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
    }

    _setButtonNormal() {
        this.entered = false;
        this.actor.set_style_class_name('menu-application-button');
        this._addTileStyle();
    }

    _setButtonSelected() {
        this.entered = true;
        this.actor.set_style_class_name('menu-application-button-selected');
        this._addTileStyle();
    }

    _addTileStyle() {
        if (!this.appThis.settings.useTileStyle) {
            return;
        }

        const toRgbaString = (col) => {
                const decPlaces2 = (n) => Math.round(n * 100) / 100;
                return `rgba(${col.red},${col.green},${col.blue},${decPlaces2(col.alpha / 255)})`; };
        const lightenOrDarkenColor = (col) => { //lighten a dark color or darken a light color
                    const isLightTheme = (col.red + col.green + col.blue) > 364;
                    const amt = isLightTheme ? -15 : 15;
                    col.red += amt;
                    col.green += amt;
                    col.blue += amt;
                    return col; };
        //const opaqueify = (col) => { //make color 1/3 more opaque
        //            col.alpha = Math.floor((col.alpha + col.alpha + 255) / 3);
        //            return col; };
        const bgColor = this.appThis.getThemeBackgroundColor();
        if (bgColor.to_string().startsWith('#000000')) {
            bgColor.red = 20;
            bgColor.green = 20;
            bgColor.blue = 20;
        }
        let addedStyle = '';
        if (this.entered) {
            addedStyle += 'border:2px; border-color:' + toRgbaString(bgColor) + ';';
        } else {
            addedStyle += 'border:2px; border-color:' + toRgbaString(bgColor) +
                        '; background-color:' + toRgbaString(lightenOrDarkenColor(bgColor)) + ';';
        }
        this.actor.set_style(addedStyle);
    }

    _setAppHighlightClass() {
        if (this.app.newAppShouldHighlight) {
            if (!this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.add_style_pseudo_class('highlighted'); //'font-weight: bold;';
            }
        } else {
            if (this.actor.has_style_pseudo_class('highlighted')) {
                this.actor.remove_style_pseudo_class('highlighted');
            }
        }
    }

    setGridButtonWidth() {
        this.actor.width = this.appThis.appsView.getGridValues().columnWidth;
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen ) {
            return false;
        }

        if (event) {//mouse
            this.appThis.clearEnteredActors();
        } else {//keyboard navigation
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }
        this._setButtonSelected();

        //------show tooltip
        if (this.appThis.settings.descriptionPlacement === PlacementTOOLTIP) {
            const SHOW_SEARCH_MARKUP_IN_TOOLTIP = true;
            let tooltipMarkup = '<span>' + wordWrap((this.app.nameWithSearchMarkup &&
                                            SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.appThis.searchActive) ?
                                            this.app.nameWithSearchMarkup : this.app.name) + '</span>';
            if (this.app.description) {
                tooltipMarkup += '\n<span size="small">' + wordWrap((this.app.descriptionWithSearchMarkup &&
                                    SHOW_SEARCH_MARKUP_IN_TOOLTIP && this.appThis.searchActive) ?
                                    this.app.descriptionWithSearchMarkup : this.app.description) + '</span>';
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
            showTooltip(this.actor, x, y, center_x, tooltipMarkup);
        }
        return false;
    }

    handleLeave(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            return false;
        }
        this._setButtonNormal();
        hideTooltipIfVisible();
    }

    _handleButtonRelease(actor, e) {
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
                if (this.app.isApplication || this.app.isFolderviewFile || this.app.isFolderviewDirectory ||
                                            this.app.isFavoriteFile || this.app.emoji || this.app.isRecentFile){
                    this.openContextMenu(e);
                }
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.app.isApplication) {
            if (this.app.newAppShouldHighlight) {
                this.app.newAppShouldHighlight = false;
                this._setAppHighlightClass();
            }
            this.appThis.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.appThis.closeMenu();
        } else if (this.app.isPlace) {
            this.app.launch();
            this.appThis.closeMenu();
        } else if (this.app.isWebBookmark) {
            this.app.app.launch_uris([this.app.uri], null);
            this.appThis.closeMenu();
        } else if (this.app.isFolderviewDirectory || this.app.isBackButton) {
            this.appThis.setActiveCategory(Gio.File.new_for_uri(this.app.uri).get_path());
            //don't closeMenu
        } else if (this.app.isFolderviewFile || this.app.isRecentFile || this.app.isFavoriteFile) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.appThis.closeMenu();
            } catch (e) {
                Main.notify(_('Error while opening file:'), e.message);
                //don't closeMenu
            }
        } else if (this.app.isClearRecentsButton) {
            this.appThis.recentApps.clear();
            Gtk.RecentManager.get_default().purge_items();
            this.appThis.recentsJustCleared = true;
            this.appThis.setActiveCategory('recents');
            //don't closeMenu
        } else if (this.app.isSearchResult) {
            this.app.activate(this.app);
            this.appThis.closeMenu();
        }
    }

    _onRunningStateChanged() {
        if (this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            if (this.app.isApplication && this.app.state !== AppState.STOPPED) {
                this.appRunningIndicator.show();
            } else {
                this.appRunningIndicator.hide();
            }
        } else {
            if (this.app.isApplication && this.app.state !== AppState.STOPPED) {
                this.appRunningIndicator.opacity = 255;
            } else {
                this.appRunningIndicator.opacity = 0;
            }
        }
        return true;
    }

    openContextMenu(e) {
        this._setButtonSelected();
        hideTooltipIfVisible();
        this.appThis.contextMenu.open(this.app, e, this);
    }

    _resetAllAppsOpacity() {
        this.appThis.appsView.getActiveContainer().get_children().forEach( child => child.set_opacity(255) );
    }

    destroy() {
        this.signals.disconnectAllSignals();
        hideTooltipIfVisible();

        this.appRunningIndicator.destroy();
        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        this.actor.destroy();
    }
}

class SidebarButton {
    constructor(appThis, icon, app, name, description, callback) {
        //super({ hover: false, activate: false });
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.app = app;
        this.name = name;
        this.description = description;
        this.callback = callback;
        this.actor = new St.BoxLayout({ style_class: 'menu-favorites-button',
                                        reactive: true,
                                        accessible_role: Atk.Role.MENU_ITEM });
        //this.actor.set_style_class_name('menu-favorites-button');
        this.entered = false;
        if (icon) {
            this.icon = icon;
            this.actor.add_actor(this.icon);
        }

        if (this.app && this.app.isApplication) { //----------dnd--------------
            this.actor._delegate = {
                    handleDragOver: (source) => {
                            if (source.isDraggableApp === true && source.id !== this.app.id) {
                                this.actor.set_opacity(40);
                                return DragMotionResult.MOVE_DROP;
                            }
                            return DragMotionResult.NO_DROP; },
                    handleDragOut: () => { this.actor.set_opacity(255); },
                    acceptDrop: (source) => {
                            if (source.isDraggableApp === true && source.id !== this.app.id) {
                                this.actor.set_opacity(255);
                                this.appThis.addFavoriteAppToPos(source.id, this.app.id);
                                return true;
                            } else {
                                this.actor.set_opacity(255);
                                return DragMotionResult.NO_DROP;
                            } },
                    getDragActorSource: () => this.actor,
                    _getDragActor: () => new Clutter.Clone({source: this.actor}),
                    getDragActor: () => new Clutter.Clone({source: this.icon}),
                    id: this.app.id,
                    isDraggableApp: true
            };

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
            //this.signals.connect(this.draggable, 'drag-cancelled', (...args) => this._onDragCancelled(...args));
            //this.signals.connect(this.draggable, 'drag-end', (...args) => this._onDragEnd(...args));
        }

        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this._handleButtonRelease(...args));
    }

    _handleButtonRelease(actor, e) {
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
        } else if (this.app.isApplication) {
            this.appThis.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.appThis.closeMenu();
        } else if (this.app.isFavoriteFile) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.appThis.closeMenu();
            } catch (e) {
                Main.notify(_('Error while opening file:'), e.message);
            }
        }
    }

    openContextMenu(e) {
        hideTooltipIfVisible();
        this.appThis.contextMenu.open(this.app, e, this);
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            return true;
        }

        if (event) {
            this.appThis.clearEnteredActors();
        } else {//key nav
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }

        this.entered = true;
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
        showTooltip(this.actor, x, y, false /*don't center tooltip on x*/, text);
        return true;
    }

    handleLeave() {
        if (this.appThis.contextMenu.isOpen) {
            return true;
        }
        this.entered = false;
        this.actor.remove_style_pseudo_class('hover');
        hideTooltipIfVisible();
        return true;
    }

    destroy() {
        this.signals.disconnectAllSignals();

        if (this.icon) {
            this.icon.destroy();
        }
        this.actor.destroy();
    }
}

module.exports = {CategoryButton, AppButton, ContextMenu, SidebarButton};
