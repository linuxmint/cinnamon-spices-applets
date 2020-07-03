//const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const {Clone, BinLayout, ActorAlign} = imports.gi.Clutter;
const {   TextureCache,
          Icon,
          IconType,
          Label,
          Align,
          BoxLayout,
          Widget } = imports.gi.St;
const {AppState} = imports.gi.Cinnamon;
const {EllipsizeMode} = imports.gi.Pango;
const {UserManager} = imports.gi.AccountsService;
const Main = imports.ui.main;
const {PopupBaseMenuItem, PopupSubMenu} = imports.ui.popupMenu;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;
const {getUserDesktopDir, changeModeGFile} = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const {spawnCommandLine, spawn, unref} = imports.misc.util;
const {createStore} = imports.misc.state;

const {_, ApplicationType, stripMarkupRegex} = require('./constants');
const {tryFn, ShowTooltip} = require('./utils');
const PlacementTOOLTIP = 1, PlacementUNDER = 2, PlacementNONE = 3;

const USER_DESKTOP_PATH = getUserDesktopDir();
const canUninstall = GLib.file_test('/usr/bin/cinnamon-remove-application', GLib.FileTest.EXISTS);

class CategoryListButton extends PopupBaseMenuItem {
    constructor(state, dir, altNameText, altIconName) {
        super({ hover: false, activate: false });
        this.state = state;
        this.connectIds = [
                    this.state.connect({
                                dragIndex: () => {
                                        if (this.state.dragIndex !== this.index && this.actor.opacity === 50) {
                                            this.actor.set_opacity(255);
                                        }        }
                                       })
                          ];
        this.signals = new SignalManager(null);

        this.index = -1;
        let isStrDir = typeof dir === 'string';
        let dirName = !isStrDir ? dir.get_name() : null;
        this.id = typeof dir === 'string' || dir instanceof String ? dir : altNameText;
        let categoryNameText = isStrDir ? altNameText : dirName ? dirName : '';
        this.disabled = false;
        this.entered = null;

        if (this.state.settings.showCategoryIcons) {
            let icon;
            if (!isStrDir) {
                icon = dir.get_icon();
                if (icon && icon.get_names) {
                    this.icon_name = icon.get_names().toString();
                } else {
                    this.icon_name = '';
                }
                if (this.icon_name) {
                    this.icon = TextureCache.get_default().load_gicon(null, icon, this.state.settings.categoryIconSize);
                } else {
                    icon = dir.get_icon() && typeof dir.get_icon().get_names === 'function' ?
                                                                dir.get_icon().get_names().toString() : 'error';
                    this.icon = new Icon({
                        icon_name: icon,
                        icon_size: this.state.settings.categoryIconSize
                    });
                }
            } else {
                this.icon_name = altIconName;
                icon = altIconName;
                this.icon = new Icon({ icon_name: icon,
                                       icon_size: this.state.settings.categoryIconSize,
                                       icon_type: IconType.FULLCOLOR });
            }
            this.addActor(this.icon);
        }

        this.categoryNameText = categoryNameText;
        this.label = new Label({ text: this.categoryNameText,
                                 style_class: 'menu-category-button-label'
                              });
        this.addActor(this.label);
        this.label.realize();

        //?undo
        this.actor._delegate = {
            handleDragOver: (source /*, actor, x, y, time */) => {
                if (!source.index || source.index === this.index) {
                        return DragMotionResult.NO_DROP;
                }
                this.state.set({dragIndex: this.index});
                this.actor.set_opacity(50);
                return DragMotionResult.MOVE_DROP;
            },
            acceptDrop: (source /*, actor, x, y, time */) => {
                if (!source.index || source.index === this.index) {
                    this.state.set({dragIndex: -1});
                    return DragMotionResult.NO_DROP;
                }
                this.state.trigger('moveCategoryToPos', source.id, this.id);
                return true;
            },
            getDragActorSource: () => this.actor,
            _getDragActor: () => new Clone({source: this.actor}),
            getDragActor: () => new Clone({source: this.icon}),
            isDraggableApp: false,
            index: this.index,
            id: this.id
        };

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
        this.state.set({categoryDragged: true});
    }

