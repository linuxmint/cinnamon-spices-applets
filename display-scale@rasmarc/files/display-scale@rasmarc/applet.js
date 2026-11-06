// Display Scale — rasmarc
// Based on uiscaler by joka42, originally based on Resolution Switcher
// by dennis@nixdev.com. Uses the font scaling of the user's modified
// uiscaler; the slider extends Cinnamon's native PopupSliderMenuItem.

const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const { _, formatPercent } = require("./i18n");
const ExtensionClient = require("./extension-client");
const OnboardPositionCompensation = require("./onboard-position-compensation");

const TEXT_KEY = "text-scaling-factor";
const TEXT_FACTOR_EPSILON = 0.00001; // Same tolerance as native-scale.py.
const ScaleSlider = require("./scale-slider");
const ModeSelector = require("./mode-selector");

function clampPercent(percent) {
    return Math.max(100, Math.min(200, percent));
}

function containsPoint(actor, x, y) {
    if (!actor || actor.visible === false)
        return false;
    const [left, top] = actor.get_transformed_position();
    const [width, height] = actor.get_transformed_size();
    return x >= left && x < left + width && y >= top && y < top + height;
}

class DisplayScaleApplet extends Applet.IconApplet {
    _init(metadata, orientation, panelHeight, instanceId) {
        super._init(orientation, panelHeight, instanceId);
        this._destroyed = false;
        this._applying = false;
        this._initializing = true;
        this._startupRunning = false;
        this._startupModeSelection = null;
        this._nativeUiMode = false;
        this._switchPointPending = false;
        this._switchPointSerial = 0;
        this._dragActive = false;
        this._menuMouseDown = false;
        this._openingReleasePending = false;
        this._openingSliderPreview = false;
        this._sliderItem = null;
        this._currentPercent = 100;
        this._previewPercent = 100;
        this._uiMode = false;
        this._uiPercent = 100;
        this._screenPercent = 100;
        this._screenStagePercent = 100;
        this._screenSteps = [];
        this._screenScales = [];
        this._nativeAvailable = false;
        this._uiRefreshSerial = 0;
        this._statusProcess = null;
        this._settleTask = null;
        this._switchTrace = null;
        this._tracePending = null;
        this._traceProcess = null;
        this._version = metadata.version;
        this._extension = new ExtensionClient(metadata.uuid + ":" + instanceId + ":" + GLib.get_monotonic_time(),
            () => this._syncFromSystem());
        this._onboardCompensation = new OnboardPositionCompensation(metadata.path);
        this.keepPanel = true;
        this.growPanelText = false;
        this.keepDeskletCenters = true;
        this.onboardAdjustmentEnabled = true;
        this.onboardAdjustmentMethod = "smart";
        this.keepOsd150Offset = true;
        this.startMode = "unchanged";
        this.showTooltips = true;
        this._appletPath = metadata.path;
        this._helperPath = GLib.build_filenamev([metadata.path, "native-scale.py"]);
        this.sliderStep = 5;
        this.screenSwitchPoint = 100;
        this.shadeScreenStages = false;
        this.switchPointInMenu = false;
        this.keepSwitchPointMenuOpen = false;
        this.scaleBothSides = false;
        this.customStage1 = "125";
        this.customStage2 = "150";
        this.customStage3 = "175";
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_icon_symbolic_path(GLib.build_filenamev([metadata.path, "display-scale-symbolic.svg"]));

        this._interface = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });
        this._textChangedId = this._interface.connect("changed::" + TEXT_KEY,
            () => this._syncFromSystem());
        this._monitorsChangedId = Main.layoutManager ? Main.layoutManager.connect("monitors-changed",
            () => this._refreshUiStatus("startup")) : 0;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("slider-step", "sliderStep", () => this._buildMenu());
        for (let index = 1; index <= 3; index++)
            this.settings.bind("custom-stage-" + index, "customStage" + index, () => this._buildMenu());
        this.settings.bind("screen-switch-point", "screenSwitchPoint", () => this._screenSwitchPointChanged());
        this.settings.bind("shade-screen-stages", "shadeScreenStages", () => this._switchPointOptionChanged());
        this.settings.bind("switch-point-in-menu", "switchPointInMenu", () => this._switchPointOptionChanged());
        this.settings.bind("keep-switch-point-menu-open", "keepSwitchPointMenuOpen");
        this.settings.bind("scale-both-sides", "scaleBothSides", () => {
            if (this._sliderItem && !this._destroyed)
                this._sliderItem.setScaleBothSides(this.scaleBothSides);
        });
        this.settings.bind("keep-panel-height", "keepPanel", () => this._syncPanelOptions());
        this.settings.bind("grow-panel-text", "growPanelText", () => this._syncPanelOptions());
        this.settings.bind("keep-desklet-centers", "keepDeskletCenters", () => this._syncExtension());
        this.settings.bind("onboard-adjustment-enabled", "onboardAdjustmentEnabled", () => this._syncOnboardOptions());
        this.settings.bind("onboard-adjustment-method", "onboardAdjustmentMethod", () => this._syncOnboardOptions());
        this.settings.bind("osd150-offset-enabled", "keepOsd150Offset", () => this._syncExtension());
        this.settings.bind("start-mode", "startMode");
        // Select the initial method without changing the display or font.
        // Read the preference once; later edits apply at the next applet start.
        this._startupModeSelection = this.startMode === "unchanged" ? null : this.startMode === "screen";
        this._uiMode = this._startupModeSelection === true;
        this.settings.bind("show-tooltips", "showTooltips", () => this._syncTooltips());
        this._switchPointOptionChanged();
        this._createMenu(orientation);
        this._refreshUiStatus("startup");
    }

    openAbout() {
        // Keep Cinnamon's About dialog, with a symbolic logo for this applet.
        try {
            Gio.Subprocess.new(["/usr/bin/python3",
                GLib.build_filenamev([this._appletPath, "about.py"])],
                Gio.SubprocessFlags.NONE);
        } catch (error) {
            global.logError(error);
            super.openAbout();
        }
    }

    _createMenu(orientation) {
        if (this._sliderItem)
            this._sliderItem.cancelDrag();
        if (this.menu)
            this.menu.destroy();
        if (this.menuManager)
            this.menuManager.destroy();
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu.actor.set_style("min-width: 0;");
        this.menu.box.set_style("min-width: 0;");
        this.menuManager.addMenu(this.menu);
        this.menu.connect("open-state-changed", (menu, open) => {
            this._resetMenuPointer();
            this._openingReleasePending = open;
            if (!open && this._sliderItem)
                this._sliderItem.cancelDrag();
            this._syncFromSystem();
            if (open)
                this._refreshUiStatus();
        });
        this._buildMenu();
    }

    _buildMenu() {
        if (!this.menu || this._destroyed)
            return;
        this._resetMenuPointer();
        if (this._sliderItem)
            this._sliderItem.cancelDrag();
        this._sliderItem = null;
        this._dragActive = false;
        this.menu.removeAll();
        this._modeItem = new ModeSelector(this._appletPath, this._uiMode, this.showTooltips);
        this._modeItem.connect("mode-selected", (item, active) => {
            if (this._sliderItem)
                this._sliderItem.cancelDrag();
            this._applyPercent(this._currentPercent, active, { menu: this.menu });
        });
        this.menu.addMenuItem(this._modeItem);
        const separator = new PopupMenu.PopupSeparatorMenuItem();
        separator.actor.set_style("padding: 0.4em 0.65em;");
        this.menu.addMenuItem(separator);

        this._sliderItem = new ScaleSlider(0, this.sliderStep,
            [this.customStage1, this.customStage2, this.customStage3], separator._drawingArea);
        this._sliderItem.setScaleBothSides(this.scaleBothSides);
        this._sliderItem.connect("switch-point-toggled", () => this._toggleMenuSwitchPoint());
        this._sliderItem.connect("switch-point-selected", (item, point) => this._setMenuSwitchPoint(point));
        this._sliderItem.connect("switch-drag-ended", () => { this._openingReleasePending = false; });
        this._sliderItem.connect("drag-released-outside", (item, x, y) => {
            if (!containsPoint(this.menu.actor, x, y) && !this._pointOnPanel(x, y))
                this.menu.close();
        });
        this._sliderItem.connect("drag-begin", () => { this._dragActive = true; });
        this._sliderItem.connect("value-changed", () => {
            this._previewPercent = Math.round(100 + this._sliderItem.value * 100);
            this._sliderItem.setPercentDisplay(this._previewPercent);
            if (!this._dragActive)
                this._commitSlider(this._previewPercent);
        });
        this._sliderItem.connect("drag-end", () => {
            this._dragActive = false;
            this._commitSlider(this._previewPercent);
        });
        this._sliderItem.connect("drag-cancelled", () => {
            this._dragActive = false;
            this._syncFromSystem();
        });
        this.menu.addMenuItem(this._sliderItem);
        this._syncFromSystem();
        this._setControlsBusy(this._applying || this._initializing);
    }

    _syncFromSystem() {
        if (this._destroyed || this._applying || this._initializing)
            return;
        const factor = this._interface.get_double(TEXT_KEY);
        const screenScale = this._nativeUiMode || this._uiMode;
        if (screenScale)
            this._uiPercent = this._screenPercent * (Number.isFinite(factor) ? factor : 1);
        this._syncExtension();
        this._currentPercent = screenScale ? this._uiPercent : (Number.isFinite(factor) ? factor * 100 : 100);
        const tooltip = this._uiMode ? _("Text: %s · Screen: %s")
            .replace("%s", formatPercent(this._currentPercent)).replace("%s", formatPercent(this._screenStagePercent)) :
            _("Scaling: %s").replace("%s", formatPercent(this._currentPercent));
        this.set_applet_tooltip(this.showTooltips ? tooltip : "");
        if (this._modeItem)
            this._modeItem.setMode(this._uiMode);
        this._syncStageShading();
        if (!this._dragActive) {
            this._previewPercent = this._currentPercent;
            if (this._sliderItem) {
                this._sliderItem.setValue((clampPercent(this._currentPercent) - 100) / 100);
                this._sliderItem.setPercentDisplay(this._currentPercent);
            }
        }
    }

    _syncStageShading() {
        if (this._sliderItem && !this._destroyed)
            this._sliderItem.setScreenShading(this.shadeScreenStages,
                this._screenSteps, this.screenSwitchPoint,
                this.shadeScreenStages && this.switchPointInMenu, this.showTooltips);
    }

    _switchPointOptionChanged() {
        if (this._destroyed)
            return;
        this._syncStageShading();
        this._applyPendingSwitchPoint();
    }

    _screenSwitchPointChanged() {
        if (this._destroyed)
            return;
        ++this._switchPointSerial;
        this._syncStageShading();
        this._switchPointPending = true;
        this._applyPendingSwitchPoint();
    }

    async _toggleMenuSwitchPoint() {
        const points = [150, 125, 100, 75, 50];
        return this._setMenuSwitchPoint(points[(points.indexOf(this.screenSwitchPoint) + 1) % points.length]);
    }

    async _setMenuSwitchPoint(selected) {
        if (this._destroyed || this._applying || this._initializing ||
            !this.shadeScreenStages || !this.switchPointInMenu ||
            ![50, 75, 100, 125, 150].includes(selected) || selected === this.screenSwitchPoint)
            return false;
        const before = this.screenSwitchPoint;
        const menu = this.menu;
        const item = this._sliderItem;
        const keepOpen = this.keepSwitchPointMenuOpen;
        const serial = ++this._switchPointSerial;
        this.screenSwitchPoint = selected;
        this._syncStageShading();
        // In text mode this only prepares the next screen-mode threshold.
        const success = !this._uiMode || await this._applyPercent(this._currentPercent, true,
            { menu: keepOpen ? null : menu });
        if (!success && !this._destroyed && serial === this._switchPointSerial &&
            this.screenSwitchPoint === selected) {
            this.screenSwitchPoint = before;
            this._syncStageShading();
        }
        if (success && !keepOpen && !this._destroyed && this.menu === menu && this._sliderItem === item && menu.isOpen)
            menu.close(false);
        return success;
    }

    _syncExtension() {
        if (this._destroyed || this._applying || this._initializing)
            return;
        const factor = this._interface.get_double(TEXT_KEY);
        const textFactor = Number.isFinite(factor) ? factor : 1;
        const screenMode = this._nativeUiMode || this._uiMode;
        this._extension.update({
            screenMode, screenPercent: this._screenPercent, textFactor,
            totalPercent: screenMode ? this._screenPercent * textFactor : textFactor * 100,
            keepPanel: this.keepPanel, growPanelText: this.growPanelText,
            keepDeskletCenters: this.keepDeskletCenters, keepOsd150Offset: this.keepOsd150Offset
        });
    }

    _syncPanelOptions() {
        this._syncExtension();
    }

    _syncOnboardOptions() {
        if (!this._destroyed && !this._initializing)
            this._onboardCompensation.setMode(this.onboardAdjustmentEnabled ?
                this.onboardAdjustmentMethod : "none", this._screenPercent, !this._applying);
    }

    _syncTooltips() {
        if (this._modeItem)
            this._modeItem.setTooltipsEnabled(this.showTooltips);
        this._syncFromSystem();
    }

    _commitSlider(percent) {
        return this._applyPercent(percent, this._uiMode, { menu: this.menu, skipUnchanged: true });
    }

    _clearOpeningPreview() {
        if (!this._openingSliderPreview)
            return;
        this._openingSliderPreview = false;
        this._dragActive = false;
        this._syncFromSystem();
    }

    _resetMenuPointer() {
        if (this._sliderItem)
            this._sliderItem.cancelSwitchDrag();
        this._menuMouseDown = false;
        this._openingReleasePending = false;
        this._clearOpeningPreview();
    }

    _pointOnPanel(x, y) {
        return containsPoint(this.actor, x, y) || containsPoint(this.panel && this.panel.actor, x, y);
    }

    // PopupMenuManager calls this before delivering events to child controls.
    // Opening releases choose a value or mode. The band always requires a
    // separate press inside its area, followed by ordinary dragging.
    menuEventFilter(event) {
        if (this._destroyed || !this.menu || !this.menu.isOpen)
            return Clutter.EVENT_PROPAGATE;
        const type = event.type();
        if (type === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
            this._resetMenuPointer();
            if (this._sliderItem)
                this._sliderItem.cancelDrag();
            this.menu.close();
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.SCROLL &&
            ((this._sliderItem && (this._sliderItem.switchDragging || this._sliderItem.switchAnimating)) ||
             (this._openingReleasePending && (event.get_state() & Clutter.ModifierType.BUTTON1_MASK))))
            return Clutter.EVENT_STOP;
        if (type === Clutter.EventType.KEY_PRESS && this._sliderItem &&
            (this._sliderItem.switchDragging || this._sliderItem.switchAnimating))
            return Clutter.EVENT_STOP;
        if (type !== Clutter.EventType.BUTTON_PRESS && type !== Clutter.EventType.BUTTON_RELEASE &&
            type !== Clutter.EventType.MOTION)
            return Clutter.EVENT_PROPAGATE;
        const [x, y] = event.get_coords();
        if (type === Clutter.EventType.BUTTON_PRESS) {
            if (this._sliderItem.switchDragging ||
                (this._sliderItem.switchAnimating && containsPoint(this.menu.actor, x, y) &&
                 !this._sliderItem.containsSwitchBandPoint(x, y)))
                return Clutter.EVENT_STOP;
            if (event.get_button() === 1 && containsPoint(this.menu.actor, x, y)) {
                this._menuMouseDown = true;
                this._openingReleasePending = false;
                this._clearOpeningPreview();
                if (this._sliderItem.beginSwitchDrag(x, y, event.get_device()))
                    return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }
        if (type === Clutter.EventType.MOTION) {
            if (this._sliderItem.switchDragging) {
                return this._sliderItem.handleSwitchMotion(event);
            }
            if (this._menuMouseDown || !this._openingReleasePending)
                return Clutter.EVENT_PROPAGATE;
            if (!(event.get_state() & Clutter.ModifierType.BUTTON1_MASK)) {
                this._openingReleasePending = false;
                this._clearOpeningPreview();
                return Clutter.EVENT_PROPAGATE;
            }
            if (!this._applying && !this._initializing && this._sliderItem.containsSwitchBandPoint(x, y)) {
                this._clearOpeningPreview();
                return Clutter.EVENT_STOP;
            }
            // Only a gesture that already entered the original slider area
            // may keep its preview beyond the vertical endpoints.
            if (!this._applying && !this._initializing &&
                this._sliderItem.containsPoint(x, y, this._openingSliderPreview)) {
                this._openingSliderPreview = true;
                this._dragActive = true;
                this._sliderItem.previewAtPoint(x, y, true);
            } else {
                this._clearOpeningPreview();
            }
            return Clutter.EVENT_PROPAGATE;
        }
        if (event.get_button() !== 1)
            return Clutter.EVENT_PROPAGATE;
        if (this._sliderItem.switchDragging) {
            return this._sliderItem.handleSwitchRelease(event);
        }
        if (this._menuMouseDown || !this._openingReleasePending) {
            // A native slider grab keeps the event source inside the menu
            // even if the pointer has left it. Cancel before closing/ungrabbing.
            if (this._sliderItem.dragging && !containsPoint(this.menu.actor, x, y) && !this._pointOnPanel(x, y)) {
                this._sliderItem.cancelDrag();
                this.menu.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }
        this._openingReleasePending = false;
        const allowVerticalExit = this._openingSliderPreview;
        this._clearOpeningPreview();
        if (!this._applying && !this._initializing) {
            if (this._sliderItem.containsSwitchBandPoint(x, y))
                return Clutter.EVENT_STOP;
            const percent = this._sliderItem.percentAtPoint(x, y, allowVerticalExit);
            if (percent !== null) {
                this._commitSlider(percent);
                return Clutter.EVENT_STOP;
            }
            if (this._modeItem.chooseAtPoint(x, y))
                return Clutter.EVENT_STOP;
        }
        if (!containsPoint(this.menu.actor, x, y) && !this._pointOnPanel(x, y))
            this.menu.close();
        // Also consume an unused opening release: it must not activate a
        // second handler, or close the menu when released elsewhere on the panel.
        return Clutter.EVENT_STOP;
    }

    _applyPendingSwitchPoint() {
        if (!this._switchPointPending || this._destroyed || this._applying || this._initializing)
            return;
        this._switchPointPending = false;
        if (this._uiMode)
            this._applyPercent(this._currentPercent, true);
    }

    _runUiHelper(action, percent) {
        return new Promise((resolve, reject) => {
            try {
                const argv = ["/usr/bin/python3", this._helperPath, action];
                if (percent !== undefined)
                    argv.push(String(percent));
                if (action === "ui") {
                    const point = Number.isFinite(this.screenSwitchPoint) ? this.screenSwitchPoint : 100;
                    argv.push("--switch-point", String(Math.max(50, Math.min(150, Math.round(point / 25) * 25))));
                }
                const process = Gio.Subprocess.new(argv,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                if (action === "status") {
                    this._cancelStatusQuery();
                    this._statusProcess = process;
                }
                process.communicate_utf8_async(null, null, (source, result) => {
                    try {
                        const [, stdout, stderr] = source.communicate_utf8_finish(result);
                        const response = stdout.trim() ? JSON.parse(stdout) : {};
                        if (!source.get_successful()) {
                            const error = new Error(response.error || stderr.trim() || _("The screen scaling could not be changed."));
                            error.diagnostics = response.diagnostics;
                            throw error;
                        }
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    } finally {
                        if (this._statusProcess === source)
                            this._statusProcess = null;
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    _cancelStatusQuery() {
        const process = this._statusProcess;
        this._statusProcess = null;
        if (process) {
            try { process.force_exit(); } catch (error) {}
        }
    }

    _acceptNativeStatus(status) {
        this._nativeAvailable = status.available === true;
        // Keep the initial menu selection until an explicit change succeeds.
        // Compensation still follows the actual scale, even if text is selected.
        this._nativeUiMode = status.ui_mode === true;
        this._uiMode = this._startupModeSelection !== null && this._nativeAvailable ?
            this._startupModeSelection : this._nativeUiMode;
        this._screenPercent = status.screen_percent || 100;
        this._screenStagePercent = status.screen_stage_percent || this._screenPercent;
        this._screenSteps = Array.isArray(status.supported_percent) ? status.supported_percent : [];
        this._screenScales = Array.isArray(status.supported_scales) ? status.supported_scales : [];
        this._uiPercent = status.percent || 100;
    }

    async _refreshUiStatus(action = "status") {
        if (this._destroyed || this._applying || this._startupRunning ||
            (this._initializing && action !== "startup"))
            return;
        if (action === "startup") {
            this._startupRunning = true;
            this._initializing = true;
            this._setControlsBusy(true);
            this._extension.suspend();
        }
        const serial = ++this._uiRefreshSerial;
        try {
            let status = await this._runUiHelper(action);
            if (action === "startup" && !this._destroyed) {
                this._extension.retarget(status.screen_percent || 100);
                await this._waitForShellSettled();
                if (!this._destroyed)
                    status = await this._runUiHelper("status");
            }
            if (this._destroyed || this._applying || serial !== this._uiRefreshSerial)
                return;
            this._acceptNativeStatus(status);
            this._syncFromSystem();
        } catch (error) {
            // Startup/read errors must not interrupt login with notifications.
            if (!this._destroyed && serial === this._uiRefreshSerial)
                global.logError(error);
        } finally {
            if (action === "startup") {
                this._startupRunning = false;
                this._initializing = false;
                if (!this._destroyed) {
                    this._syncOnboardOptions();
                    this._syncFromSystem();
                    this._setControlsBusy(this._applying);
                    this._applyPendingSwitchPoint();
                }
            }
        }
    }

    _setControlsBusy(busy) {
        if (busy) {
            this._resetMenuPointer();
            if (this._sliderItem)
                this._sliderItem.cancelDrag();
        }
        if (this._modeItem)
            this._modeItem.setButtonsSensitive(!busy);
        if (this._sliderItem) {
            this._sliderItem.actor.reactive = !busy;
            this._sliderItem.actor.can_focus = !busy;
            this._sliderItem._slider.reactive = !busy;
            this._sliderItem.setFeedbackSensitive(!busy);
        }
    }

    _traceSwitch(phase, details = {}) {
        const trace = this._switchTrace;
        if (!trace || this._destroyed)
            return;
        try {
            const ms = Math.round((GLib.get_monotonic_time() - trace.started) / 1000);
            trace.events.push({ phase, ms, ...details });
            const { started, ...report } = trace;
            this._tracePending = JSON.stringify(report);
            this._flushTrace();
        } catch (error) {
            // Diagnostic I/O must never prevent a scaling change.
        }
    }

    _flushTrace() {
        if (this._destroyed || this._traceProcess || !this._tracePending)
            return;
        const report = this._tracePending;
        this._tracePending = null;
        try {
            const process = Gio.Subprocess.new(["/usr/bin/python3",
                GLib.build_filenamev([this._appletPath, "onboard-process.py"]), "trace"],
                Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            this._traceProcess = process;
            process.communicate_utf8_async(report, null, (source, result) => {
                try { source.communicate_utf8_finish(result); } catch (error) {}
                if (this._traceProcess === process)
                    this._traceProcess = null;
                // Only the latest pending snapshot is needed. Serializing
                // writes prevents an older phase replacing the final report.
                this._flushTrace();
            });
        } catch (error) {
            this._traceProcess = null;
        }
    }

    _waitForShellSettled() {
        if (this._destroyed)
            return Promise.resolve(false);
        return new Promise(resolve => {
            const started = GLib.get_monotonic_time();
            let changed = started;
            let context = null;
            let contextId = 0;
            let sourceId = 0;
            let finished = false;
            const task = { cancel: () => finish(false) };
            const finish = result => {
                if (finished)
                    return;
                finished = true;
                if (sourceId)
                    Mainloop.source_remove(sourceId);
                if (contextId) {
                    try { context.disconnect(contextId); } catch (error) {}
                }
                if (this._settleTask === task)
                    this._settleTask = null;
                resolve(result);
            };
            this._settleTask = task;
            try {
                if (St.ThemeContext) {
                    context = St.ThemeContext.get_for_stage(global.stage);
                    contextId = context.connect("changed", () => { changed = GLib.get_monotonic_time(); });
                }
            } catch (error) {}
            // Let settings-daemon, Cinnamon's DPI updates and RandR events
            // finish before starting the next kind of change. A noisy theme
            // cannot keep this wait alive indefinitely (1 s maximum).
            sourceId = Mainloop.timeout_add(50, () => {
                const now = GLib.get_monotonic_time();
                if (now - started < 150000 || (now - changed < 100000 && now - started < 1000000))
                    return true;
                sourceId = 0;
                finish(true);
                return false;
            });
        });
    }

    _targetScreenStage(percent, uiMode) {
        if (!uiMode)
            return 100;
        const steps = this._screenSteps;
        let stage = steps[0] || 100;
        const point = Number.isFinite(this.screenSwitchPoint) ?
            Math.max(50, Math.min(150, Math.round(this.screenSwitchPoint / 25) * 25)) : 100;
        for (let index = 1; index < steps.length; index++) {
            const upper = steps[index];
            const boundary = steps[index - 1] + (upper - steps[index - 1]) * point / 100;
            if (percent > boundary || (point >= 100 && percent >= boundary))
                stage = upper;
            else
                break;
        }
        return stage;
    }

    _targetScreenPercent(percent, uiMode) {
        const stage = this._targetScreenStage(percent, uiMode);
        const scale = this._screenScales[this._screenSteps.indexOf(stage)];
        // A nominal level such as 175% may represent a slightly different
        // native factor. Compare the factors the helper will actually apply.
        return Number.isFinite(scale) && scale > 0 ? scale * 100 : stage;
    }

    async _applyPercent(percent, uiMode = this._uiMode, { menu = null, skipUnchanged = false } = {}) {
        if (this._destroyed || this._applying || this._initializing || !Number.isFinite(percent))
            return false;
        const selected = Math.round(clampPercent(percent));
        const beforeText = this._interface.get_double(TEXT_KEY);
        const beforeScreen = this._screenPercent;
        const targetScreen = this._targetScreenPercent(selected, uiMode);
        const screenChanges = targetScreen !== beforeScreen;
        const textChanges = factor => !Number.isFinite(beforeText) ||
            Math.abs(factor - beforeText) >= TEXT_FACTOR_EPSILON;
        const scaleChanges = screenChanges || textChanges(selected / targetScreen);
        if (skipUnchanged && !scaleChanges) {
            this._syncFromSystem();
            return true;
        }

        let closedMenu = false;
        const closeMenu = () => {
            if (menu && this.menu === menu && menu.isOpen) {
                menu.close(false);
                closedMenu = true;
            }
        };
        this._switchPointPending = false;
        this._applying = true;
        ++this._uiRefreshSerial;
        this._setControlsBusy(true);
        let success = false;
        this._switchTrace = { version: this._version, started: GLib.get_monotonic_time(),
            from: { mode: this._uiMode ? "screen" : "text", percent: this._uiMode ? this._uiPercent : beforeText * 100 },
            to: { mode: uiMode ? "screen" : "text", percent: selected }, events: [] };
        this._traceSwitch("begin");
        try {
            this._extension.prepareDesklets(this.keepDeskletCenters);
            await this._onboardCompensation.prepare(this._screenPercent);
            if (this._destroyed)
                return false;
            // The input event and its slider grab have finished. Hide the
            // popup before any change can move or resize the panel actors.
            if (scaleChanges)
                closeMenu();
            this._cancelStatusQuery();
            if (screenChanges) {
                this._traceSwitch("onboard-stop:start");
                await this._onboardCompensation.pause();
                this._traceSwitch("onboard-stop:done");
                if (this._destroyed)
                    return false;
            }
            this._traceSwitch("panel-pause:start");
            this._extension.suspend();
            this._traceSwitch("panel-pause:done");
            this._traceSwitch("native:start");
            const status = await this._runUiHelper(uiMode ? "ui" : "text", selected);
            if (this._destroyed)
                return false;
            this._startupModeSelection = null;
            this._acceptNativeStatus(status);
            // The helper reads a fresh configuration. Use its result as well
            // if an external display change made our previous status stale.
            if (this._screenPercent !== beforeScreen || textChanges(status.text_factor))
                closeMenu();
            this._extension.retarget(this._screenPercent);
            this._traceSwitch("native:done", { screenPercent: this._screenPercent,
                screenStagePercent: this._screenStagePercent,
                textFactor: status.text_factor, helper: status.diagnostics || null });
            this._traceSwitch("display-settle:start");
            await this._waitForShellSettled();
            this._traceSwitch("display-settle:done");
            if (this._destroyed)
                return false;
            success = true;
        } catch (error) {
            this._traceSwitch("error", { error: error.message || String(error), helper: error.diagnostics || null });
            // The subprocess rolls display and text back together. A shell
            // write here could overwrite a newer external font change.
            global.logError(error);
            Main.notifyError(_("Display Scale"), error.message || String(error));
        } finally {
            // Also resume a keyboard we stopped if the applet was removed
            // while waiting for Onboard or the native helper.
            try { await this._onboardCompensation.finish(this._screenPercent); }
            catch (error) {
                global.logError(error);
                if (!this._destroyed)
                    Main.notifyError(_("Display Scale"), error.message || String(error));
            }
            this._applying = false;
            if (!this._destroyed) {
                this._syncOnboardOptions();
                this._traceSwitch("panel-start:start");
                this._syncFromSystem();
                this._traceSwitch("panel-start:done");
                if (success)
                    this._extension.redraw();
                this._setControlsBusy(false);
                if (!success && closedMenu && menu === this.menu && !menu.isOpen &&
                    !Main.modalCount && !this._switchPointPending) {
                    menu.open(false);
                    this._openingReleasePending = false;
                } else {
                    this._refreshUiStatus();
                }
            }
            this._traceSwitch("done", { success, removed: this._destroyed });
            this._applyPendingSwitchPoint();
        }
        return success;
    }

    on_applet_clicked() {
        // A closed menu cannot reappear halfway through a display change.
        // A band operation that keeps the menu open can still be dismissed.
        if (!this._applying || this.menu.isOpen)
            this.menu.toggle();
    }

    on_orientation_changed(orientation) {
        if (this._interface && !this._destroyed)
            this._createMenu(orientation);
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        this._tracePending = null;
        this._resetMenuPointer();
        this._cancelStatusQuery();
        if (this._settleTask)
            this._settleTask.cancel();
        this._extension.destroy();
        this._onboardCompensation.destroy();
        ++this._uiRefreshSerial;
        if (this._sliderItem)
            this._sliderItem.cancelDrag();
        if (this._textChangedId) {
            this._interface.disconnect(this._textChangedId);
            this._textChangedId = 0;
        }
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }
        if (this.settings)
            this.settings.finalize();
        if (this.menu)
            this.menu.destroy();
        if (this.menuManager)
            this.menuManager.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new DisplayScaleApplet(metadata, orientation, panelHeight, instanceId);
}
