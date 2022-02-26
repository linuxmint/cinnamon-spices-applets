const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const St = imports.gi.St;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const {_, wordWrap, getThumbnail_gicon, showTooltip, hideTooltipIfVisible} = require('./utils');
const SidebarPlacement = Object.freeze({ TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});

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
        this.has_focus = false;
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
        if (this.appThis.contextMenu.isOpen) {
            this.appThis.contextMenu.close();
            this.appThis.clearFocusedActors();
            this.handleEnter();
            return Clutter.EVENT_STOP;
        }

        const button = e.get_button();
        if (button === 1) {//left click
            this.activate();
            return Clutter.EVENT_STOP;
        } else if (button === 3) {//right click
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
            this.appThis.recentApps.add(this.app.id);
            this.app.open_new_window(-1);
            this.appThis.menu.close();
        } else if (this.app.isFavoriteFile) {
            try {
                Gio.app_info_launch_default_for_uri(this.app.uri, global.create_app_launch_context());
                this.appThis.menu.close();
            } catch (e) {
                Main.notify(_('Error while opening file:'), e.message);
            }
        }
    }

    openContextMenu(e) {
        hideTooltipIfVisible();
        this.appThis.contextMenu.open(this.app, e, this.actor);
    }

    handleEnter(actor, event) {
        if (this.appThis.contextMenu.isOpen) {
            return true;
        }

        if (event) {//mouse event
            this.appThis.clearFocusedActors();
        } else {//key nav
            this.appThis.scrollToButton(this, this.appThis.settings.enableAnimation);
        }

        this.has_focus = true;
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

//Creates the sidebar. Creates SidebarButtons and populates the sidebar.
class Sidebar {
    constructor (appThis, sidebarPlacement) {
        this.appThis = appThis;
        this.items = [];
        this.innerBox = new St.BoxLayout({
                        vertical: (sidebarPlacement === SidebarPlacement.LEFT || sidebarPlacement === SidebarPlacement.RIGHT) });

        //Cinnamox themes draw a border at the bottom of sidebarScrollBox so remove menu-favorites-scrollbox class.
        let themePath = Main.getThemeStylesheet();
        if (!themePath) themePath = '';
        const scroll_style = themePath.includes('Cinnamox') ? 'vfade' : 'vfade menu-favorites-scrollbox';
        this.sidebarScrollBox = new St.ScrollView({ y_align: St.Align.MIDDLE, style_class: scroll_style });

        this.sidebarScrollBox.add_actor(this.innerBox);
        this.sidebarScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.sidebarScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.sidebarScrollBox.set_mouse_scrolling(true);
        const style_class = this.appThis.settings.useBoxStyle ? 'menu-favorites-box' : '';
        this.sidebarOuterBox = new St.BoxLayout({style_class: style_class});
        this.sidebarOuterBox.add(this.sidebarScrollBox, { });

        this.separator = new St.BoxLayout({x_expand: false, y_expand: false});
    }

    populate () {
        this.innerBox.remove_all_children();
        this.items.forEach(item => item.destroy());
        this.items = [];
        //----add sidebar buttons to this.items[]
        const newSidebarIcon = (iconName) => {
            return new St.Icon( { icon_name: iconName, icon_size: this.appThis.settings.sidebarIconSize,
                          icon_type: this.appThis.settings.sidebarIconSize <= 24 ? St.IconType.SYMBOLIC :
                                                                                    St.IconType.FULLCOLOR });
        };
        this.items.push(new SidebarButton( this.appThis, newSidebarIcon('system-shutdown'), null, _('Quit'),
                    _('Shutdown the computer'), () => { Util.spawnCommandLine('cinnamon-session-quit --power-off');
                                                                this.appThis.menu.close(); } ));
        this.items.push(new SidebarButton( this.appThis, newSidebarIcon('system-log-out'), null, _('Logout'),
                                    _('Leave the session'), () => { Util.spawnCommandLine('cinnamon-session-quit');
                                                                        this.appThis.menu.close(); } ));
        this.items.push(new SidebarButton( this.appThis, newSidebarIcon('system-lock-screen'), null, _('Lock screen'),
                    _('Lock the screen'), () => {
                        const screensaver_settings = new Gio.Settings({
                                                    schema_id: 'org.cinnamon.desktop.screensaver' });
                        const screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
                        if (screensaver_dialog.query_exists(null)) {
                            if (screensaver_settings.get_boolean('ask-for-away-message')) {
                                Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
                            } else {
                                Util.spawnCommandLine('cinnamon-screensaver-command --lock');//
                            }
                        } else {
                            this.screenSaverProxy.LockRemote('');
                        }
                        this.appThis.menu.close(); }));
        //----add favorite apps and favorite files to this.items[]
        if (this.appThis.settings.addFavorites) {
            this.appThis.listFavoriteApps().forEach(fav => {
                this.items.push(new SidebarButton( this.appThis,
                                fav.create_icon_texture(this.appThis.settings.sidebarIconSize),
                                        fav, fav.name, fav.description, null));
            });
            this.appThis.listFavoriteFiles().forEach(fav => {
                let gicon = getThumbnail_gicon(fav.uri, fav.mimeType) || fav.gicon;
                this.items.push(new SidebarButton( this.appThis,
                                new St.Icon({ gicon: gicon, icon_size: this.appThis.settings.sidebarIconSize}),
                                fav, fav.name, fav.description, null));
            });
        }
        //----change order of all items depending on buttons placement
        const reverseOrder = this.appThis.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                                this.appThis.settings.sidebarPlacement === SidebarPlacement.RIGHT;
        if (reverseOrder) {
            this.items.reverse();
        }
        //----populate box with items[]
        for (let i = 0; i < this.items.length; i++) {
            if ((reverseOrder && i == this.items.length - 3 && this.items.length > 3) ||
                        (!reverseOrder && i === 3 && this.items.length > 3)){
                this._addSeparator();
            }
            this.innerBox.add(this.items[i].actor, { x_fill: false, y_fill: false,
                                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        }

        return;
    }

    scrollToQuitButton() {
        //Scroll to quit button so that it's visible when the menu is opened.
        this.appThis.scrollToButton(this.items[this.items.length - 1], false);
    }

    _addSeparator() {
        this.innerBox.add(this.separator, { x_fill: false, y_fill: false, x_align: St.Align.MIDDLE,
                                                                                y_align: St.Align.MIDDLE });
        let width = this.appThis.settings.sidebarIconSize + 8;
        let height = 2;
        if (this.appThis.settings.sidebarPlacement === SidebarPlacement.TOP ||
                                        this.appThis.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
            [width, height] = [height, width];
        }
        this.separator.style = `width: ${width}px; height: ${height}px; background-color: ${
                    this.appThis.getThemeForegroundColor()}; margin: 1px; border: 0px; border-radius: 10px; `;
        this.separator.set_opacity(35);
    }

    getButtons() {
        return this.items;
    }

    clearSidebarFocusedActors() {
        const foundItem = this.items.findIndex(button => button.has_focus);
        if (foundItem > -1) {
            this.items[foundItem].handleLeave();
        }
    }

    destroy() {
        this.items.forEach(item => item.destroy());
        this.items = null;
        this.separator.destroy();
        this.innerBox.destroy();
        this.sidebarScrollBox.destroy();
        this.sidebarOuterBox.destroy();
    }
}

module.exports = {Sidebar};