    onDragCancelled() {
        this.actor.set_opacity(255);
        this.state.set({categoryDragged: false});
    }

    onDragEnd() {
        this.actor.set_opacity(255);
        setTimeout(() => this.state.set({categoryDragged: false}), 0);
    }

    _clearDragPlaceholder() {
        if (this.state.dragPlaceholder) {
            this.state.dragPlaceholder.destroy();
            this.state.dragPlaceholder = null;
        }
    }

    selectCategory() {
        if (this.disabled) {
            return false;
        }
        if (this.id) {
            this.state.set({currentCategory: this.id});
        }
    }

    handleEnter(actor, event) {
        if (this.disabled) {
            return false;
        }

        if (event) {//?undo
            this.state.trigger('clearEnteredActors');
            if (!this.state.settings.categoryClick) {
                setTimeout(() => this.state.trigger('makeVectorBox', this.actor), 0);
            }
        } else {
            this.state.trigger('scrollToButton', this, true);
        }

        //this.state.trigger('scrollToButton', this, true);

        this.entered = true;
        if (this.state.settings.categoryClick) {
            this.actor.set_style_class_name('menu-category-button-selected');
            return;
        } else {
            this.selectCategory();
            return true;
        }
    }

    handleLeave(actor, event) {
        if (this.disabled) {
            return false;
        }
        this.entered = null;
        if ((!event || this.state.settings.categoryClick) && this.state.currentCategory !== this.id) {
            this.actor.set_style_class_name('menu-category-button');
        }
    }

    handleButtonRelease(actor, event) {
        if (this.disabled || (event && event.get_button() > 1) || !this.state.settings.categoryClick) {
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
        this.state.trigger('setKeyFocus');
    }

    destroy() {
        for (let i = 0; i < this.connectIds.length; i++) {
            this.state.disconnect(this.connectIds[i]);
        }
        this.signals.disconnectAllSignals();
        this.label.destroy();
        if (this.icon) {
            this.icon.destroy();
        }
        PopupBaseMenuItem.prototype.destroy.call(this);
        unref(this);
    }
}

class ApplicationContextMenuItem extends PopupBaseMenuItem {
    constructor(state, buttonState, label, action, iconName) {
        super({focusOnHover: false});

        this.state = state;
        this.buttonState = buttonState;
        this.signals = new SignalManager(null);
        this.action = action;
        this.label = new Label({
            text: label,
            style: 'font-size: 13px;'
        });
        if (iconName !== null) {
            this.icon = new Icon({ icon_name: iconName,
                                   icon_size: 12,
                                   icon_type: IconType.SYMBOLIC });
            if (this.icon) {
                this.addActor(this.icon);
                this.icon.realize();
            }
        }
        this.addActor(this.label);
        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        // Override padding to help prevent label truncation, the menu container width is restricted to the column width,
        // so unless we turn the context menu into a modal somehow (not likely since it will fight for input with the
        // parent), this is the most practical solution for the grid.
        this.actor.set_style('padding-left: 6px !important; padding-right: 0px !important;');//' width: 215px !important;');
        //this.setColumnWidths([8, 132]);//??
    }

    handleEnter() {
        this.entered = true;
        this.actor.add_style_pseudo_class('active');
    }

    handleLeave() {
        this.entered = null;
        this.actor.remove_style_pseudo_class('active');
    }

    _onKeyFocusIn() {
        this.state.trigger('setKeyFocus');
    }

    activate(event) {
        if (!this.state || !this.buttonState) {
            return false;
        }
        if (event && event.get_button() === 3) {
            this.buttonState.trigger('toggleMenu');
            return false;
        }
        let destFile;
        switch (this.action) {
            case 'add_to_panel':
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    let new_applet_id = global.settings.get_int('next-applet-id');
                    global.settings.set_int('next-applet-id', (new_applet_id + 1));
                    let enabled_applets = global.settings.get_strv('enabled-applets');
                    enabled_applets.push('panel1:right:0:panel-launchers@cinnamon.org:' + new_applet_id);
                    global.settings.set_strv('enabled-applets', enabled_applets);
                }

                Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER)
                                                    .acceptNewLauncher(this.buttonState.app.get_id());

