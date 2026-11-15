const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const Config = imports.misc.config;
const Util = imports.misc.util;
const St = imports.gi.St;
const XApp = imports.gi.XApp;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const {
    _,
    wordWrap,
    getThumbnail_gicon,
    showTooltip,
    hideTooltipIfVisible,
    scrollToButton
} = require('./utils');
const SidebarPlacement = Object.freeze({ TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});
const DescriptionPlacement = Object.freeze({TOOLTIP: 0, UNDER: 1, NONE: 2});

class SidebarButton {
    constructor(applet, icon, app, name, description, callback) {
        //super({ hover: false, activate: false });
        this.applet = applet;
        this.signals = new SignalManager(null);
        this.app = app;
        this.name = name;
        this.description = description;
        this.callback = callback;
        this.actor = new St.BoxLayout({
            style_class: 'menu-favorites-button',
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM
        });

        this.has_focus = false;
        if (icon) {
            this.icon = icon;
            this.actor.add_actor(this.icon);
        }

        //----------dnd--------------
        this.actor._delegate = { //make all sidebar items a drag target for apps and files
            handleDragOver: (source) => {
                if (source.isDraggableApp) {
                    if (this.app && this.app.isApplication && source.id !== this.app.id) {
                        this.actor.set_opacity(40);
                    }
                    return DragMotionResult.MOVE_DROP;
                } else if (source.isDraggableFile) {
                    return DragMotionResult.MOVE_DROP;
                }
                return DragMotionResult.NO_DROP;
            },
            handleDragOut: () => {
                if (this.app && this.app.isApplication) {
                    this.actor.set_opacity(255);
                }
            },
            acceptDrop: (source) => {
                if (source.isDraggableApp) {
                    if (this.app && this.app.isApplication && source.id !== this.app.id) {
                        this.actor.set_opacity(255);
                        this.applet.addFavoriteAppToPos(source.id, this.app.id);
                        return true;
                    } else if (!(this.app && this.app.isApplication)) {
                        this.applet.appFavorites.addFavorite(source.id);
                        return true;
                    }
                    return DragMotionResult.NO_DROP
                } else if (source.isDraggableFile){
                    XApp.Favorites.get_default().add(source.uri);
                    return true;
                }
            },
        };

        if (this.app && this.app.isApplication) { // make sidebar apps draggable
            Object.assign(this.actor._delegate, {
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor: () => new Clutter.Clone({source: this.icon}),
                id: this.app.id,
                isDraggableApp: true
            });

            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
        }

        this.signals.connect(this.actor, 'enter-event', this.handleEnter.bind(this));
        this.signals.connect(this.actor, 'leave-event', this.handleLeave.bind(this));
        this.signals.connect(this.actor, 'button-release-event', this._handleButtonRelease.bind(this));
    }

