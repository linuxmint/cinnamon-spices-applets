const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Atk = imports.gi.Atk;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const {_} = require('./utils');

class CategoryButton {
    constructor(appThis, category_id, category_name, icon_name, gicon) {
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.disabled = false;
        //Note: When option "Activate categories on click" is on, then the this.has_focus === true category
        //is the one that has keyboard or mouse focus and is not necessarily the same as the currently
        //selected category (this.appThis.currentCategory)
        this.has_focus = false;
        this.id = category_id;
        this.actor = new St.BoxLayout({ style_class: 'menu-category-button', reactive: true,
                                                                accessible_role: Atk.Role.MENU_ITEM});

        //----icon
        if (icon_name) {
            if (icon_name === 'emoji-grinning-face') {
                this.icon = new St.Label({ style: 'color: white; font-size: ' +
                                    (Math.round(this.appThis.settings.categoryIconSize * 0.85)) + 'px;'});
                this.icon.get_clutter_text().set_markup('🌷');
            } else {
                this.icon = new St.Icon({   icon_name: icon_name, icon_type: St.IconType.FULLCOLOR,
                                            icon_size: this.appThis.settings.categoryIconSize});
            }
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
        this.icon.set_opacity(255);
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
        ['/Mint-Y',             'background-color: #d8d8d8; color: black;'],//Mint-Y & Mint-Y-<color> (red)
        ['/Mint-Y-Dark',        'background-color: #404040;'],//Mint-Y-Dark & Mint-Y-Dark-<color> (light grey)
        ['/Mint-X/',            'background-color: #d4d4d4; color: black; border-image: none;'],//(normal)
        ['/Mint-X-',            'background-color: #d4d4d4; color: black; border-image: none;'],//Mint-X-<color>
        ['/Mint-X-Dark',        ''],//undo previous '/Mint-X-' changes for '/Mint-X-Dark' //(light grey)
        ['/Linux Mint/',        'box-shadow: none; background-gradient-end: rgba(90, 90, 90, 0.5);'],//normal
        ['Cinnamon default',    'background-gradient-start: rgba(255,255,255,0.03); ' +   //normal
                                                    'background-gradient-end: rgba(255,255,255,0.03);'],
        ['/Adapta-Maia/',       'color: #263238; background-color: rgba(38, 50, 56, 0.12)'],//Manjaro (normal)
        ['/Adapta-Nokto-Maia/', 'color: #CFD8DC; background-color: rgba(207, 216, 220, 0.12);'],//Manjaro default
        ['/Dracula',            'background-color: #2d2f3d'],
        ['/Matcha-',            'background-color: white;'],//other Matcha- and Matcha-light- themes
        ['/Matcha-dark-aliz',   'background-color: #2d2d2d;'],
        ['/Matcha-dark-azul',   'background-color: #2a2d36;'],
        ['/Matcha-dark-sea',    'background-color: #273136;'],
        ['/Matcha-dark-cold',   'background-color: #282b33;'],
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

        let icon_opacity = this.icon.get_theme_node().get_double('opacity');
        icon_opacity = Math.min(Math.max(0, icon_opacity), 1);
        if (icon_opacity) { // Don't set opacity to 0 if not defined
            this.icon.set_opacity(icon_opacity * 255);
        }
    }

    selectCategory() {
        this.appThis.setActiveCategory(this.id);
    }

    handleEnter(actor, event) {
        //this method handles enter-event, motion-event and keypress
        if (this.has_focus || this.disabled || this.appThis.contextMenu.isOpen ||
                            this.appThis.badAngle && event && !this.appThis.settings.categoryClick) {
            return Clutter.EVENT_PROPAGATE;
        }
        if (event) {//mouse
            this.appThis.clearFocusedActors();
        } else {//keypress
            this.appThis.scrollToButton(this, this.appThis.settings.enableAnimation);
        }

        this.has_focus = true;
        if (this.id === this.appThis.currentCategory || //No need to select category as already selected
                            this.id === 'emoji:' && this.appThis.currentCategory.startsWith('emoji:')) {
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
        this.has_focus = false;

        //If this category is the this.appThis.currentCategory then we leave this button with
        //menu-category-button-selected style even though key or mouse focus is moving elsewhere so
        //that the current category is always indicated.
        if (this.appThis.currentCategory !== this.id && this.id !== 'emoji:' ||
                        this.id === 'emoji:' && !this.appThis.currentCategory.startsWith('emoji:')) {
            this.setButtonStyleNormal(); //i.e. remove hover style
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
                //Remove focus from this category button before opening it's context menu.
                //Todo: Ideally this button should retain focus style to indicate the button the
                //context menu was opened on.
                this.handleLeave();
            }
            this.openContextMenu(event);
            return Clutter.EVENT_STOP;
        }
    }

    openContextMenu(e) {
        this.appThis.contextMenu.open(this.id, e, this.actor, true);
    }

    disable() {
        this._setButtonStyleGreyed();
        this.disabled = true;
        this.has_focus = false;
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

/* Creates the categories box and array of CategoryButtons (buttons[]). Updates the categories and
 * populates the categoriesBox. */
class CategoriesView {
    constructor(appThis) {
        this.appThis = appThis;
        this.buttons = [];

        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box', vertical: true });
        this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({/*style: 'max-width: 185px;',*/ vertical: true });
        this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, { });

        this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({ style_class: 'vfade menu-categories-scrollbox' });
        this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);
        this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.groupCategoriesWorkspacesScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);
    }