                this.buttonState.trigger('toggleMenu');
                if (this.state) {
                    this.state.trigger('openMenu');
                }
                break;
            case 'add_to_desktop':
                destFile = Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + this.buttonState.app.get_id());
                tryFn(() => {
                    Gio.file_new_for_path(this.buttonState.app.get_app_info().get_filename())
                                .copy(
                                    Gio.file_new_for_path(USER_DESKTOP_PATH + '/' + this.buttonState.app.get_id()),
                                    0,
                                    null,
                                    null
                                );
                    changeModeGFile(destFile, 755);
                }, function(e) {
                    global.log(e);
                });
                this.buttonState.trigger('toggleMenu');
                break;
            case 'add_to_favorites':
                this.state.trigger('addFavorite', this.buttonState.app.get_id());
                break;
            case 'remove_from_favorites':
                this.state.trigger('removeFavorite', this.buttonState.app.get_id());
                break;
            case 'uninstall':
                spawnCommandLine('/usr/bin/cinnamon-remove-application \'' +
                                                    this.buttonState.app.get_app_info().get_filename() + '\'');
                this.state.trigger('closeMenu');
                break;
            case 'run_with_nvidia_gpu':
                spawnCommandLine('optirun gtk-launch ' + this.buttonState.app.get_id());
                this.state.trigger('closeMenu');
                break;
        }
        return false;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        PopupBaseMenuItem.prototype.destroy.call(this);
        unref(this);
    }
}

