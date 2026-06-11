/**
 * favoritebox.js  —  Cinnamenu "Favorite Box"
 */

const Gio             = imports.gi.Gio;
const Gtk             = imports.gi.Gtk;
const GLib            = imports.gi.GLib;
const Clutter         = imports.gi.Clutter;
const St              = imports.gi.St;
const Atk             = imports.gi.Atk;
const Util            = imports.misc.util;
const Main            = imports.ui.main;
const {getAppFavorites} = imports.ui.appFavorites;
const {SignalManager} = imports.misc.signalManager;
const {makeDraggable, DragMotionResult} = imports.ui.dnd;

let AccountsService, UserWidget;
try {
    AccountsService = imports.gi.AccountsService;
    UserWidget      = imports.ui.userWidget;
} catch(e) {
    AccountsService = null;
    UserWidget      = null;
}

const {_, showTooltip, hideTooltipIfVisible} = require('./utils');

class FavAppButton {
    constructor(appThis, app) {
        this.appThis   = appThis;
        this.app       = app;
        this.has_focus = false;
        this._signals  = new SignalManager(null);

        const iconSize = appThis.settings.favBoxIconSize || 36;

        this.actor = new St.BoxLayout({
            style_class: 'appmenu-sidebar-button menu-favorites-button',
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM,
        });

        this.icon = app.create_icon_texture(iconSize);
        this.actor.add_actor(this.icon);

        this.actor._delegate = {
            handleDragOver: (source) => {
                if (source.isDraggableApp && source.id !== app.id) {
                    this.actor.set_opacity(40);
                    return DragMotionResult.MOVE_DROP;
                }
                return DragMotionResult.NO_DROP;
            },
            handleDragOut:  () => { this.actor.set_opacity(255); },
            acceptDrop: (source) => {
                if (source.isDraggableApp && source.id !== app.id) {
                    this.actor.set_opacity(255);
                    this.appThis.addFavoriteAppToPos(source.id, app.id);
                    return true;
                }
                this.actor.set_opacity(255);
                return DragMotionResult.NO_DROP;
            },
            getDragActorSource: () => this.actor,
            _getDragActor: () => new Clutter.Clone({source: this.actor}),
            getDragActor:  () => new Clutter.Clone({source: this.icon}),
            id: app.id,
            isDraggableApp: true,
        };
        this.draggable = makeDraggable(this.actor);
        this._signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());

        this._signals.connect(this.actor, 'enter-event', (...a) => this._onEnter(...a));
        this._signals.connect(this.actor, 'leave-event', () => this._onLeave());
        this._signals.connect(this.actor, 'button-release-event', (...a) => this._onRelease(...a));
    }

    _onEnter(actor, event) {
        if (this.has_focus) return Clutter.EVENT_PROPAGATE;
        this.has_focus = true;
        this.appThis.display.clearFocusedActors();
        this.actor.add_style_pseudo_class('hover');
        showTooltip(this.actor, event, _(this.app.name), _(this.app.description || ''));
        return Clutter.EVENT_PROPAGATE;
    }

    _onLeave() {
        this.has_focus = false;
        this.actor.remove_style_pseudo_class('hover');
        hideTooltipIfVisible();
    }

    _onRelease(actor, e) {
        if (this.appThis.display.contextMenu.isOpen) {
            this.appThis.display.contextMenu.close();
            return Clutter.EVENT_STOP;
        }
        const btn = e.get_button();
        if (btn === Clutter.BUTTON_PRIMARY) {
            this.appThis.launchApp(this.app);
            return Clutter.EVENT_STOP;
        } else if (btn === Clutter.BUTTON_SECONDARY) {
            this.appThis.display.contextMenu.openApp(this.app, e, this.actor);
            return Clutter.EVENT_STOP;
        }
    }

    destroy() {
        this._signals.disconnectAllSignals();
        this.icon.destroy();
        this.actor.destroy();
    }
}

