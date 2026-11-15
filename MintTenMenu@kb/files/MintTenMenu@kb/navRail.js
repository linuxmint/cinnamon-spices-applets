// navRail.js — MintTenMenu Left Navigation Rail
'use strict';

const St      = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio     = imports.gi.Gio;
const GLib    = imports.gi.GLib;
const Gtk     = imports.gi.Gtk;
const Util    = imports.misc.util;
const Main    = imports.ui.main;
const {SignalManager}  = imports.misc.signalManager;
const GnomeSession     = imports.misc.gnomeSession;
const {ScreenSaverProxy} = imports.misc.screenSaver;

const COLLAPSED_W = 40;
const EXPANDED_W  = 220;
const ANIM_MS     = 180;
const ICON_CACHE_VERSION = 1;

class NavRail {
    constructor(applet, utils) {
        this.applet   = applet;
        this.utils    = utils;
        this._signals = new SignalManager(null);
        this._expanded = !!applet.settings.navRailExpanded;
        this._sessionManager    = new GnomeSession.SessionManager();
        this._screenSaverProxy  = new ScreenSaverProxy();

        // Foreground of the menu surface the rail inherits its colour from.
        this._iconColor = this.utils.getThemeForegroundHex(applet.menu.actor);

        this._buildUI();
        this._setExpanded(this._expanded, false);
        this.applyVisibility();
    }

    get actor() { return this._outerBox; }

    destroy() {
        this._signals.disconnectAllSignals();
        this._outerBox.destroy();
    }

    // ---- Build UI ----------------------------------------------------------