class AppListGridButton extends PopupBaseMenuItem {
    constructor(state, app, appType, appIndex, appListLength) {
        super({ hover: false, activate: false });
        this.state = state;
        this.connectId = this.state.connect({
            dragIndex: () => {
                if (this.state.dragIndex !== this.buttonState.appIndex && this.actor.opacity === 50) {
                    this.actor.set_opacity(255);
                }
            },
            searchActive: () => {
                if (!this.state) return;
                // Ensure the reset view is markup-free
                if (this.state.searchActive) {
                    this.nameUnformatted = this.buttonState.app.name;
                } else if (this.nameUnformatted) {
                    this.buttonState.app.name = this.nameUnformatted;
                    this.nameUnformatted = undefined;
                }
            }
        });
        this.buttonState = createStore({  app: app,
                                          appType: appType,
                                          appIndex: appIndex,
                                          appListLength: appListLength,
                                          column: -1 });
        this.buttonState.connect({
                    toggleMenu: () => this.toggleMenu() });

        this.actor.set_style_class_name('menu-application-button');
        if (!this.state.isListView) {
            this.actor.set_style('padding-left: 0px; padding-right: 0px;');
        }
        this.actor.x_align = this.state.isListView ? Align.START : Align.MIDDLE;
        this.actor.y_align = Align.MIDDLE;

        if (!this.state.isListView) {
            this.actor.width = this.state.trigger('getAppsGridBoxWidth') / this.state.settings.appsGridColumnCount;
        }

        // DND
        this.actor._delegate = {
            handleDragOver: (source /*, actor, x, y, time */) => {
                if (!source.appIndex || source.appIndex === this.buttonState.appIndex ||
                                                this.state.currentCategory !== 'favorites') {
                    return DragMotionResult.NO_DROP;
                }
                this.state.set({dragIndex: this.buttonState.appIndex});
                // TODO: We need to set a real placeholder, but to do so, the actor must be attached
                // to applicationsGridBox, or inserted into applicationsListBox.
                this.actor.set_opacity(50);
                return DragMotionResult.MOVE_DROP;
            },
            acceptDrop: (source /*, actor, x, y, time */) => {
                if (!source.appIndex || source.appIndex === this.buttonState.appIndex ||
                                                this.state.currentCategory !== 'favorites') {
                    this.state.set({dragIndex: -1});
                    return DragMotionResult.NO_DROP;
                }
                this.state.trigger('moveFavoriteToPos', source.get_app_id(), this.buttonState.appIndex);
                return true;
            },
            getDragActorSource: () => this.actor,
            _getDragActor: () => new Clone({source: this.actor}),
            getDragActor: () => new Clone({source: this.icon}),
            get_app_id: () => this.buttonState.app.get_id(),
            appIndex: this.buttonState.appIndex
        };

        this.signals = new SignalManager(null);
        this.contextMenuButtons = [];
        //this.description = ''; //why did i delete this line?
        this.entered = null;

        // appType 0 = application, appType 1 = place, appType 2 = recent
        // Filesystem autocompletion
        if (appType === ApplicationType._completions) {
            this.buttonState.appType = ApplicationType._places;
            this.file = Gio.file_new_for_path(this.buttonState.app.name);
            tryFn(
                () => this.handler = this.file.query_default_handler(null),
                () => this.handler = null
            );
        }

        // Don't show protocol handlers
        if (this.buttonState.app.description) {
            let slice = this.buttonState.app.description.slice(0, 7);
            if (slice === 'https://' || slice === 'http://' || slice === 'file://') {
                this.buttonState.app.description = this.buttonState.app.description.slice(7);
            }
            if (this.buttonState.app.description.slice(-1) === '/') {
                this.buttonState.app.description = this.buttonState.app.description.slice(0, -1);
            }
        } else if (this.buttonState.appType === ApplicationType._applications) {
            this.buttonState.app.description = this.state.fallbackDescription;
        }

        // Icons
        if (this.state.settings.showApplicationIcons) {
            if (this.buttonState.appType === ApplicationType._applications) {
                this.icon = this.buttonState.app.create_icon_texture(this.state.iconSize);
            } else if (this.buttonState.appType === ApplicationType._windows) {
                // Used instead of metaWindow.icon because create_icon_texture creates
                // higher resolution icons.
                this.icon = this.buttonState.app._icon;
                this.buttonState.app._icon = null;
            } else if (this.buttonState.appType === ApplicationType._places) {
                let iconObj = {
                    icon_size: this.state.iconSize
                };
                if (this.file) {
                    iconObj.icon_name = this.buttonState.app.icon === undefined ? 'unknown' : 'folder';
                    iconObj.icon_type = IconType.FULLCOLOR;
                } else {
                    iconObj.gicon = this.buttonState.app.icon;
                }
                this.icon = new Icon(iconObj);
            } else if (this.buttonState.appType === ApplicationType._recent) {
                if (this.buttonState.app.clearList) {
                    this.icon = this.buttonState.app.icon;
                    this.icon.set_icon_size(this.state.iconSize);
                } else {
                    this.icon = new Icon({
                        gicon: this.buttonState.app.icon,
                        icon_size: this.state.iconSize
                    });
                }
            } else if (this.buttonState.appType === ApplicationType._providers) {
                this.icon = this.buttonState.app.icon;
            }
            if (!this.icon) {
                this.icon = new Icon({
                    icon_name: 'error',
                    icon_size: this.state.iconSize,
                    icon_type: IconType.FULLCOLOR
                });
            }
        }
        this.label = new Label({
            text: this.buttonState.app.name,
            style_class: 'menu-application-button-label',
            style: 'padding-right: 2px; padding-left: 2px'
        });
        this.dot = new Widget({
            style: this.state.isListView ?
            'width: 2px; height: 12px; background-color: ' + this.state.theme.foregroundColor +
                                                '; margin: 0px; border: 1px; border-radius: 10px;' :
            'width: 32px; height: 2px; background-color: ' + this.state.theme.foregroundColor +
                                                '; margin: 0px; border: 1px; border-radius: 10px;',
            layout_manager: new BinLayout(),
            x_expand: false,
            y_expand: false,
        });
        this.iconContainer = new BoxLayout();
        if (this.icon) {
            this.iconContainer.add(this.icon, {
                x_fill: false,
                y_fill: false,
                x_align: Align.MIDDLE,
                y_align: Align.MIDDLE
            });
        }

        this.buttonBox = new BoxLayout({
            vertical: !this.state.isListView,
            width: 290 * global.ui_scale,//240
            y_expand: false
        });
        this.buttonBox.add(this.iconContainer, {
            x_fill: false,
            y_fill: false,
            x_align: this.state.isListView ? Align.START : Align.MIDDLE,
            y_align: Align.MIDDLE
        });
        this.buttonBox.add(this.dot, {
            x_fill: false,
            y_fill: false,
            x_align: Align.MIDDLE,
            y_align: Align.MIDDLE
        });
        this.buttonBox.add(this.label, {
            x_fill: false,
            y_fill: false,
            x_align: this.state.isListView ? Align.START : Align.MIDDLE,
            y_align: Align.MIDDLE
        });

        // Context menu
        if (this.buttonState.appType === ApplicationType._applications) {
            this.menu = new PopupSubMenu(this.actor);
            this.menu.actor.set_style_class_name('menu menu-context-menu menu-background starkmenu-background');
            this.menu.actor.set_style('width: 225px !important;');
            this.menu.actor.set_opacity(245);
            this.menu.isOpen = false;
            this.buttonBox.add_actor(this.menu.actor);
        } else {
            this.menu = {
                isOpen: false
            };
        }
        this.addActor(this.buttonBox);

        if (this.icon) {
            this.icon.realize();
        }

        // Connect signals
        if (this.buttonState.appType === ApplicationType._applications) {
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
        this.signals.connect(this.actor, 'parent-set', (...args) => this.handleParentChange(...args));
    }

    onDragBegin() {
        this.actor.set_opacity(51);
        if (this.tooltip) {
            this.tooltip.destroy();
        }
    }

    onDragCancelled() {
        this.actor.set_opacity(255);
    }

    onDragEnd() {
        this.actor.set_opacity(255);
    }

    handleParentChange() {
        if (this.state.settings.descriptionPlacement === PlacementUNDER || this.buttonState.app.shouldHighlight ||
                                                                                                this.state.searchActive) {
            this.formatLabel(false);
        }
        if (!this.buttonState.app.description && this.buttonState.appType === ApplicationType._applications) {
            this.buttonState.app.description = this.state.fallbackDescription;
        }
    }

    formatLabel(removeSearchMarkup = false) {
        let name = this.buttonState.app.name.replace(/&/g, '&amp;');
        let description = this.buttonState.app.description ? this.buttonState.app.description.replace(/&/g, '&amp;') : '';
        if (removeSearchMarkup) {
            this.buttonState.app.name = this.buttonState.app.name.replace(stripMarkupRegex, '');
            if (this.buttonState.app.description) {
                this.buttonState.app.description = this.buttonState.app.description.replace(stripMarkupRegex, '');
            }
            description = description.replace(stripMarkupRegex, '');
        }

        let markup = '<span>' + name + '</span>';
        if (this.state.settings.descriptionPlacement === PlacementUNDER) {
            if (!this.state.isListView) {
                this.label.set_style('text-align: center;');
            }
            markup += '\n<span size="small">' + description + '</span>';
        }

        if (this.buttonState.app.shouldHighlight) {
            markup = '<b>' + markup + '</b>';
        }
        let clutterText = this.label.get_clutter_text();
        if (clutterText && (this.state.settings.descriptionPlacement === PlacementUNDER ||
                        this.state.searchActive || this.buttonState.app.shouldHighlight) || removeSearchMarkup) {
            clutterText.set_markup(markup);
            clutterText.ellipsize = EllipsizeMode.END;
        }
    }

    formatTooltip() {
        let name = this.buttonState.app.name.replace(/&/g, '&amp;');
        let description = this.buttonState.app.description ? this.buttonState.app.description.replace(/&/g, '&amp;') : '';
        let tooltipMarkup;
        let limit = 100;
        const wordWrap = function(text, limit) {
            let regex = '.{1,' + limit + '}(\\s|$)|\\S+?(\\s|$)';
            return text.match(RegExp(regex, 'g')).join('\n');
        };
        let tooltipName = name;
        if (tooltipName.length > limit) {
            tooltipName = wordWrap(name, limit);
        }
        tooltipMarkup = '<span>' + tooltipName + '</span>';

        if (description.length > 0) {
            let tooltipDescription = description;
            if (description.length > limit) {
                tooltipDescription = wordWrap(description, limit);
            }
            tooltipMarkup += '\n<span size="small">' + tooltipDescription + '</span>';
        }
        this.tooltipMarkup = tooltipMarkup;
    }

    _onKeyFocusIn() {
        this.state.trigger('setKeyFocus');
    }

    handleEnter(actor, event) {
        if (this.state.contextMenuIsOpen != null || this.menu.isOpen || this.state.dragIndex > -1) {
            return false;
        }

        if (event) {
            this.state.trigger('clearEnteredActors');
        } else {
            this.state.trigger('scrollToButton', this);
        }

        this.entered = true;
        this.actor.set_style_class_name('menu-application-button-selected');

        if (this.state.settings.descriptionPlacement === PlacementTOOLTIP) {
            this.formatTooltip();
            let [x, y] = this.actor.get_transformed_position();
            let y_extra = 0;
            let {width, height} = this.actor;
            let center_x = false; //should tooltip x pos. be centered on x
            if (this.state.isListView) {
                x += width + 20 * global.ui_scale;
                //y = y;
                // Don't let the tooltip cover menu items when the menu
                // is oriented next to the right side of the monitor.
                const {style_class} = this.state.panelLocation;
                if (style_class === 'panelRight') {//TODO: also detect when panel is vertical-right
                    y += height + 8 * global.ui_scale;
                }
            } else {//grid view
                x += Math.floor(width / 2);
                y += height + 8 * global.ui_scale;
                center_x = true;
            }

            this.tooltip = new ShowTooltip(this.actor, x, y, center_x, this.tooltipMarkup);
        }
        return false;
    }

    handleLeave(actor, event) {
        if (this.state.contextMenuIsOpen === this.buttonState.appIndex && this.menu.isOpen || this.state.dragIndex > -1) {
            return false;
        }

        this.entered = null;
        this.actor.set_style_class_name('menu-application-button');
        if (this.tooltip) {
            this.tooltip.destroy();
        }
    }

    handleButtonPress() {
        this.state.set({categoryDragged: true});
    }

    handleButtonRelease(actor, e) {
        const prepareGridContextMenu = () => {
            this.buttonBox.height = this.buttonBox.get_preferred_size()[1];
            let x = -20, y = 20;
            if (this.buttonState.column === this.state.settings.appsGridColumnCount - 1) {
                x = 20;
            }
            if (this.state.trigger('isNotInScrollView', this)) {
                y = Math.round(this.actor.height * 1.9);
            }
            this.menu.actor.anchor_x = x;
            this.menu.actor.anchor_y = y;
        };

        const closeOtherContextMenus = () => {
            const buttons = this.state.trigger('getActiveButtons');
            for (let i = 0, len = buttons.length; i < len; i++) {
                if (buttons[i].buttonState.appIndex !== this.buttonState.appIndex) {
                    buttons[i].closeMenu();
                    buttons[i].handleLeave(true);
                }
            }
        };

        let button = !e ? 3 : e.get_button();
        if (button === 1) {//left click
            if (this.state.contextMenuIsOpen != null) {
                if (this.menu.isOpen && this.menu._activeMenuItem) {
                    this.menu._activeMenuItem.activate();
                } else {
                    if (!this.menu.isOpen) {
                        closeOtherContextMenus();
                    }
                    this.state.set({contextMenuIsOpen: null});
                }
                return false;
            }
            this.activate(e);
        } else if (button === 3) {//right click
            if (!this.state.isListView && this.buttonState.appType === ApplicationType._applications) {
                prepareGridContextMenu();
            }
            if (!this.menu.isOpen) {
                closeOtherContextMenus();
            }
            if (this.tooltip) {
                this.tooltip.destroy();
            }
            this.toggleMenu();
        }
        return true;
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
        } else if (this.buttonState.appType === ApplicationType._applications) {
            this.buttonState.app.open_new_window(-1);
        } else if (this.buttonState.appType === ApplicationType._places) {
            if (this.buttonState.app.uri) {
                this.buttonState.app.app.launch_uris([this.buttonState.app.uri], null);
            } else {
                this.buttonState.app.launch();
            }
        } else if (this.buttonState.appType === ApplicationType._recent) {
            if (this.buttonState.app.clearList) {
                Gtk.RecentManager.get_default().purge_items();
                this.state.set({currentCategory: 'all'});
                return;
            } else {
                Gio.app_info_launch_default_for_uri(this.buttonState.app.uri, global.create_app_launch_context());
            }
        } else if (this.buttonState.appType === ApplicationType._windows) {
            Main.activateWindow(this.buttonState.app.window, global.get_current_time());
        } else if (this.buttonState.appType === ApplicationType._providers) {
            this.buttonState.app.activate(this.buttonState.app);
        }
        this.state.trigger('closeMenu');
    }