class FavBoxSystemButton {
    constructor(appThis, iconName, name, desc, callback) {
        this.appThis   = appThis;
        this.has_focus = false;
        this._signals  = new SignalManager(null);

        const iconSize = appThis.settings.favBoxIconSize || 36;
        const icon = new St.Icon({
            icon_name: iconName,
            icon_size: iconSize,
            icon_type: iconSize <= 24 ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR,
        });

        this.actor = new St.BoxLayout({
            style_class: 'appmenu-system-button menu-system-button',
            reactive: true,
            accessible_role: Atk.Role.PUSH_BUTTON,
        });
        this.actor.add_actor(icon);

        this._signals.connect(this.actor, 'enter-event', (a, event) => {
            this.has_focus = true;
            this.actor.add_style_pseudo_class('hover');
            showTooltip(this.actor, event, _(name), _(desc));
        });
        this._signals.connect(this.actor, 'leave-event', () => {
            this.has_focus = false;
            this.actor.remove_style_pseudo_class('hover');
            hideTooltipIfVisible();
        });
        this._signals.connect(this.actor, 'button-release-event', (a, e) => {
            if (appThis.display.contextMenu.isOpen) {
                appThis.display.contextMenu.close();
                return Clutter.EVENT_STOP;
            }
            if (e.get_button() === Clutter.BUTTON_PRIMARY) {
                callback();
                return Clutter.EVENT_STOP;
            }
        });
    }

    destroy() {
        this._signals.disconnectAllSignals();
        this.actor.destroy();
    }
}

