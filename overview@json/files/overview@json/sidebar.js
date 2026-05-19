const Gio    = imports.gi.Gio;
const Gtk    = imports.gi.Gtk;
const Atk    = imports.gi.Atk;
const Clutter= imports.gi.Clutter;
const Util   = imports.misc.util;
const St     = imports.gi.St;
const Main   = imports.ui.main;
const {SignalManager}   = imports.misc.signalManager;
const {DragMotionResult, makeDraggable} = imports.ui.dnd;

const { _,
        wordWrap,
        getThumbnail_gicon,
        showTooltip,
        hideTooltipIfVisible,
        scrollToButton } = require('./utils');

const SidebarPlacement   = Object.freeze({TOP:0, BOTTOM:1, LEFT:2, RIGHT:3});
const DescriptionPlacement = Object.freeze({TOOLTIP:0, UNDER:1, NONE:2});

/* ── SidebarButton (favorite apps / files) ───────────────────────────────── */
class SidebarButton {
    constructor(appThis, icon, app, name, description, callback) {
        this.appThis      = appThis;
        this.signals      = new SignalManager(null);
        this.app          = app;
        this.name         = name;
        this.description  = description;
        this.callback     = callback;
        this.has_focus    = false;

        this.actor = new St.BoxLayout({
            style_class: 'menu-favorites-button',
            reactive: true,
            accessible_role: Atk.Role.MENU_ITEM,
        });
        if (icon) {
            this.icon = icon;
            this.actor.add_actor(this.icon);
        }

        // DnD for application items
        if (this.app && this.app.isApplication) {
            this.actor._delegate = {
                handleDragOver: (source) => {
                    if (source.isDraggableApp && source.id !== this.app.id) {
                        this.actor.set_opacity(40);
                        return DragMotionResult.MOVE_DROP;
                    }
                    return DragMotionResult.NO_DROP;
                },
                handleDragOut: () => { this.actor.set_opacity(255); },
                acceptDrop: (source) => {
                    if (source.isDraggableApp && source.id !== this.app.id) {
                        this.actor.set_opacity(255);
                        this.appThis.addFavoriteAppToPos(source.id, this.app.id);
                        return true;
                    }
                    this.actor.set_opacity(255);
                    return DragMotionResult.NO_DROP;
                },
                getDragActorSource: () => this.actor,
                _getDragActor: () => new Clutter.Clone({source: this.actor}),
                getDragActor:  () => new Clutter.Clone({source: this.icon}),
                id: this.app.id,
                isDraggableApp: true,
            };
            this.draggable = makeDraggable(this.actor);
            this.signals.connect(this.draggable, 'drag-begin', () => hideTooltipIfVisible());
        }

        this.signals.connect(this.actor, 'enter-event',
            (...args) => this.handleEnter(...args));
        this.signals.connect(this.actor, 'leave-event',
            (...args) => this.handleLeave(...args));
        this.signals.connect(this.actor, 'button-release-event',
            (...args) => this._handleButtonRelease(...args));
    }

    _handleButtonRelease(actor, e) {
        if (this.appThis.display.contextMenu.isOpen) {
            this.appThis.display.contextMenu.close();
            this.appThis.display.clearFocusedActors();
            return Clutter.EVENT_STOP;
        }
        const button = e.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            if (this.callback)     this.callback();
            else if (this.app)     this.appThis.launchApp(this.app);
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_SECONDARY) {
            this.openContextMenu(e);
            return Clutter.EVENT_STOP;
        }
    }

    openContextMenu(e) {
        if (this.app) this.appThis.display.contextMenu.openApp(this.app, e, this.actor);
    }

    handleEnter(actor, event) {
        if (this.has_focus || this.appThis.display.contextMenu.isOpen)
            return Clutter.EVENT_PROPAGATE;
        this.has_focus = true;
        if (event) {
            this.appThis.display.clearFocusedActors();
            this.has_focus = true;
        } else {
            scrollToButton(this, this.appThis.settings.enableAnimation);
        }
        this.actor.add_style_pseudo_class('hover');
        if (this.description) showTooltip(this.actor, event, _(this.name), _(this.description));
        return Clutter.EVENT_PROPAGATE;
    }

    handleLeave() {
        this.has_focus = false;
        this.actor.remove_style_pseudo_class('hover');
        hideTooltipIfVisible();
    }

    destroy() {
        this.signals.disconnectAllSignals();
        if (this.icon) this.icon.destroy();
        this.actor.destroy();
    }
}