    onStateChanged() {
        if (!this.buttonState.app || this.dot.is_finalized()) {
            return false;
        }
        if (this.buttonState.appType === ApplicationType._applications) {
            if (this.buttonState.app.state !== AppState.STOPPED) {
                this.dot.opacity = 255;
            } else {
                this.dot.opacity = 0;
            }
        }
        return true;
    }

    closeMenu() {
        if (this.buttonState.appType !== ApplicationType._applications) {
            return;
        }
        this.menu.close();
        if (this.state.isListView) this.label.show();
    }

    toggleMenu() {
        if (this.buttonState.appType !== ApplicationType._applications || !this.menu) {
            return false;
        }

        if (this.menu.isOpen) {
            // Allow other buttons hover functions to take effect.
            this.state.set({contextMenuIsOpen: null});
            if (this.state.isListView) this.label.show();
        } else {
            for (let i = 0; i < this.contextMenuButtons.length; i++) {
                this.contextMenuButtons[i].destroy();
                this.contextMenuButtons[i] = null;
            }
            this.contextMenuButtons = [];
            this.state.set({contextMenuIsOpen: this.buttonState.appIndex});
            this.actor.set_style_class_name('menu-application-button-selected');

            const addMenuItem = function(t, instance) {
                t.contextMenuButtons.push(instance);
                t.menu.addMenuItem(t.contextMenuButtons[t.contextMenuButtons.length - 1]);
            };

            addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState,
                                                        _('Add to panel'), 'add_to_panel', 'list-add'));
            if (USER_DESKTOP_PATH) {
                addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState,
                                                        _('Add to desktop'), 'add_to_desktop', 'computer'));
            }
            if (this.state.trigger('isFavorite', this.buttonState.app.get_id())) {
                addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState,
                                                _('Remove favorite'), 'remove_from_favorites', 'starred'));
            } else {
                addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState,
                                                _('Add to favorites'), 'add_to_favorites', 'non-starred'));
            }
            if (canUninstall) {
                addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState,
                                                        _('Uninstall'), 'uninstall', 'edit-delete'));
            }
            if (this.state.isBumblebeeInstalled) {
                addMenuItem(this, new ApplicationContextMenuItem(this.state, this.buttonState,
                                                        _('Run with NVIDIA GPU'), 'run_with_nvidia_gpu', 'cpu'));
            }

            if (this.state.isListView) {
                this.label.hide();
            } else {
                // In grid mode we will ensure our menu isn't overlapped by any other actors.
                let parent = this.actor.get_parent();
                if (!parent) return true; // Favorite change
                this.actor.get_parent().set_child_above_sibling(this.actor, null);

            }
        }
        this.menu.toggle_with_options(this.state.settings.enableAnimation);
        return true;
    }

    clearSearchFormatting() {
        this.formatLabel(true);
    }

    destroy(skipDestroy) {
        this.state.disconnect(this.connectId);
        this.signals.disconnectAllSignals();

        if (this.tooltip) {
            this.tooltip.destroy();
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
    constructor(state, icon, name, description, callback) {
        super({ hover: false,
                activate: false });
        this.state = state;
        this.signals = new SignalManager(null);
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

    handleButtonRelease(actor, event) {
        if (event && event.get_button() > 1) {
            return;
        }
        if (this.callback) {
            this.callback();
        }
        return true;
    }

    handleEnter(actor) {
        if (actor) {
            this.state.trigger('clearEnteredActors');
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
        this.tooltip = new ShowTooltip(this.actor, x, y, false /*don't center x*/, text);
    }

    handleLeave() {
        this.entered = null;
        this.actor.remove_style_pseudo_class('hover');
        this.tooltip.destroy();
    }

    /*setIcon(iconName) {
        this.removeActor(this.icon);
        this.icon.destroy();
        this.icon = this.icon = new Icon({
            icon_name: iconName,
            icon_size: this.iconSize,
            icon_type: IconType.FULLCOLOR
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

module.exports = {CategoryListButton, AppListGridButton, GroupButton};