class FavoriteBox {
    constructor(appThis) {
        this.appThis    = appThis;
        this._signals   = new SignalManager(null);
        this._favBtns   = [];
        this._sysBtns   = [];

        this.actor = new St.BoxLayout({
            style_class: 'appmenu-sidebar menu-favbox',
            vertical: true,
            reactive: false,
        });

        this._buildUserBox();

        // Increased spacing between avatar and favorite apps
        this.avatarSpacer = new St.BoxLayout({ style: 'height: 16px;', x_expand: true });
        this.avatarSep = this._makeSep();

        // Favorite apps scroll view - with scrolling
        this.favAppsInner = new St.BoxLayout({ vertical: true });

        this.favAppsScrollBox = new St.BoxLayout({
            style_class: 'appmenu-sidebar-scrollbox',
            vertical: true,
        });
        this.favAppsScrollBox.add(this.favAppsInner, { expand: true });

        this.favAppsScrollView = new St.ScrollView({
            y_align: St.Align.START,
            style_class: 'appmenu-sidebar-scrollview',
        });
        this.favAppsScrollView.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.favAppsScrollView.add_actor(this.favAppsScrollBox);
        this.favAppsScrollView.get_vscroll_bar().hide();

        this.sysSep = this._makeSep();

        this.systemButtonsBox = new St.BoxLayout({
            style_class: 'appmenu-system-box menu-system-buttons-box',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        // Assemble with proper spacing
        this.actor.add(this.userBox,         { x_fill: true,  y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.START });
        this.actor.add(this.avatarSpacer,    { x_fill: true,  y_fill: false });
        this.actor.add(this.avatarSep,       { x_fill: true,  y_fill: false });
        this.actor.add(this.favAppsScrollView, { expand: true, x_fill: true, y_fill: true });
        this.actor.add(this.sysSep,          { x_fill: true,  y_fill: false });
        this.actor.add(this.systemButtonsBox,{ x_fill: true,  y_fill: false, x_align: St.Align.MIDDLE });
    }

    _buildUserBox() {
        this.userBox = new St.BoxLayout({
            style_class: 'appmenu-sidebar-user-box',
            vertical: true,
            reactive: false,
        });

        if (!AccountsService || !UserWidget) return;

        try {
            const user = AccountsService.UserManager.get_default()
                            .get_user(GLib.get_user_name());
            this.userIcon = new UserWidget.UserWidget(user, Clutter.Orientation.VERTICAL, false);
            const avatarSize = 52;
            this.userIcon.set_size(avatarSize, avatarSize);
            this.userIcon.add_style_class_name('menu-favbox-avatar-btn');
            
            this.userIcon.set_reactive(true);
            this.userIcon.track_hover = true;
            this.userIcon.set_accessible_role(Atk.Role.BUTTON);
            this.userIcon.set_accessible_name(_('Account details'));
            
            this._signals.connect(this.userIcon, 'button-press-event', () => {
                this.appThis.menu.toggle();
                Util.spawnCommandLine('cinnamon-settings user');
            });
            this.userBox.add(this.userIcon, { x_fill: false, x_align: St.Align.MIDDLE });
        } catch(e) {}
    }

    _makeSep() {
        const sep = new St.BoxLayout({ x_expand: true, y_expand: false });
        sep.style = 'height:1px; background-color:rgba(255,255,255,0.12); margin:6px 8px;';
        return sep;
    }

    setAvailableHeight(height) {
        const RESERVED_FOR_OTHER = 220;
        const favHeight = Math.max(80, height - RESERVED_FOR_OTHER);
        this.favAppsScrollView.set_height(favHeight);
    }

    populate() {
        this.favAppsInner.remove_all_children();
        this._favBtns.forEach(b => b.destroy());
        this._favBtns = [];

        this.systemButtonsBox.remove_all_children();
        this._sysBtns.forEach(b => b.destroy());
        this._sysBtns = [];

        const showAvatar = this.appThis.settings.showFavBoxAvatar !== false;
        const showApps   = this.appThis.settings.showFavBoxApps   !== false;

        if (showAvatar && this.userBox) {
            this.userBox.show();
            this.avatarSpacer.show();
            this.avatarSep.show();
        } else {
            if (this.userBox) this.userBox.hide();
            this.avatarSpacer.hide();
            this.avatarSep.hide();
        }

        if (showApps) {
            this.favAppsScrollView.show();
        } else {
            this.favAppsScrollView.hide();
        }

        if (showApps) {
            try {
                const favs = getAppFavorites().getFavoriteMap();
                for (let id in favs) {
                    const app = favs[id];
                    const btn = new FavAppButton(this.appThis, app);
                    this._favBtns.push(btn);
                    this.favAppsInner.add(btn.actor, {
                        x_fill: false, y_fill: false,
                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
                    });
                }
            } catch(e) {}
        }

        const sysDefs = [
            {
                icon: 'system-lock-screen',
                name: _('Lock screen'), desc: _('Lock the screen'),
                cb: () => {
                    const ss = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.screensaver' });
                    const dlg = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
                    if (dlg.query_exists(null)) {
                        if (ss.get_boolean('ask-for-away-message'))
                            Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
                        else
                            Util.spawnCommandLine('cinnamon-screensaver-command --lock');
                    } else {
                        this.appThis.screenSaverProxy.LockRemote('');
                    }
                    this.appThis.menu.close();
                },
            },
            {
                icon: 'system-log-out',
                name: _('Logout'), desc: _('Leave the session'),
                cb: () => {
                    this.appThis.menu.close();
                    this.appThis.sessionManager.LogoutRemote(0);
                },
            },
            {
                icon: 'system-shutdown',
                name: _('Shutdown'), desc: _('Shutdown the computer'),
                cb: () => {
                    this.appThis.menu.close();
                    this.appThis.sessionManager.ShutdownRemote();
                },
            },
        ];

        sysDefs.forEach(({icon, name, desc, cb}) => {
            const btn = new FavBoxSystemButton(this.appThis, icon, name, desc, cb);
            this._sysBtns.push(btn);
            this.systemButtonsBox.add(btn.actor, {
                x_fill: false, y_fill: false,
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
            });
        });
    }

    getButtons() { return this._favBtns; }
    
    clearSidebarFocusedActors() {
        this._favBtns.forEach(b => { if (b.has_focus) b._onLeave(); });
        this._sysBtns.forEach(b => {
            if (b.has_focus) {
                b.has_focus = false;
                b.actor.remove_style_pseudo_class('hover');
            }
        });
    }
    
    scrollToQuitButton() {}

    destroy() {
        this._signals.disconnectAllSignals();
        this._favBtns.forEach(b => b.destroy()); this._favBtns = [];
        this._sysBtns.forEach(b => b.destroy()); this._sysBtns = [];
        if (this.userIcon) this.userIcon.destroy();
        if (this.userBox) this.userBox.destroy();
        if (this.avatarSpacer) this.avatarSpacer.destroy();
        if (this.favAppsInner) this.favAppsInner.destroy();
        if (this.favAppsScrollBox) this.favAppsScrollBox.destroy();
        if (this.favAppsScrollView) this.favAppsScrollView.destroy();
        if (this.systemButtonsBox) this.systemButtonsBox.destroy();
        if (this.actor) this.actor.destroy();
    }
}

module.exports = {FavoriteBox};