    _buildUI() {
        this._outerBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wintenmenu-nav-rail',
            reactive: false,
            clip_to_allocation: true,
            x_expand: false,
            y_expand: true,
        });

        // Hamburger
        this._hamburgerBtn = this._makeNavBtn('lucide-menu', 'Menu', () => {
            this._setExpanded(!this._expanded, true);
            this.applet.settings.navRailExpanded = this._expanded;
        });
        this._outerBox.add_actor(this._hamburgerBtn);

        // User section
        this._userBox = new St.BoxLayout({
            style_class: 'wintenmenu-avatar-box',
            reactive: true,
            track_hover: true,
        });
        this._buildUser();
        this._outerBox.add_actor(this._userBox);

        // Top section — navigation shortcuts, scrolling independently if the
        // rail is shorter than its contents.
        this._navScroll = new St.ScrollView({
            style_class: 'wintenmenu-nav-scroll',
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.EXTERNAL,
            x_expand: true,
            y_expand: true,
        });
        this._navScroll.set_auto_scrolling(true);
        this._navBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wintenmenu-nav-list',
            x_expand: true,
        });
        this._navScroll.add_actor(this._navBox);
        this._outerBox.add_actor(this._navScroll);

        // Shortcut buttons (middle)
        const shortcuts = [
            { icon: 'lucide-clock',      label: 'Recent',       prop: 'navShowRecent',    cb: () => { Util.spawnCommandLine('nemo recent:///'); this.applet.menu.close(); } },
            { icon: 'lucide-file-text',  label: 'Documents',    prop: 'navShowDocuments', cb: () => this._openXdg('documents') },
            { icon: 'lucide-download',   label: 'Downloads',    prop: 'navShowDownloads', cb: () => this._openXdg('downloads') },
            { icon: 'lucide-music',      label: 'Music',        prop: 'navShowMusic',     cb: () => this._openXdg('music') },
            { icon: 'lucide-image',      label: 'Pictures',     prop: 'navShowPictures',  cb: () => this._openXdg('pictures') },
            { icon: 'lucide-video',      label: 'Videos',       prop: 'navShowVideos',    cb: () => this._openXdg('videos') },
            { icon: 'lucide-folder',     label: 'File Manager', prop: 'navShowFiles',     cb: () => { Util.spawnCommandLine('nemo'); this.applet.menu.close(); } },
            { icon: 'lucide-settings',   label: 'Settings',     prop: 'navShowSettings',  cb: () => { Util.spawnCommandLine('cinnamon-settings'); this.applet.menu.close(); } },
        ];
        this._shortcutBtns = [];
        this._shortcutItems = [];
        for (const sc of shortcuts) {
            const btn = this._makeNavBtn(sc.icon, sc.label, sc.cb);
            this._navBox.add_actor(btn);
            this._shortcutBtns.push(btn);
            this._shortcutItems.push({ btn, prop: sc.prop });
        }

        // Separator
        this._separator = new St.BoxLayout({ style_class: 'wintenmenu-nav-separator', x_expand: true });
        this._outerBox.add_actor(this._separator);

        // Bottom section — session actions stay anchored to the rail's edge.
        this._bottomBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wintenmenu-nav-bottom',
            x_expand: true,
        });
        this._lockBtn = this._makeNavBtn('lucide-lock', 'Lock Screen', () => this._lock());
        this._logoutBtn = this._makeNavBtn('lucide-log-out', 'Log Out', () => this._logout());
        this._powerBtn = this._makeNavBtn('lucide-power', 'Power', () => this._shutdown());
        this._powerBtn.style_class = 'wintenmenu-power-button';

        this._bottomBox.add_actor(this._lockBtn);
        this._bottomBox.add_actor(this._logoutBtn);
        this._bottomBox.add_actor(this._powerBtn);
        this._outerBox.add_actor(this._bottomBox);
    }

    _buildUser() {
        const avatarPath = this.utils.getUserAvatarPath();
        if (avatarPath) {
            this._avatarIcon = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(avatarPath) }),
                icon_size: 32,
                style_class: 'wintenmenu-avatar-icon',
            });
        } else {
            this._avatarIcon = this._makeNavIcon('lucide-circle-user', 32);
            this._avatarIcon.style_class = 'wintenmenu-avatar-icon';
        }
        this._userBox.add_actor(this._avatarIcon);

        this._usernameLabel = new St.Label({
            text: this.utils.getUserRealName(),
            style_class: 'wintenmenu-username-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._userBox.add_actor(this._usernameLabel);

        this._signals.connect(this._userBox, 'enter-event', () => this._userBox.add_style_pseudo_class('hover'));
        this._signals.connect(this._userBox, 'leave-event', () => this._userBox.remove_style_pseudo_class('hover'));
        this._signals.connect(this._userBox, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                Util.spawnCommandLine('cinnamon-settings user');
                this.applet.menu.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    hidePowerMenu() {
        // No-op since we no longer have an overlay
    }

    // ---- Expand / collapse -------------------------------------------------

    // Physical width for the current state. Clutter width is physical px;
    // the constants are logical px like the rest of the theme.
    getPhysicalWidth() {
        const scale = global.ui_scale || 1;
        return Math.round((this._expanded ? EXPANDED_W : COLLAPSED_W) * scale);
    }

    _setExpanded(expanded, animate) {
        this._expanded = expanded;
        const target = this.getPhysicalWidth();
        // Remove/add labels first so natural width is correct before sizing.
        this._updateLabels();
        if (animate) {
            this.utils.animateWidth(this._outerBox, target, ANIM_MS);
        } else {
            this._outerBox.set_width(target);
        }
        // The app list absorbs the width delta in the same animation.
        if (this.applet && typeof this.applet._onNavWidthChanged === 'function') {
            this.applet._onNavWidthChanged(animate);
        }
    }

    _updateLabels() {
        const show = this._expanded;

        // Username label — physically add/remove from userBox so it contributes
        // zero natural width when collapsed.
        if (this._usernameLabel) {
            const parent = this._usernameLabel.get_parent();
            if (show && !parent) {
                this._userBox.add_actor(this._usernameLabel);
            } else if (!show && parent) {
                this._userBox.remove_actor(this._usernameLabel);
            }
        }

        // Nav button labels — physically add/remove so the button's natural
        // width equals only (padding × 2 + icon) when collapsed.
        const allBtns = [this._hamburgerBtn, this._lockBtn, this._logoutBtn,
                         this._powerBtn, ...this._shortcutBtns];
        for (const btn of allBtns) {
            if (!btn || !btn._label) continue;
            const parent = btn._label.get_parent();
            if (show && !parent) {
                btn.add_actor(btn._label);
            } else if (!show && parent) {
                btn.remove_actor(btn._label);
            }
        }
    }


    // ---- Per-item visibility ----------------------------------------------

    // Invisible box-layout children are skipped by Clutter's layout pass, so
    // hiding an item closes its slot instead of leaving an empty gap.
    applyVisibility() {
        const s = this.applet.settings;
        const shown = prop => s[prop] !== false;

        if (this._userBox) this._userBox.visible = shown('navShowProfile');
        for (const item of this._shortcutItems)
            item.btn.visible = shown(item.prop);

        if (this._lockBtn)   this._lockBtn.visible   = shown('navShowLock');
        if (this._logoutBtn) this._logoutBtn.visible = shown('navShowLogout');
        if (this._powerBtn)  this._powerBtn.visible  = shown('navShowPower');

        // The separator only divides the two rail sections; drop it when the
        // session section is empty rather than leaving a stray line.
        if (this._separator) {
            this._separator.visible = shown('navShowLock') ||
                                      shown('navShowLogout') ||
                                      shown('navShowPower');
        }
    }

    // ---- Button factory ----------------------------------------------------

    // Lucide SVGs are stroke-based, so they cannot use St's symbolic loader:
    // that path fills every path with the theme colour. Instead, bake the
    // menu's foreground colour into a cached copy and load it as a normal
    // full-colour SVG, which preserves the strokes and their transparency.
    _makeNavIcon(iconName, size) {
        const sourcePath = this.applet.metadata.path + '/icons/' + iconName + '.svg';
        const coloredPath = this._getColoredIconPath(iconName, sourcePath);

        return new St.Icon({
            gicon: new Gio.FileIcon({
                file: Gio.File.new_for_path(coloredPath || sourcePath),
            }),
            icon_size: size,
        });
    }

    _getColoredIconPath(iconName, sourcePath) {
        const hex = (this._iconColor || '').replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
        if (!GLib.file_test(sourcePath, GLib.FileTest.EXISTS)) return null;

        const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'wintenmenu', 'nav-icons']);
        const outPath = GLib.build_filenamev([
            dir, iconName + '-' + ICON_CACHE_VERSION + '-' + hex + '.svg',
        ]);
        if (GLib.file_test(outPath, GLib.FileTest.EXISTS)) return outPath;

        try {
            const [ok, contents] = GLib.file_get_contents(sourcePath);
            if (!ok) return null;

            const svg = new TextDecoder('utf-8').decode(contents)
                .replace(/currentColor/g, '#' + hex);

            const dirFile = Gio.File.new_for_path(dir);
            if (!dirFile.query_exists(null)) dirFile.make_directory_with_parents(null);

            Gio.File.new_for_path(outPath).replace_contents(
                new TextEncoder().encode(svg), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            return outPath;
        } catch (e) {
            global.logWarning('MintTenMenu: Failed to recolour nav icon ' + iconName + ': ' + e);
            return null;
        }
    }

    _makeNavBtn(iconName, labelText, cb) {
        const box = new St.BoxLayout({ style_class: 'wintenmenu-nav-button', reactive: true });

        box._icon = this._makeNavIcon(iconName, 20);
        box.add_actor(box._icon);

        box._label = new St.Label({ text: labelText, style_class: 'wintenmenu-nav-button-label', y_align: Clutter.ActorAlign.CENTER });
        box.add_actor(box._label);

        this._signals.connect(box, 'enter-event', () => box.add_style_pseudo_class('hover'));
        this._signals.connect(box, 'leave-event', () => box.remove_style_pseudo_class('hover'));
        this._signals.connect(box, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) { cb(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });
        return box;
    }

    _openXdg(key) {
        const d = this.utils.getXdgDir(key);
        Util.spawnCommandLine('nemo "' + (d ? d.path : GLib.get_home_dir()) + '"');
        this.applet.menu.close();
    }

    // ---- Power actions -----------------------------------------------------

    _lock() {
        try {
            const ss = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.screensaver' });
            if (GLib.file_test('/usr/bin/cinnamon-screensaver-command', GLib.FileTest.EXISTS)) {
                Util.spawnCommandLine(ss.get_boolean('ask-for-away-message')
                    ? 'cinnamon-screensaver-lock-dialog'
                    : 'cinnamon-screensaver-command --lock');
            } else {
                this._screenSaverProxy.LockRemote('');
            }
        } catch (e) { global.logWarning('MintTenMenu: lock error: ' + e); }
        this.applet.menu.close();
    }

    _logout()   { this.applet.menu.close(); this._sessionManager.LogoutRemote(0); }
    _reboot()   { this.applet.menu.close(); this._sessionManager.RebootRemote();  }
    _shutdown() { this.applet.menu.close(); this._sessionManager.ShutdownRemote();}
}

module.exports = { NavRail };