/* ── SystemButton (lock / logout / shutdown) ─────────────────────────────── */
class SystemButton {
    constructor(appThis, iconName, name, description, callback) {
        this.appThis   = appThis;
        this.signals   = new SignalManager(null);
        this.has_focus = false;

        const icon = new St.Icon({
            icon_name:  iconName,
            icon_size:  appThis.settings.sidebarIconSize,
            icon_type:  appThis.settings.sidebarIconSize <= 24
                            ? St.IconType.SYMBOLIC
                            : St.IconType.FULLCOLOR,
        });

        this.actor = new St.BoxLayout({
            style_class: 'menu-system-button',
            reactive: true,
            accessible_role: Atk.Role.PUSH_BUTTON,
        });
        this.actor.add_actor(icon);

        this.signals.connect(this.actor, 'enter-event', (a, event) => {
            if (this.appThis.display.contextMenu.isOpen) return;
            this.has_focus = true;
            this.actor.add_style_pseudo_class('hover');
            showTooltip(this.actor, event, _(name), _(description));
        });
        this.signals.connect(this.actor, 'leave-event', () => {
            this.has_focus = false;
            this.actor.remove_style_pseudo_class('hover');
            hideTooltipIfVisible();
        });
        this.signals.connect(this.actor, 'button-release-event', (a, e) => {
            if (this.appThis.display.contextMenu.isOpen) {
                this.appThis.display.contextMenu.close();
                return Clutter.EVENT_STOP;
            }
            if (e.get_button() === Clutter.BUTTON_PRIMARY) {
                callback();
                return Clutter.EVENT_STOP;
            }
        });
    }

    destroy() {
        this.signals.disconnectAllSignals();
        this.actor.destroy();
    }
}

/* ── Separator ───────────────────────────────────────────────────────────── */
class Separator {
    constructor(appThis) {
        this.appThis   = appThis;
        this.separator = new St.BoxLayout({ x_expand: false, y_expand: false });
        const fg = () => appThis.menu.actor.get_theme_node()
                            .get_foreground_color().to_string().substring(0, 7);
        this.separator.style =
            `width:${appThis.settings.sidebarIconSize + 8}px; height:2px;
             background-color:${fg()}; margin:1px; border:0px; border-radius:10px;`;
        this.separator.set_opacity(35);
    }
    destroy() { this.separator.destroy(); }
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
/*
 * Public actors exposed to display.js:
 *   • sidebarScrollBox    — favorite apps/files (vertical scroll column)
 *   • systemButtonsBox    — lock / logout / shutdown (horizontal strip)
 *   • sidebarOuterBox     — backward-compat wrapper (wraps sidebarScrollBox)
 *
 * NOTE: display.js no longer uses sidebarOuterBox for layout.
 *       It places sidebarScrollBox and systemButtonsBox independently
 *       inside sidebarPanel so each can be themed separately.
 *       systemButtonsBox is ALWAYS at the bottom of sidebarPanel.
 */
class Sidebar {
    constructor(appThis) {
        this.appThis     = appThis;
        this.items       = [];
        this.systemItems = [];

        // ── Favorites scroll box ──────────────────────────────────────────
        this.innerBox = new St.BoxLayout({ vertical: true });

        let themePath = Main.getThemeStylesheet();
        if (!themePath) themePath = '';
        const scrollStyle = themePath.includes('Cinnamox')
            ? 'vfade' : 'vfade menu-favorites-scrollbox';

        this.sidebarScrollBox = new St.ScrollView({
            y_align: St.Align.MIDDLE,
            style_class: scrollStyle,
        });
        this.sidebarScrollBox.add_actor(this.innerBox);
        this.sidebarScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.sidebarScrollBox.set_clip_to_allocation(true);
        this.sidebarScrollBox.set_auto_scrolling(appThis.settings.enableAutoScroll);
        this.sidebarScrollBox.set_mouse_scrolling(true);

        // sidebarOuterBox: backward-compat; wraps sidebarScrollBox
        const outerStyle = appThis.settings.useBoxStyle ? 'menu-favorites-box' : '';
        this.sidebarOuterBox = new St.BoxLayout({ style_class: outerStyle });
        this.sidebarOuterBox.add(this.sidebarScrollBox, {});

        // ── System buttons box — horizontal row, goes at BOTTOM ───────────
        // Horizontal so buttons sit side-by-side like in the reference image
        this.systemButtonsBox = new St.BoxLayout({
            style_class: 'menu-system-buttons-box',
            vertical: false,        // horizontal row
        });
    }

