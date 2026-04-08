const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const St = imports.gi.St;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;
const GLib = imports.gi.GLib;

const { _,
        wordWrap,
        getThumbnail_gicon,
        showTooltip,
        hideTooltipIfVisible,
        scrollToButton} = require('./utils');
const SidebarPlacement = Object.freeze({ TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});
const DescriptionPlacement = Object.freeze({TOOLTIP: 0, UNDER: 1, NONE: 2});

class SidebarButton {
    constructor(appThis, icon, app, name, description, callback, isUser = false) {
        //super({ hover: false, activate: false });
        this.appThis = appThis;
        this.signals = new SignalManager(null);
        this.app = app;
        this.name = name;
        this.description = description;
        this.callback = callback;
        this.isUser = isUser;

        this.holdTimeoutId = null; // tracks the 3-second hold
        this.holding = false;      // flag while holding
        this.pressed = false;      // used to differenciate pressing/holding the user icon.

        this.actor = new St.BoxLayout({
          style_class: 'menu-favorites-button',
          reactive: true,
          vertical: false,
          x_align: Clutter.ActorAlign.START,
          y_align: Clutter.ActorAlign.CENTER,
          accessible_role: Atk.Role.MENU_ITEM
        });

// Note the border radius (edges) for the Sidebar buttons are fixed in the sidevar.js file to stop the GTK theme over-riding
        this.actor.set_style('border-radius: 8px;'); // overide GTK Theme

        this.has_focus = false;
        if (icon) {
          this.icon = icon;
          this.actor.add_actor(this.icon);
        }

// Only show label if showSidebarLabels is true OR this is the user button
        this.label = new St.Label({ text: this.name, y_align: Clutter.ActorAlign.CENTER });

// Hide labels if disabled (EXCEPT user button)
        if (!this.appThis.settings.showSidebarLabels && !this.isUser) {
            this.label.visible = false;
            this.label.width = 0;
        }


        let style = "margin-left: 6px;"; //  ALWAYS keep margin

//  ONLY scale font for user avatar
        if (this.isUser && this.appThis.settings.useUserAvatar) {
        const baseSize = 14;
        const avatarSize = this.appThis.settings.userAvatarSize;
        const scale = avatarSize / baseSize;
        let fontPx = 5 * scale; // Convert scale → px (default font ≈ 16px in Cinnamon)

        fontPx = Math.max(fontPx, 14); // enforce minimum size

        style += ` font-size: ${fontPx}px;`;
        }

        this.label.set_style(style);
        this.actor.add_actor(this.label);

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
        }

