/* global imports, global, require */
/* Panel Profiles applet: composition root.
 *
 * Owns lifecycle, the panel menu, settings bindings, dirty-state
 * wiring, notifications, and the dependency injection that feeds the lib/
 * modules (headless-loadable, no St/Clutter) and dialogs.js. Everything
 * heavy lives in those modules; this file only wires them together and
 * renders their state into a native popup menu.
 *
 * Profiles always contain panels, applets and applet configs. Saving can
 * also include desklets. The settings window manages profile data through
 * profilesManagerWidget.py. Profiles apply only when the user clicks them:
 * nothing restores automatically at boot.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Config = imports.misc.config;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

const uuid = "cinnamon-panel-profiles-applet@curbsoftware";

Gettext.bindtextdomain(uuid, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(uuid, str);
}

/* lib/ modules plus dialogs.js. First-party Cinnamon applets resolve
 * require() against the xlet root, so './lib/<name>' works for
 * subdirectories (proven in the repo's other xlets). Resolved lazily in
 * _init (require caches, so this is cheap after the first load) and every
 * downstream use stays guarded: a broken module degrades to a dim menu
 * instead of a load crash. */
let _lib = null;

function _loadLib() {
    if (_lib)
        return _lib;
    try {
        _lib = {
            Constants: require("./lib/constants"),
            Logger: require("./lib/logger"),
            AtomicFile: require("./lib/atomicFile"),
            CinnamonState: require("./lib/cinnamonState"),
            ProfileSchema: require("./lib/profileSchema"),
            Fingerprint: require("./lib/fingerprint"),
            AppletConfigStore: require("./lib/appletConfigStore"),
            ProfileStore: require("./lib/profileStore"),
            MonitorTopology: require("./lib/monitorTopology"),
            ApplyController: require("./lib/applyController"),
            Dialogs: require("./dialogs")
        };
    } catch (e) {
        global.logError("[PanelProfiles] could not load lib modules: " + e);
        _lib = null;
    }
    return _lib;
}

/* Dirty status of the live state versus the active profile. */
const DIRTY_ACTIVE = "ACTIVE";
const DIRTY_MODIFIED = "MODIFIED";
const DIRTY_UNKNOWN = "UNKNOWN";
const KINDS = ["panel"];

function PanelProfilesApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

PanelProfilesApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        this.metadata = metadata;
        this._signalManager = new SignalManager.SignalManager(null);

        /* Pending timeout sources created by _deferAction(). */
        this._idleSources = [];
        this._destroyed = false;

        /* A reload (our enabled-applets entry changed) still recreates the
         * instance, so teardown must leave the controller's transaction
         * alone; see on_applet_reloaded. */
        this._reloadPending = false;

        /* Dirty tracking: debounce source, GSettings watch ids,
         * config-file watch handles, and the cached statuses
         * plus active names. */
        this._dirtyDebounceId = null;
        this._settingWatchIds = [];
        this._dirtyStatus = {
            panel: DIRTY_UNKNOWN,
            desklet: DIRTY_UNKNOWN
        };
        this._configWatchHandle = {
            panel: null,
            desklet: null
        };
        this._activeProfileName = {
            panel: null,
            desklet: null
        };

        /* The monitor-wait state pushed by the apply controller. */
        this._waitState = null;

        /* Notification wrapper shared with the apply controller. */
        this._notifier = null;

        /* lib modules resolve their siblings through the plain importer
         * (imports.constants and friends), so the lib directory must sit on
         * the search path before anything calls into them. */
        const libPath = metadata.path + "/lib";
        if (imports.searchPath.indexOf(libPath) === -1)
            imports.searchPath.unshift(libPath);

        this._modules = _loadLib();

        // Initialize settings first: the wiring closures below read the
        // bound values (stabilization-delay, notify-*).
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("stabilization-delay", "stabilizationDelay");
        this.settings.bind("wait-timeout", "waitTimeout");
        this.settings.bind("notify-success", "notifySuccess");
        this.settings.bind("notify-warnings", "notifyWarnings");
        this.settings.bind("debug-logging", "debugLogging", (value) => {
            if (this._modules)
                this._modules.Logger.setDebug(value);
        });

        if (this._modules) {
            this._modules.Logger.setDebug(this.debugLogging);
            this._wireModules();
        }

        // Set up the menu
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.set_applet_icon_symbolic_path(metadata.path + "/icon-symbolic.svg");
        this.set_applet_tooltip(_("Panel Profiles"));

        if (this._modules) {
            this._initDirtyTracking();
            this._recomputeDirty();
        }
    },

    /* ---------------------------------------------------------------- *
     * Module wiring (the composition root proper)
     * ---------------------------------------------------------------- */

    _wireModules: function() {
        const M = this._modules;
        const metadata = this.metadata;

        try {
            M.Constants.setDependencies({ selfUuid: metadata.uuid });
            M.Logger.setDependencies({});
            M.AtomicFile.setDependencies({ logger: M.Logger });
            M.CinnamonState.setDependencies({
                constants: M.Constants,
                selfUuid: metadata.uuid,
                settingsProvider: null, /* lazy default: Gio.Settings org.cinnamon */
                logger: M.Logger
            });
            M.ProfileSchema.setDependencies({
                constants: M.Constants,
                logger: M.Logger
            });
            M.Fingerprint.setDependencies({
                canonicalize: M.CinnamonState.fingerprintSettingsPart,
                sha256: M.AtomicFile.sha256Hex
            });
            M.AppletConfigStore.setDependencies({
                selfUuid: () => metadata.uuid,
                logger: M.Logger
            });
            /* Deliberately no validateProfile/migrateProfile here: the
             * apply controller wires the schema adapters into the store
             * itself right below (its own setDependencies does it), which
             * is the one place that owns both handles. */
            M.ProfileStore.setDependencies({ logger: M.Logger });
            M.MonitorTopology.setDependencies({
                layoutProvider: this._makeLayoutProvider(),
                logger: M.Logger,
                scheduler: this._makeScheduler()
            });

            /* ApplyController's own wiring resets its in-memory machine,
             * so it must come after the store wiring above. */
            M.ApplyController.setDependencies({
                constants: M.Constants,
                logger: M.Logger,
                cinnamonState: M.CinnamonState,
                appletConfigStore: M.AppletConfigStore,
                profileStore: M.ProfileStore,
                profileSchema: M.ProfileSchema,
                fingerprint: M.Fingerprint,
                monitorTopology: M.MonitorTopology,
                scheduler: this._makeScheduler(),
                notify: this._makeNotifier(),
                notifySuccessEnabled: () => this.notifySuccess,
                isAppletInstalled: (candidate) => this._isAppletInstalled(candidate),
                isDeskletInstalled: (candidate) => this._isDeskletInstalled(candidate),
                environment: () => ({
                    cinnamonVersion: Config.PACKAGE_VERSION || "",
                    sessionType: GLib.getenv("XDG_SESSION_TYPE") || ""
                }),
                onStateChange: (st) => this._onControllerState(st),
                onWaitStateChange: (show, current, required) =>
                    this._onWaitState(show, current, required),
                onProfileSaved: (profile) => this._onProfileSaved(profile),
                waitStabilizeMs: this.stabilizationDelay * 1000,
                waitTimeoutMs: this.waitTimeout * 1000
            });
            this._notifier = this._makeNotifier();

            M.Dialogs.setTranslate(_);
            M.Dialogs.setDependencies({ logger: M.Logger });

            const init = M.ProfileStore.init();
            if (init && init.recoveredWarnings && init.recoveredWarnings.length)
                M.Logger.warn("state init: " + init.recoveredWarnings.join("; "));

            /* A previous instance may have died around its enabled-applets
             * write; if state.json carries a pendingApply, resume it. */
            if (init && (init.busy === true ||
                    (init.state && init.state.pendingApply))) {
                try {
                    M.ApplyController.resumePendingApply();
                } catch (e) {
                    M.Logger.error("resumePendingApply failed", e);
                }
            }
            M.Logger.log("wired");
        } catch (e) {
            M.Logger.error("module wiring failed", e);
        }
    },

    _makeLayoutProvider: function() {
        const lm = Main.layoutManager;
        return {
            getCount: () => lm.monitors.length,
            getMonitors: () => lm.monitors,
            getPrimaryIndex: () => lm.primaryIndex,
            connect: (cb) => lm.connect("monitors-changed", cb),
            disconnect: (id) => lm.disconnect(id)
        };
    },

    _makeScheduler: function() {
        return {
            timeoutAdd: (ms, fn) => Mainloop.timeout_add(ms, fn),
            sourceRemove: (id) => Mainloop.source_remove(id)
        };
    },

    _makeNotifier: function() {
        return {
            info: (title, details) => {
                try { Main.notify(title, details || ""); } catch (e) { }
            },
            warn: (title, details) => {
                if (!this.notifyWarnings)
                    return;
                try { Main.warningNotify(title, details || ""); } catch (e) { }
            },
            success: (title, details) => {
                if (!this.notifySuccess)
                    return;
                try { Main.notify(title, details || ""); } catch (e) { }
            }
        };
    },

    _isAppletInstalled: function(candidate) {
        if (typeof candidate !== "string" || candidate.length === 0)
            return false;
        const user = GLib.build_filenamev(
            [GLib.get_home_dir(), ".local", "share", "cinnamon", "applets", candidate]);
        const system = GLib.build_filenamev(
            ["/usr", "share", "cinnamon", "applets", candidate]);
        return GLib.file_test(user, GLib.FileTest.EXISTS) ||
            GLib.file_test(system, GLib.FileTest.EXISTS);
    },

    _isDeskletInstalled: function(candidate) {
        if (typeof candidate !== "string" || candidate.length === 0)
            return false;
        const user = GLib.build_filenamev(
            [GLib.get_home_dir(), ".local", "share", "cinnamon", "desklets", candidate]);
        const system = GLib.build_filenamev(
            ["/usr", "share", "cinnamon", "desklets", candidate]);
        return GLib.file_test(user, GLib.FileTest.EXISTS) ||
            GLib.file_test(system, GLib.FileTest.EXISTS);
    },

    /* ---------------------------------------------------------------- *
     * Dirty tracking
     * ---------------------------------------------------------------- */

    _initDirtyTracking: function() {
        const M = this._modules;
        try {
            this._cinnamonSettings = new Gio.Settings({
                schema_id: "org.cinnamon"
            });
            M.Constants.PANEL_SETTING_KEYS.forEach((key) => {
                this._settingWatchIds.push(
                    this._cinnamonSettings.connect("changed::" + key,
                        () => this._onTrackedChange()));
            });
        } catch (e) {
            M.Logger.error("dirty tracking init failed", e);
        }
        this._rebuildDirtyTracking();
    },

    /* (Re)attach config-file watches to the active profile
     * and recompute both statuses. Called whenever an active profile
     * changes: after an apply completes, after a save, after the settings
     * window edits profile files. */
    _rebuildDirtyTracking: function() {
        if (this._destroyed || !this._modules)
            return;
        KINDS.forEach((kind) => this._rebuildDirtyTrackingKind(kind));
        this._recomputeDirty();
    },

    _rebuildDirtyTrackingKind: function(kind) {
        const M = this._modules;

        if (this._configWatchHandle[kind]) {
            M.AppletConfigStore.unwatchConfigs(this._configWatchHandle[kind]);
            this._configWatchHandle[kind] = null;
        }
        this._activeProfileName[kind] = null;

        try {
            const state = M.ProfileStore.getState();
            const id = state.activeProfileId;
            if (id) {
                const loaded = M.ProfileStore.loadProfile(id);
                if (loaded && !loaded.error && loaded.profile) {
                    this._activeProfileName[kind] = loaded.profile.name;
                    const configs = (loaded.profile.appletConfigs || []).concat(
                        loaded.profile.includeDesklets === true
                            ? (loaded.profile.deskletConfigs || []) : []);
                    this._configWatchHandle[kind] =
                        M.AppletConfigStore.watchConfigs(
                            configs, () => this._onTrackedChange());
                }
            }
        } catch (e) {
            M.Logger.error("dirty tracking rebuild failed for " + kind, e);
        }
    },

    _onTrackedChange: function() {
        if (this._destroyed || !this._modules)
            return;
        if (this._modules.ApplyController.isDirtySuppressed())
            return;
        if (this._dirtyDebounceId !== null) {
            Mainloop.source_remove(this._dirtyDebounceId);
            this._dirtyDebounceId = null;
        }
        const delay = (this._modules.Constants.DIRTY_DEBOUNCE_MS || 500);
        this._dirtyDebounceId = Mainloop.timeout_add(delay, () => {
            this._dirtyDebounceId = null;
            this._recomputeDirty();
            return false;
        });
    },

    _recomputeDirty: function() {
        if (this._destroyed || !this._modules)
            return;
        KINDS.forEach((kind) => this._recomputeDirtyKind(kind));
        this._onDirtyChanged();
    },

    _recomputeDirtyKind: function(kind) {
        const M = this._modules;
        try {
            const state = M.ProfileStore.getState();
            const id = state.activeProfileId;
            if (!id) {
                this._dirtyStatus[kind] = DIRTY_UNKNOWN;
                return;
            }
            const loaded = M.ProfileStore.loadProfile(id);
            if (!loaded || loaded.error || !loaded.profile) {
                this._dirtyStatus[kind] = DIRTY_UNKNOWN;
                return;
            }
            const configs = (loaded.profile.appletConfigs || []).concat(
                loaded.profile.includeDesklets === true
                    ? (loaded.profile.deskletConfigs || []) : []);
            const root = M.Constants.SPICES_CONFIG_ROOT;
            /* A config file the profile captured but that no longer
             * exists is a modification, full stop: no need to hash. */
            const missing = configs.some((config) => !GLib.file_test(
                GLib.build_filenamev([root, config.relativePath]),
                GLib.FileTest.EXISTS));
            if (missing) {
                this._dirtyStatus[kind] = DIRTY_MODIFIED;
                return;
            }
            /* Compare digests recomputed on both sides under this profile's
             * semantics: the stored fingerprint string can predate a schema
             * migration, so it is never the comparison target. */
            const live = M.ApplyController.computeCurrentFingerprint(
                loaded.profile.includeDesklets === true);
            const stored = M.ApplyController.profileFingerprintOf(loaded.profile);
            if (live === null || stored === "") {
                /* Either side unevaluable: no verdict. */
                this._dirtyStatus[kind] = DIRTY_UNKNOWN;
            } else {
                this._dirtyStatus[kind] = live === stored
                    ? DIRTY_ACTIVE : DIRTY_MODIFIED;
            }
        } catch (e) {
            this._dirtyStatus[kind] = DIRTY_UNKNOWN;
        }
    },

    _onDirtyChanged: function() {
        if (this._destroyed)
            return;
        this._updateTooltip();
        if (this.menu && this.menu.isOpen)
            this.updateMenu();
    },

    _onProfileSaved: function(profile) {
        if (this._destroyed || !this._modules || !profile)
            return;
        /* The controller calls this only after activeProfileId is durable,
         * so the menu cannot display a false active row. */
        this._rebuildDirtyTracking();
    },

    /* ---------------------------------------------------------------- *
     * Controller callbacks
     * ---------------------------------------------------------------- */

    _onControllerState: function(state) {
        if (this._destroyed || !this._modules)
            return;
        if (state === this._modules.ApplyController.STATE_COMPLETE)
            this._rebuildDirtyTracking();
        else if (state === "FAILED")
            this._onTrackedChange();
        this._updateTooltip();
        if (this.menu && this.menu.isOpen)
            this.updateMenu();
    },

    _onWaitState: function(show, current, required) {
        if (this._destroyed)
            return;
        this._waitState = show ? { current: current, required: required } : null;
        this._updateTooltip();
        if (this.menu && this.menu.isOpen)
            this.updateMenu();
    },

    _updateTooltip: function() {
        if (this._destroyed || !this._modules)
            return;
        const M = this._modules;
        let text = _("Panel Profiles");
        try {
            const controllerState = M.ApplyController.getState();
            const applying = M.ApplyController.isBusy() &&
                controllerState !== M.ApplyController.STATE_SAVING;
            if (applying) {
                text = _("Restoring profile…");
            } else {
                const parts = [];
                KINDS.forEach((kind) => {
                    const name = this._activeProfileName[kind];
                    if (!name)
                        return;
                    parts.push(_("Profile: %s").format(name) +
                        (this._dirtyStatus[kind] === DIRTY_MODIFIED
                            ? " (" + _("modified") + ")" : ""));
                });
                if (parts.length)
                    text = parts.join(" · ");
            }
        } catch (e) {
            text = _("Panel Profiles");
        }
        try {
            this.set_applet_tooltip(text);
        } catch (e) {
            /* actor already gone; nothing left to label */
        }
    },

    /* ---------------------------------------------------------------- *
     * Menu
     * ---------------------------------------------------------------- */

    on_applet_clicked: function(event) {
        this.updateMenu();
        this.menu.toggle();
    },

    /* Rebuilt from live data on every open. Guarded: state callbacks and
     * deferred actions can land here after the actor is gone. The menu is
     * profile list followed by the actions. */
    updateMenu: function() {
        if (this._destroyed || !this.menu)
            return;
        const M = this._modules;
        try {
            this.menu.removeAll();

            if (!M) {
                this._addDimMenuItem(_("Panel Profiles could not load."));
                return;
            }

            const profiles = M.ProfileStore.listProfiles();
            const state = M.ProfileStore.getState();
            const busy = M.ApplyController.isBusy();
            const controllerState = M.ApplyController.getState();
            /* During a monitor wait the profile rows stay clickable so the
             * user can manually load a different (e.g. one-monitor) profile;
             * _applyProfile cancels the pending wait first. */
            const waiting = controllerState ===
                M.ApplyController.STATE_WAITING_FOR_MONITORS;

            if (profiles.length === 0) {
                /* First run: nothing saved yet. */
                this._addDimMenuItem(_("No profiles saved yet."));
                this._addDimMenuItem(_("Save your current panel layout to create one."));
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                this._addActionMenuItem(_("Save current layout…"), !busy,
                    () => this._openSaveDialog());
                this._addActionMenuItem(_("Restore previous layout"),
                    !busy && !!M.ProfileStore.readRollback(),
                    () => M.ApplyController.beginRollback());
                this._addActionMenuItem(_("Configure…"), true,
                    () => this._openSettings());
                this._addActionMenuItem(_("Restart Cinnamon"), true,
                    () => Main.restartCinnamon(true));
                return;
            }

            this._addProfileSection(M, profiles, state, busy, waiting);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            /* Actions, gated by the operation lock where they touch the
             * profile world; Configure and Restart are read-only/orthogonal
             * and stay live. */
            if (busy)
                this._addDimMenuItem(this._busyLabel(controllerState));

            const activePanelRow = this._activeRowOf(M, profiles, state);
            if (activePanelRow && this._dirtyStatus.panel === DIRTY_MODIFIED) {
                this._addActionMenuItem(
                    _("Update profile \"%s\"").format(activePanelRow.name),
                    !busy, () => this._confirmUpdate(activePanelRow.id, activePanelRow.name));
            }
            this._addActionMenuItem(_("Save current layout…"), !busy,
                () => this._openSaveDialog());
            this._addActionMenuItem(_("Restore previous layout"),
                !busy && !!M.ProfileStore.readRollback(),
                () => M.ApplyController.beginRollback());
            this._addActionMenuItem(_("Configure…"), true,
                () => this._openSettings());
            this._addActionMenuItem(_("Restart Cinnamon"), true,
                () => Main.restartCinnamon(true));
        } catch (e) {
            if (M)
                M.Logger.error("menu build failed", e);
            else
                global.logError("[PanelProfiles] menu build failed: " + e);
        }
    },

    /* Valid rows with the active profile first and bold, then the rest
     * alphabetically. */
    _addProfileSection: function(M, profiles, state, busy, waiting) {
        const rows = profiles.filter((p) => p.valid);
        if (rows.length === 0) {
            this._addDimMenuItem(_("No profiles yet."));
            return;
        }
        const activeRow = this._activeRowOf(M, profiles, state);
        this._activeProfileName.panel = activeRow ? activeRow.name : null;
        const ordered = activeRow
            ? [activeRow].concat(rows.filter((p) => p !== activeRow))
            : rows;

        const section = new PopupMenu.PopupMenuSection();
        const self = this;
        ordered.forEach((profile) => {
            const item = new PopupMenu.PopupMenuItem(profile.name);
            if (profile === activeRow) {
                item.setOrnament(PopupMenu.OrnamentType.CHECK, true);
                item.label.add_style_class_name(
                    "panel-profiles-active-row");
                if (this._dirtyStatus.panel === DIRTY_MODIFIED) {
                    const tag = new St.Label({
                        text: _("Modified"),
                        style_class: "panel-profiles-tag"
                    });
                    item.addActor(tag, { expand: true, span: -1, align: St.Align.END });
                }
            }
            if (busy && !waiting)
                item.setSensitive(false);
            item.connect("activate", () => {
                self._deferAction(() => self._applyProfile(profile.id));
            });
            section.addMenuItem(item);
        });
        this.menu.addMenuItem(section);
        /* Long lists scroll. The section's signal wiring happened in
         * addMenuItem above; reparenting its actor into a scroll view
         * keeps activation and key navigation intact. */
        if (ordered.length > 12) {
            const scroll = new St.ScrollView({
                x_fill: true,
                y_fill: false,
                y_align: St.Align.START,
                overlay_scrollbars: true,
                hscrollbar_policy: St.PolicyType.NEVER,
                vscrollbar_policy: St.PolicyType.AUTOMATIC
            });
            scroll.add_actor(section.actor);
            this.menu.addActor(scroll);
        }
    },

    _activeRowOf: function(M, profiles, state) {
        return profiles.find((p) => p.valid && p.id === state.activeProfileId) || null;
    },

    /* Dim, non-reactive informational row. */
    _addDimMenuItem: function(text) {
        const item = new PopupMenu.PopupMenuItem(text);
        item.actor.reactive = false;
        item.actor.can_focus = false;
        item.label.add_style_class_name("popup-inactive-menu-item");
        this.menu.addMenuItem(item);
        return item;
    },

    _addActionMenuItem: function(text, sensitive, handler) {
        const item = new PopupMenu.PopupMenuItem(text);
        item.setSensitive(sensitive !== false);
        const self = this;
        item.connect("activate", () => {
            self._deferAction(handler);
        });
        this.menu.addMenuItem(item);
        return item;
    },

    _busyLabel: function(controllerState) {
        if (controllerState === "SAVING")
            return _("Saving…");
        if (controllerState === "WAITING_FOR_MONITORS")
            return _("Waiting for displays…");
        return _("Loading…");
    },

    /* ---------------------------------------------------------------- *
     * Actions
     * ---------------------------------------------------------------- */

    _applyProfile: function(profileId) {
        if (this._destroyed || !this._modules)
            return;
        const M = this._modules;
        /* A manual load while a monitor wait is pending must win over the
         * wait: cancel it (this releases the lock and clears the menu wait
         * display), then start the user's apply normally. */
        if (M.ApplyController.getState() ===
                M.ApplyController.STATE_WAITING_FOR_MONITORS)
            M.ApplyController.cancelAll();
        const result = M.ApplyController.beginApply(profileId, { reason: "user" });
        if (result && result.failure && result.failure !== "waiting" &&
                result.failure !== "busy") {
            /* Validation failures inside the controller only reach the
             * log; the click deserves a visible notice. */
            M.Logger.warn("apply refused: " + result.failure);
            if (this._notifier)
                this._notifier.warn(_("Panel Profiles"),
                    _("The profile could not be loaded."));
        }
        this._updateTooltip();
    },

    _confirmUpdate: function(profileId, name) {
        if (this._destroyed || !this._modules)
            return;
        const M = this._modules;
        const self = this;
        try {
            const dialog = new M.Dialogs.PanelProfilesConfirmDialog(
                _("Update \"%s\"?").format(name),
                _("The saved version of this profile will be replaced by your current configuration."),
                _("Update"),
                () => {
                    try {
                        M.ApplyController.beginSaveUpdate(profileId);
                    } catch (e) {
                        M.Logger.error("update save failed", e);
                    }
                    self._onDirtyChanged();
                });
            dialog.open(global.get_current_time());
        } catch (e) {
            M.Logger.error("could not open update confirmation", e);
        }
    },

    _openSaveDialog: function() {
        if (this._destroyed || !this._modules)
            return;
        const M = this._modules;
        const profiles = M.ProfileStore.listProfiles();
        const state = M.ProfileStore.getState();
        const activeRow = this._activeRowOf(M, profiles, state);
        const self = this;

        M.Dialogs.promptSaveProfile({
            existingProfiles: profiles
                .filter((p) => p.valid)
                .map((p) => ({ id: p.id, name: p.name,
                    includeDesklets: p.includeDesklets === true })),
            activeProfileName: activeRow ? activeRow.name : null,
            includeDesklets: activeRow ? activeRow.includeDesklets === true : false
        }, (result) => {
            if (self._destroyed || !result)
                return;
            if (result.mode === "new") {
                M.ApplyController.beginSaveNew(result.name,
                    result.includeDesklets === true);
            } else if (result.mode === "replace" && result.targetId) {
                /* The replace confirmation already happened inside the
                 * dialog; the overwrite is consented to. */
                M.ApplyController.beginSaveUpdate(result.targetId,
                    result.includeDesklets === true);
            }
            self._onDirtyChanged();
        });
    },

    /* The schema-driven settings window (profile data management lives in
     * its custom widget). Cinnamon's own configureApplet launches
     * xlet-settings with the right uuid/instance arguments; calling it
     * inherited-style keeps us on the supported path. */
    _openSettings: function() {
        if (this._destroyed)
            return;
        try {
            this.configureApplet();
        } catch (e) {
            if (this._modules)
                this._modules.Logger.error("could not open settings", e);
        }
    },

    /* Menu items must not act synchronously: PopupMenuBase closes the menu
     * in its own 'activate' handler, which runs after ours. Pushing a modal
     * dialog before that has happened fights the menu's grab. Defer to the
     * next main loop turn and track the source so teardown can cancel it.
     *
     * timeout_add(0), not idle_add: idle callbacks sit below Clutter's
     * redraw priority, so an action fired while a menu or dialog was still
     * animating could be starved for hundreds of milliseconds. */
    _deferAction: function(fn) {
        const self = this;
        let id = Mainloop.timeout_add(0, function() {
            self._idleSources = self._idleSources.filter(function(s) { return s !== id; });
            try {
                fn.call(self);
            } catch (e) {
                if (self._modules)
                    self._modules.Logger.error("deferred action failed", e);
                else
                    global.logError("[PanelProfiles] deferred action failed: " + e);
            }
            return false;
        });
        this._idleSources.push(id);
    },

    /* ---------------------------------------------------------------- *
     * Teardown
     * ---------------------------------------------------------------- */

    on_applet_reloaded: function() {
        /* Our enabled-applets entry changed, most likely DURING an apply:
         * a fresh instance is about to run _init and resume whatever
         * pendingApply sits in state.json. Cancel nothing here. */
        this._reloadPending = true;
        this._teardown(false);
    },

    on_applet_removed_from_panel: function() {
        let preserve = this._reloadPending;
        try {
            preserve = preserve || (this._modules &&
                this._modules.ApplyController.shouldPreserveTransactionOnRemoval());
        } catch (e) {
            preserve = this._reloadPending;
        }
        this._teardown(!preserve);
    },

    /* Full teardown when @full (real removal): cancels controller
     * transactions and resets every module seam. Reload teardown releases
     * only this instance's UI, signals and timers; the module-level
     * controller state survives for the next instance. Idempotent. */
    _teardown: function(full) {
        if (this._destroyed)
            return;
        this._destroyed = true;
        const M = this._modules;

        if (this._idleSources) {
            for (let i = 0; i < this._idleSources.length; i++)
                Mainloop.source_remove(this._idleSources[i]);
            this._idleSources = [];
        }
        if (this._dirtyDebounceId !== null) {
            Mainloop.source_remove(this._dirtyDebounceId);
            this._dirtyDebounceId = null;
        }
        if (this._settingWatchIds.length && this._cinnamonSettings) {
            this._settingWatchIds.forEach((id) => {
                try {
                    this._cinnamonSettings.disconnect(id);
                } catch (e) {
                    /* settings object already finalized */
                }
            });
            this._settingWatchIds = [];
        }
        KINDS.forEach((kind) => {
            if (this._configWatchHandle[kind] && M) {
                M.AppletConfigStore.unwatchConfigs(this._configWatchHandle[kind]);
                this._configWatchHandle[kind] = null;
            }
        });
        if (full && M) {
            try {
                M.ApplyController.cancelAll(true);
            } catch (e) {
                M.Logger.warn("cancelAll failed: " + e);
            }
        }
        this._signalManager.disconnectAllSignals();
        try {
            this.settings.finalize();
        } catch (e) {
            /* already gone */
        }
        if (full && M) {
            ["ApplyController", "MonitorTopology", "ProfileStore",
                "AppletConfigStore", "Fingerprint", "ProfileSchema",
                "CinnamonState", "AtomicFile", "Logger", "Constants"]
                .forEach((name) => {
                    try {
                        if (M[name] && M[name].resetDependencies)
                            M[name].resetDependencies();
                    } catch (e) {
                        /* a failed reset must not block the rest */
                    }
                });
        }
        /* Drop our search-path entry so repeated reloads do not stack
         * duplicates; a fresh _init unshifts it again. */
        try {
            const libPath = this.metadata.path + "/lib";
            imports.searchPath = imports.searchPath.filter((p) => p !== libPath);
        } catch (e) {
            /* cosmetic at worst */
        }
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    return new PanelProfilesApplet(metadata, orientation, panel_height, instanceId);
}