    update() {
        //Put all enabled categories into newButtons[] in default order by reusing the
        //buttons in this.buttons[] or creating new button.
        const newButtons = [];

        let button = this.buttons.find(button => button.id === 'all');
        if (!button) {
            button = new CategoryButton(this.appThis, 'all', _('All applications'), 'computer');
        }
        newButtons.push(button);

        const dirs = [];
        const iter = this.appThis.appSystem.get_tree().get_root_directory().iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.DIRECTORY) {
                dirs.push(iter.get_directory());
            }
        }
        dirs.sort((a, b) => {
                        const prefCats = ['ADMINISTRATION', 'PREFERENCES'];
                        const prefIdA = prefCats.indexOf(a.get_menu_id().toUpperCase());
                        const prefIdB = prefCats.indexOf(b.get_menu_id().toUpperCase());
                        if (prefIdA < 0 && prefIdB >= 0) return -1;
                        if (prefIdA >= 0 && prefIdB < 0) return 1;
                        return a.get_name().localeCompare(b.get_name(), undefined,
                                                          {sensitivity: "base", ignorePunctuation: true});
                    });
        dirs.forEach(dir => {
                if (!dir.get_is_nodisplay()) {
                    const dirId = dir.get_menu_id();
                    const categoryApps = this.appThis.apps.listApplications(dirId);
                    if (categoryApps.length > 0) {
                        let button = this.buttons.find(button => button.id === dirId);
                        if (!button) {
                            button = new CategoryButton(this.appThis, dirId, dir.get_name(), null, dir.get_icon());
                        }
                        const newAppIndex = categoryApps.findIndex(app => !!app.newAppShouldHighlight);
                        button.setHighlight(newAppIndex >= 0);//highlight category if it contains a new app
                        newButtons.push(button);
                    }
                } });

        const enableFavFiles = XApp.Favorites && XApp.Favorites.get_default().get_favorites(null).length > 0;
        const homeDir = GLib.get_home_dir();
        [   [enableFavFiles, 'favorite_files', _('Favorites'), 'xapp-user-favorites'],
            [this.appThis.settings.showPlaces, 'places', _('Places'), 'folder'],
            [this.appThis.recentsEnabled, 'recents', _('Recent'), 'document-open-recent'],
            [this.appThis.settings.showFavAppsCategory, 'favorite_apps', _('Favorite apps'), 'emblem-favorite'],
            [this.appThis.settings.showHomeFolder, homeDir,_('Home folder'), 'user-home'],
            [this.appThis.settings.showEmojiCategory, 'emoji:', _('Emoji'), 'emoji-grinning-face']
        ].forEach(param => {
                if (param[0]) {
                    let button = this.buttons.find(button => button.id === param[1]);
                    if (!button) {
                        button = new CategoryButton(this.appThis, param[1], param[2], param[3]);
                    }
                    newButtons.push(button);
                } });

        //set user category order to default if none already
        if (this.appThis.settings.categories.length === 0) {
            this.appThis.settings.categories = newButtons.map( button => button.id);
        }

        //add new found categories to end of user category order
        newButtons.forEach(newButton => {
            if (this.appThis.settings.categories.indexOf(newButton.id) === -1) {
                this.appThis.settings.categories.push(newButton.id);
            }
        });

        //set this.buttons[] to newButtons[] in user prefered order
        this.buttons = [];
        this.appThis.settings.categories.forEach(buttonId => {
            const foundButton = newButtons.find(newButton => newButton.id === buttonId);
            if (foundButton) {
                this.buttons.push(foundButton);
            }
        });

        //populate categoriesBox with buttons
        this.categoriesBox.remove_all_children();
        this.buttons.forEach((button) => this.categoriesBox.add_actor(button.actor));
    }

    setSelectedCategoryStyle(categoryId) {
        this.buttons.forEach(categoryButton => {
                    if (categoryButton.id === categoryId ||
                                    categoryButton.id === 'emoji:' && categoryId.startsWith('emoji:')) {
                        categoryButton.setButtonStyleSelected();
                    } else {
                        categoryButton.setButtonStyleNormal();
                    } });
    }

    destroy() {
        this.buttons.forEach(button => button.destroy());
        this.buttons = [];
        this.categoriesBox.destroy();
        this.groupCategoriesWorkspacesWrapper.destroy();
        this.groupCategoriesWorkspacesScrollBox.destroy();
    }
}

module.exports = {CategoriesView};