    _handleButtonRelease(actor, e) {
        if (this.applet.display.contextMenu.isOpen) {
            this.applet.display.contextMenu.close();
            this.applet.display.clearFocusedActors();
            this.handleEnter();
            return Clutter.EVENT_STOP;
        }

        const button = e.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            this.activate();
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            if (this.app != null) {
                this.openContextMenu(e);
            }
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    activate() {
        if (this.callback) {
            this.callback();
        } else if (this.app.isApplication) {
            this.applet.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.applet.menu.close();
        } else if (this.app.isFavoriteFile) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.applet.menu.close();
            } catch (e) {
                Main.notify(_('Error while opening file:'), e.message);
            }
        }
    }

    openContextMenu(e) {
        hideTooltipIfVisible();
        this.applet.display.contextMenu.openAppContextMenu(this.app, e, this.actor);
    }

    handleEnter(actor, event) {
        if (this.applet.display.contextMenu.isOpen) {
            return true;
        }

        if (event) { // mouse event
            this.applet.display.clearFocusedActors();
        } else { // key nav
            scrollToButton(this, this.applet.settings.enableAnimation);
        }

        this.has_focus = true;
        this.actor.add_style_pseudo_class('hover');

        // show tooltip
        if (this.applet.settings.descriptionPlacement === DescriptionPlacement.NONE) {
            return Clutter.EVENT_STOP;
        }
        let [x, y] = this.actor.get_transformed_position();
        x += this.actor.width + 2 * global.ui_scale;
        y += this.actor.height + 6 * global.ui_scale;
        let text = `<span>${this.name}</span>`;
        if (this.description) {
            text += '\n<span size="small">' + wordWrap(this.description) + '</span>';
        }
        text = text.replace(/&/g, '&amp;');
        showTooltip(this.actor, x, y, false /*don't center tooltip on x*/, text);
        return Clutter.EVENT_STOP;
    }

    handleLeave() {
        if (this.applet.display.contextMenu.isOpen) {
            return true;
        }
        this.has_focus = false;
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

class Separator { // creates a faint line (St.BoxLayout) used to separate items on the sidebar
    constructor (applet) {
        this.applet = applet;
        this.separator = new St.BoxLayout({x_expand: false, y_expand: false});

        const getThemeForegroundColor = () => {
            return this.applet.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        }

        let width = this.applet.settings.sidebarIconSize + 8;
        let height = 2;
        if (this.applet.settings.sidebarPlacement === SidebarPlacement.TOP ||
                                        this.applet.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
            [width, height] = [height, width];
        }
        this.separator.style = `width: ${width}px; height: ${height}px; background-color: ${
                    getThemeForegroundColor()}; margin: 1px; border: 0px; border-radius: 10px; `;
        this.separator.set_opacity(35);
    }

    destroy() {
        this.separator.destroy();
    }
}

//Creates the sidebar. Creates SidebarButtons and populates the sidebar.
class Sidebar {
    constructor (applet) {
        this.applet = applet;
        this.items = [];
        this.innerBox = new St.BoxLayout({
            vertical: (this.applet.settings.sidebarPlacement === SidebarPlacement.LEFT
            || this.applet.settings.sidebarPlacement === SidebarPlacement.RIGHT)
        });

        this.sidebarScrollBox = new St.ScrollView({ y_align: St.Align.MIDDLE, style_class: 'vfade gridmenu-sidebar-scrollbox' });
        this.sidebarScrollBox.add_actor(this.innerBox);
        this.sidebarScrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.NEVER);
        this.sidebarScrollBox.set_clip_to_allocation(true);
        this.sidebarScrollBox.set_auto_scrolling(this.applet.settings.enableAutoScroll);
        this.sidebarScrollBox.set_mouse_scrolling(true);
        const style_class = this.applet.settings.useBoxStyle ? 'menu-favorites-box' : 'gridmenu-sidebar-box';
        this.sidebarOuterBox = new St.BoxLayout({style_class: style_class});
        this.sidebarOuterBox.add(this.sidebarScrollBox, { });
    }

    populate () {
        this.innerBox.remove_all_children();
        this.items.forEach(item => item.destroy());
        this.items = [];
        this.separator1Position = null;
        this.separator2Position = null;
        if (this.separator1) {
            this.separator1.destroy();
            this.separator1 = null;
        }
        if (this.separator2) {
            this.separator2.destroy();
            this.separator2 = null;
        }
        //----add session buttons to this.items[]
        const newSidebarIcon = (iconName) => {
            return new St.Icon({
                icon_name: iconName,
                icon_size: this.applet.settings.sidebarIconSize,
                icon_type: this.applet.settings.sidebarIconSize <= 24 ?
                            St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
            });
        };
        this.items.push(new SidebarButton(
            this.applet,
            newSidebarIcon('system-shutdown'),
            null,
            _('Quit'),
            _('Shutdown the computer'),
            () => {
                this.applet.menu.close();
                this.applet.sessionManager.ShutdownRemote();
            }
        ));
        this.items.push(new SidebarButton(
            this.applet,
            newSidebarIcon('system-log-out'),
            null,
            _('Logout'),
            _('Leave the session'),
            () => {
                this.applet.menu.close();
                this.applet.sessionManager.LogoutRemote(0);
            }
        ));
        this.items.push(new SidebarButton(
            this.applet,
            newSidebarIcon('system-lock-screen'),
            null, _('Lock screen'),
            _('Lock the screen'),
            () => {
                const cinnamonVersion = Config.PACKAGE_VERSION;
                if (Util.version_exceeds(cinnamonVersion, '6.7')) {
                    Main.screensaverController.lockScreen(true);
                } else {
                    const screensaver_settings = new Gio.Settings({
                                                schema_id: 'org.cinnamon.desktop.screensaver' });
                    const screensaver_dialog = GLib.find_program_in_path("cinnamon-screensaver-command");
                    if (screensaver_dialog) {
                        if (screensaver_settings.get_boolean('ask-for-away-message')) {
                            Util.spawn(['cinnamon-screensaver-lock-dialog']);
                        } else {
                            Util.spawn(['cinnamon-screensaver-command', '--lock']);//
                        }
                    } else {
                        this.screenSaverProxy.LockRemote('');
                    }
                }
                this.applet.menu.close();
            }
        ));
        //----add favorite apps to this.items[]
        if (this.applet.settings.sidebarFavorites === 1 //Apps only
                    || this.applet.settings.sidebarFavorites === 3) { // Apps and files
            this.applet.listFavoriteApps().forEach(fav => {
                if (!this.separator1Position) {
                    this.separator1Position = this.items.length;
                }
                this.items.push(new SidebarButton(
                    this.applet,
                    this.applet.getAppIcon(fav, this.applet.settings.sidebarIconSize),
                    fav,
                    fav.name,
                    fav.description,
                    null
                ));
            });
        }
        //----add favorite files to this.items[]
        if (this.applet.settings.sidebarFavorites === 2 // Files only
                    || this.applet.settings.sidebarFavorites === 3) { // Apps and files
            this.applet.listFavoriteFiles().forEach(fav => {
                if (!this.separator2Position) {
                    this.separator2Position = this.items.length;
                }
                const icon = new St.Icon({ gicon: fav.gicon, icon_size: this.applet.settings.sidebarIconSize });
                const sidebarButton = new SidebarButton(
                    this.applet,
                    icon,
                    fav,
                    fav.name,
                    fav.description,
                    null
                );
                this.items.push(sidebarButton);

                getThumbnail_gicon(fav.uri, fav.mimeType, (thumbnailGicon) => {
                    if (thumbnailGicon && icon) {
                        icon.gicon = thumbnailGicon;
                    }
                });
            });
        }
        //----change order of all items depending on buttons placement
        const reverseOrder = this.applet.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                    this.applet.settings.sidebarPlacement === SidebarPlacement.RIGHT;
        if (reverseOrder) {
            this.items.reverse();
        }

        if (this.separator1Position) {
            this.separator1 = new Separator(this.applet);
        }
        if (this.separator2Position) {
            this.separator2 = new Separator(this.applet);
        }

        //----populate box with items[]
        for (let i = 0; i < this.items.length; i++) {
            if (this.separator1Position &&
                ((reverseOrder && i == this.items.length - this.separator1Position) ||
                    (!reverseOrder && i === this.separator1Position))){
                this.innerBox.add(this.separator1.separator, {
                    x_fill: false,
                    y_fill: false,
                    x_align: St.Align.MIDDLE,
                    y_align: St.Align.MIDDLE
                });
            }
            if (this.separator2Position &&
                ((reverseOrder && i == this.items.length - this.separator2Position) ||
                    (!reverseOrder && i === this.separator2Position))){
                this.innerBox.add(this.separator2.separator, {
                    x_fill: false,
                    y_fill: false,
                    x_align: St.Align.MIDDLE,
                    y_align: St.Align.MIDDLE
                });
            }
            this.innerBox.add(this.items[i].actor, {
                x_fill: false,
                y_fill: false,
                x_align: St.Align.MIDDLE,
                y_align: St.Align.MIDDLE
            });
        }

        return;
    }

    scrollToQuitButton() {
        scrollToButton(this.items[this.items.length - 1], false);
    }

    getButtons() {
        return this.items;
    }

    leaveSidebarFocusedActor() {
        const foundItem = this.items.findIndex(button => button.has_focus);
        if (foundItem > -1) {
            this.items[foundItem].handleLeave();
        }
    }

    destroy() {
        this.items.forEach(item => item.destroy());
        this.items = null;
        if (this.separator1) {
            this.separator1.destroy();
        }
        if (this.separator2) {
            this.separator2.destroy();
        }
        this.innerBox.destroy();
        this.sidebarScrollBox.destroy();
        this.sidebarOuterBox.destroy();
    }
}

module.exports = {Sidebar};