    populate() {
        // ── Clear favorites ───────────────────────────────────────────────
        this.innerBox.remove_all_children();
        this.items.forEach(i => i.destroy());
        this.items = [];
        if (this.separator1) { this.separator1.destroy(); this.separator1 = null; }
        if (this.separator2) { this.separator2.destroy(); this.separator2 = null; }
        this.separator1Position = null;
        this.separator2Position = null;

        // ── Clear system buttons ──────────────────────────────────────────
        this.systemButtonsBox.remove_all_children();
        this.systemItems.forEach(i => i.destroy());
        this.systemItems = [];

        // ── Build system buttons (lock → logout → shutdown, left to right) ─
        const sysDefs = [
            {
                icon: 'system-lock-screen', name: _('Lock screen'),
                desc: _('Lock the screen'),
                cb: () => {
                    const ss = new Gio.Settings({
                        schema_id: 'org.cinnamon.desktop.screensaver' });
                    const dlg = Gio.file_new_for_path(
                        '/usr/bin/cinnamon-screensaver-command');
                    if (dlg.query_exists(null)) {
                        if (ss.get_boolean('ask-for-away-message'))
                            Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
                        else
                            Util.spawnCommandLine('cinnamon-screensaver-command --lock');
                    } else {
                        this.screenSaverProxy.LockRemote('');
                    }
                    this.appThis.menu.close();
                },
            },
            {
                icon: 'system-log-out', name: _('Logout'),
                desc: _('Leave the session'),
                cb: () => {
                    this.appThis.menu.close();
                    this.appThis.sessionManager.LogoutRemote(0);
                },
            },
            {
                icon: 'system-shutdown', name: _('Quit'),
                desc: _('Shutdown the computer'),
                cb: () => {
                    this.appThis.menu.close();
                    this.appThis.sessionManager.ShutdownRemote();
                },
            },
        ];

        sysDefs.forEach(({icon, name, desc, cb}) => {
            const btn = new SystemButton(this.appThis, icon, name, desc, cb);
            this.systemItems.push(btn);
            this.systemButtonsBox.add(btn.actor, {
                x_fill: false, y_fill: false,
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
            });
        });

        // ── Build favorite apps ───────────────────────────────────────────
        const sf = this.appThis.settings.sidebarFavorites;
        if (sf === 1 || sf === 3) {
            this.appThis.listFavoriteApps().forEach(fav => {
                if (!this.separator1Position) this.separator1Position = this.items.length;
                this.items.push(new SidebarButton(
                    this.appThis,
                    fav.create_icon_texture(this.appThis.settings.sidebarIconSize),
                    fav, fav.name, fav.description, null));
            });
        }

        // ── Build favorite files ──────────────────────────────────────────
        if (sf === 2 || sf === 3) {
            this.appThis.listFavoriteFiles().forEach(fav => {
                if (!this.separator2Position) this.separator2Position = this.items.length;
                const gicon = getThumbnail_gicon(fav.uri, fav.mimeType) || fav.gicon;
                this.items.push(new SidebarButton(
                    this.appThis,
                    new St.Icon({ gicon, icon_size: this.appThis.settings.sidebarIconSize }),
                    fav, fav.name, fav.description, null));
            });
        }

        if (this.separator1Position) this.separator1 = new Separator(this.appThis);
        if (this.separator2Position) this.separator2 = new Separator(this.appThis);

        // ── Populate innerBox ─────────────────────────────────────────────
        for (let i = 0; i < this.items.length; i++) {
            if (this.separator1Position && i === this.separator1Position)
                this.innerBox.add(this.separator1.separator, {
                    x_fill: false, y_fill: false,
                    x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
                });
            if (this.separator2Position && i === this.separator2Position)
                this.innerBox.add(this.separator2.separator, {
                    x_fill: false, y_fill: false,
                    x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
                });
            this.innerBox.add(this.items[i].actor, {
                x_fill: false, y_fill: false,
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
            });
        }
    }

    scrollToQuitButton() { /* no-op — kept for API compat */ }

    getButtons() { return this.items; }

    clearSidebarFocusedActors() {
        const fi = this.items.findIndex(b => b.has_focus);
        if (fi > -1) this.items[fi].handleLeave();
        this.systemItems.forEach(b => {
            if (b.has_focus) {
                b.has_focus = false;
                b.actor.remove_style_pseudo_class('hover');
            }
        });
    }

    destroy() {
        this.items.forEach(i => i.destroy());       this.items = null;
        this.systemItems.forEach(i => i.destroy()); this.systemItems = null;
        if (this.separator1) this.separator1.destroy();
        if (this.separator2) this.separator2.destroy();
        this.innerBox.destroy();
        this.sidebarScrollBox.destroy();
        this.sidebarOuterBox.destroy();
        this.systemButtonsBox.destroy();
    }
}

module.exports = {Sidebar};