        this.signals.connect(this.actor, 'enter-event', (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'leave-event', () => {
        this.pressed = false;
        });
        this.signals.connect(this.actor, 'button-release-event',
                                                (...args) => this._handleButtonRelease(...args));
        // Only for the user icon button
        if (this.isUser) {
        this.signals.connect(this.actor, 'button-press-event', (actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                this.pressed = true;      // mark as pressed
                this.holding = false;
            this.holdTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {

            // ONLY run if STILL pressed
            if (!this.pressed) {
                this.holdTimeoutId = null;
                return GLib.SOURCE_REMOVE;
            }

            this.holding = true;

            this.appThis.settings.showCategories = !this.appThis.settings.showCategories;

            if (this.appThis.display && this.appThis.display.categoriesView) {
                this.appThis.display.categoriesView.groupCategoriesWorkspacesScrollBox
                    .set_width(this.appThis.settings.showCategories ? -1 : 0);
                this.appThis.display.categoriesView.groupCategoriesWorkspacesScrollBox
                    .visible = this.appThis.settings.showCategories;
                this.appThis.display.categoriesView.update();
            }

        // Adjust AppsSpacer width for AppsSpacer defined in Display.js
            if (this.appThis.display && this.appThis.display.AppsSpacer) {
                this.appThis.display.AppsSpacer.width = this.appThis.settings.showCategories ? 0 : 32;
            }

            this.holdTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
        }

        return Clutter.EVENT_PROPAGATE;
        });

        this.signals.connect(this.actor, 'button-release-event', (actor, event) => {
        this.pressed = false;   // ALWAYS clear press state
        if (this.holdTimeoutId) {
          GLib.source_remove(this.holdTimeoutId);
          this.holdTimeoutId = null;
        }

        if (this.holding) {
          this.holding = false;
          return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
        });
      }
     }

    _handleButtonRelease(actor, e) {
        // Prevent normal click if this was a hold action
        if (this.isUser && this.holding) {
            this.holding = false; // reset flag
            return Clutter.EVENT_STOP;
        }

        if (this.appThis.display.contextMenu.isOpen) {
            this.appThis.display.contextMenu.close();
            this.appThis.display.clearFocusedActors();
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

        // CRITICAL: always clear press state
        this.pressed = false;

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
        this.appThis.display.contextMenu.openApp(this.app, e, this.actor);
    }

    handleEnter(actor, event) {
        if (this.appThis.display.contextMenu.isOpen) {
            return true;
        }

        if (event) {//mouse event
            this.appThis.display.clearFocusedActors();
        } else {//key nav
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }

        this.has_focus = true;
        this.actor.add_style_pseudo_class('hover');

        //show tooltip
        if (this.appThis.settings.descriptionPlacement === DescriptionPlacement.NONE) {
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
        if (this.appThis.display.contextMenu.isOpen) {
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

class Separator { //creates a faint line (St.BoxLayout) used to separate items on the sidebar
    constructor (appThis) {
        this.appThis = appThis;
        this.separator = new St.BoxLayout({x_expand: false, y_expand: false});

        const getThemeForegroundColor = () => {
            return this.appThis.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        }

        let width = this.appThis.settings.sidebarIconSize + 8;
        let height = 2;
        if (this.appThis.settings.sidebarPlacement === SidebarPlacement.TOP ||
                                        this.appThis.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
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
    constructor (appThis) {
        this.appThis = appThis;
        this.items = [];
        this.innerBox = new St.BoxLayout({
                        vertical: (this.appThis.settings.sidebarPlacement === SidebarPlacement.LEFT
                        || this.appThis.settings.sidebarPlacement === SidebarPlacement.RIGHT) });

        // Cinnamox themes draw a border at the bottom of sidebarScrollBox so
        // remove menu-favorites-scrollbox class.
        let themePath = Main.getThemeStylesheet();
        if (!themePath) themePath = '';
        const scroll_style = themePath.includes('Cinnamox') ? 'vfade' : 'vfade menu-favorites-scrollbox';
        this.sidebarScrollBox = new St.ScrollView({ y_align: St.Align.MIDDLE, style_class: scroll_style });

        this.sidebarScrollBox.add_actor(this.innerBox);
        this.sidebarScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.sidebarScrollBox.set_clip_to_allocation(true);
        this.sidebarScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.sidebarScrollBox.set_mouse_scrolling(true);
        const style_class = this.appThis.settings.useBoxStyle ? 'menu-favorites-box' : '';
        this.sidebarOuterBox = new St.BoxLayout({style_class: style_class});
        this.sidebarOuterBox.add(this.sidebarScrollBox, { });
        if (!this.appThis.settings.showSidebar) {
            this.sidebarScrollBox.width = 0;
            this.sidebarScrollBox.height = 0;
        }
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
                    icon_size: this.appThis.settings.sidebarIconSize,
                    icon_type: this.appThis.settings.sidebarIconSize <= 24 ?
                                                St.IconType.SYMBOLIC : St.IconType.FULLCOLOR });
        };

        let username = GLib.get_user_name();

        this.items.push(new SidebarButton(
        this.appThis,
        (() => {
        if (this.appThis.settings.useUserAvatar) {
            const facePath = GLib.build_filenamev([GLib.get_home_dir(), '.face']);
            const file = Gio.file_new_for_path(facePath);

            if (file.query_exists(null)) {
                return new St.Icon({
                    gicon: new Gio.FileIcon({ file }),
                    icon_size: this.appThis.settings.userAvatarSize, // set the avatar size
                    icon_type: St.IconType.FULLCOLOR
                });
            }
        }

        return newSidebarIcon('avatar-default-symbolic');
        })(),
        null, username,_('Account details'),() => {
        this.appThis.menu.close();
        Util.spawnCommandLine("cinnamon-settings user");
        }, true
        ));

        //----add favorite apps to this.items[]
        if (this.appThis.settings.sidebarFavorites === 1 //Apps only
                    || this.appThis.settings.sidebarFavorites === 3) { // Apps and files
            this.appThis.listFavoriteApps().forEach(fav => {
                if (!this.separator1Position) {
                    this.separator1Position = this.items.length;
                }
                this.items.push(new SidebarButton( this.appThis,
                                fav.create_icon_texture(this.appThis.settings.sidebarIconSize),
                                        fav, fav.name, fav.description, null));
            });
        }
        //----add favorite files to this.items[]
        if (this.appThis.settings.sidebarFavorites === 2 //Files only
                    || this.appThis.settings.sidebarFavorites === 3) { // Apps and files
            this.appThis.listFavoriteFiles().forEach(fav => {
                if (!this.separator2Position) {
                    this.separator2Position = this.items.length;
                }
                let gicon = getThumbnail_gicon(fav.uri, fav.mimeType) || fav.gicon;
                this.items.push(new SidebarButton( this.appThis,
                        new St.Icon({ gicon: gicon, icon_size: this.appThis.settings.sidebarIconSize}),
                        fav, fav.name, fav.description, null));
            });
        }

        this.items.push(new SidebarButton(
                    this.appThis, newSidebarIcon('utilities-terminal-symbolic'),
                    null,
                    _('Terminal'),
                    _('Open Terminal App'),
                    () => {
                        this.appThis.menu.close();
                        Util.spawnCommandLine("gnome-terminal");
                    }));

        this.items.push(new SidebarButton(
                    this.appThis, newSidebarIcon('preferences-system-symbolic'),
                    null,
                    _('System'),
                    _('Open System Settings'),
                    () => {
                        this.appThis.menu.close();
                        Util.spawnCommandLine("cinnamon-settings");
                    }));

        if (this.appThis.settings.showlogoutlockscreen) { // If Show the showlogoutlockscreen is selected it will display the icon
        this.items.push(new SidebarButton(
                    this.appThis, newSidebarIcon('system-log-out'),
                    null,
                    _('Logout'),
                    _('Leave the session'),
                    () => {
                        this.appThis.menu.close();
                        this.appThis.sessionManager.LogoutRemote(0);
                    }));
        }

        if (this.appThis.settings.showlogoutlockscreen) { // If Show the showlogoutlockscreen is selected it will display the icon
        this.items.push(new SidebarButton(
            this.appThis,
            newSidebarIcon('system-lock-screen'),
            null, _('Lock screen'),
            _('Lock the screen'),
            () => {
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
                this.appThis.menu.close();
            }
        ));
        }
        this.items.push(new SidebarButton(
                    this.appThis,
                    newSidebarIcon('system-shutdown'),
                    null,
                    _('Quit'),
                    _('Shutdown the computer'),
                    () => {
                        this.appThis.menu.close();
                        this.appThis.sessionManager.ShutdownRemote();
                    }));


        //----change order of all items depending on buttons placement
        const reverseOrder = this.appThis.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                    this.appThis.settings.sidebarPlacement === SidebarPlacement.RIGHT;
        if (reverseOrder) {
            this.items.reverse();
        }
        
        if (this.separator1Position) {
            this.separator1 = new Separator(this.appThis);
        }
        if (this.separator2Position) {
            this.separator2 = new Separator(this.appThis);
        }
        
        //----populate box with items[]
//----populate box with items[]

const isHorizontal =
    this.appThis.settings.sidebarPlacement === SidebarPlacement.TOP ||
    this.appThis.settings.sidebarPlacement === SidebarPlacement.BOTTOM;

    if (isHorizontal) {
    // Create left, spacer, right containers
    const leftBox = new St.BoxLayout({ x_expand: false, y_expand: true });
    const spacer = new St.BoxLayout({ x_expand: true, y_expand: true });
    const isHorizontal =
    this.appThis.settings.sidebarPlacement === SidebarPlacement.TOP ||
    this.appThis.settings.sidebarPlacement === SidebarPlacement.BOTTOM;

    const rightBox = new St.BoxLayout({ x_expand: false, y_expand: true,
            style: isHorizontal && !this.appThis.settings.showSidebarLabels ? 'spacing: 24px;' : ''
    });

    // First item = USER (always pushed first in your code)
    if (this.items.length > 0) {
        leftBox.add(this.items[0].actor, {
            x_fill: false,
            y_fill: false,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });
    }

    // All remaining items → RIGHT
    for (let i = 1; i < this.items.length; i++) {

        if (this.separator1Position &&
            ((reverseOrder && i == this.items.length - this.separator1Position) ||
             (!reverseOrder && i === this.separator1Position))) {
            rightBox.add(this.separator1.separator, {
                x_fill: false,
                y_fill: false,
                x_align: St.Align.MIDDLE,
                y_align: St.Align.MIDDLE
            });
        }

        if (this.separator2Position &&
            ((reverseOrder && i == this.items.length - this.separator2Position) ||
             (!reverseOrder && i === this.separator2Position))) {
            rightBox.add(this.separator2.separator, {
                x_fill: false,
                y_fill: false,
                x_align: St.Align.MIDDLE,
                y_align: St.Align.MIDDLE
            });
        }

        rightBox.add(this.items[i].actor, {
            x_fill: false,
            y_fill: false,
            x_align: St.Align.END,
            y_align: St.Align.MIDDLE
        });
    }

    // Add to main container
    this.innerBox.add(leftBox);
    this.innerBox.add(spacer);   // pushes rightBox to the far right
    this.innerBox.add(rightBox);

} else {
    // ORIGINAL vertical behavior (UNCHANGED)
    for (let i = 0; i < this.items.length; i++) {
        if (this.separator1Position && 
            ((reverseOrder && i == this.items.length - this.separator1Position) ||
                (!reverseOrder && i === this.separator1Position))){
            this.innerBox.add(this.separator1.separator, {x_fill: false, y_fill: false,
                                                          x_align: St.Align.MIDDLE,
                                                          y_align: St.Align.MIDDLE });
        }
        if (this.separator2Position && 
            ((reverseOrder && i == this.items.length - this.separator2Position) ||
                (!reverseOrder && i === this.separator2Position))){
            this.innerBox.add(this.separator2.separator, {x_fill: false, y_fill: false,
                                                          x_align: St.Align.MIDDLE,
                                                          y_align: St.Align.MIDDLE });
        }
        this.innerBox.add(this.items[i].actor, {
            x_fill: false,
            y_fill: false,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });
    }
}

        return;
    }

    scrollToQuitButton() {
        scrollToButton(this.items[this.items.length - 1], false);
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
