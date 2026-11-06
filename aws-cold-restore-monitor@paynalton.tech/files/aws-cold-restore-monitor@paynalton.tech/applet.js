/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { _ } = require('./i18n');
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Model = require('./model');
const Errors = require('./errors');
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Slider = imports.ui.slider;

/**
 * AWS Cold Restore Monitor: a horizontal panel applet for tracking the status and
 * progress of a cold storage restore through AWS Backup.
 * Each instance owns its settings, menu, and last successful result.
 * Queries use asynchronous Gio communication; the next query is scheduled when the
 * previous one finishes. A generation counter discards responses from older
 * configurations or an instance that has been removed from the panel.
 *
 * @extends Applet.Applet
 */
class ColdRestoreMonitorApplet extends Applet.Applet {
    /**
     * Creates panel and menu actors, binds persistent settings, and requests the first
     * update if the configuration is complete.
     *
     * @param {Object} metadata Metadata provided by Cinnamon when loading the applet.
     * @param {string} metadata.uuid UUID used to persist settings.
     * @param {St.Side} orientation Panel side provided by Cinnamon.
     * @param {number} panelHeight Panel size in pixels.
     * @param {number} instanceId Cinnamon identifier for this instance.
     */
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        /** @private {boolean} Prevents further queries after the applet is removed. */
        this._disposed = false;
        /** @private {Object|null} Pending issue, retained until recovery or a settings restart. */
        this._issue = null;
        /** @private {number} Consecutive temporary failures used to calculate retry delays. */
        this._failures = 0;
        /** @private {Set<string>} Issue codes already notified during the current episode. */
        this._notified = new Set();
        /** @private {Gio.Cancellable|null} Cancels communication in addition to terminating the process. */
        this._cancellable = null;
        /** @private {number} Identifies which asynchronous responses are still current. */
        this._generation = 0;
        /** @private {number} Mainloop source for the next query, or 0 when absent. */
        this._timer = 0;
        /** @private {number} Mainloop source for the execution deadline, or 0 when absent. */
        this._timeout = 0;
        /** @private {Gio.Subprocess|null} AWS CLI process currently running. */
        this._process = null;
        /** @private {RestoreJob|null} Last valid response for the current configuration. */
        this._job = null;
        /** @private {Date|null} Local receipt time of the last valid response. */
        this._updated = null;

        this._box = new St.BoxLayout({style_class: 'aws-cold-restore-content'});
        this._label = new St.Label({text: _("AWS · Configure"), style_class: 'applet-label',
            y_align: Clutter.ActorAlign.CENTER});
        // Native control: colors, borders, and height come from the Cinnamon theme.
        // Only displays reported progress; users cannot drag it or change its value.
        this._progress = new Slider.Slider(0);
        this._progress.actor.add_style_class_name('aws-cold-restore-progress');
        this._progress.actor.reactive = false;
        this._progress.actor.can_focus = false;
        this._progress.actor.y_align = Clutter.ActorAlign.CENTER;
        this._box.add_child(this._label);
        this._box.add_child(this._progress.actor);
        this.actor.add_child(this._box);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._details = {};
        for (const key of ['status', 'percent', 'job', 'profile', 'created', 'completed', 'updated', 'message']) {
            const item = new PopupMenu.PopupMenuItem('', {reactive: false});
            item.label.clutter_text.set_line_wrap(true);
            // Informational text uses normal theme contrast without activating the row.
            item.actor.remove_style_pseudo_class('insensitive');
            item.label.add_style_class_name('aws-cold-restore-detail');
            this.menu.addMenuItem(item);
            this._details[key] = item.label;
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // Actions delegate querying and opening the Cinnamon settings editor.
        this.menu.addAction(_("Refresh now"), () => this._guard(() => this._refresh()));
        this.menu.addAction(_("Configure…"), () => this._guard(() => this.configureApplet()));

        this._guard(() => {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            for (const key of ['profile', 'region', 'restoreJobId', 'pollSeconds', 'awsPath'])
                this.settings.bind(key, key, () => this._guard(() => this._restart()));
            this._restart();
        });
    }

    /**
     * Contains exceptions from actions and callbacks; internal errors pause monitoring.
     * @param {Function} action Protected synchronous action. Callbacks are guarded separately.
     * @returns {void}
     */
    _guard(action) {
        if (this._disposed) return;
        try { action(); }
        catch (e) {
            this._cancel();
            this._report(Errors.classify('internal', e));
        }
    }

    /** Toggles the menu without propagating errors to the Cinnamon event loop. */
    on_applet_clicked() { this._guard(() => this.menu.toggle()); }

    /**
     * Also protects the Configure action in the native Cinnamon context menu.
     * @param {number} [tab=0] Tab to open in the settings editor.
     */
    configureApplet(tab = 0) { this._guard(() => super.configureApplet(tab)); }

    /**
     * Removes a source, clearing its stored ID before releasing the resource.
     * @param {'_timer'|'_timeout'} key Property containing the Mainloop source ID.
     */
    _removeTimer(key) {
        const id = this[key];
        this[key] = 0;
        if (id) Mainloop.source_remove(id);
    }

    /**
     * Cancels all operations, attempting each cleanup even if another fails.
     * Invalidates callbacks before cancelling Gio; intentional cancellation is silent.
     * @returns {boolean} false if any resource could not be released.
     */
    _cancel() {
        this._generation++;
        let ok = true;
        const attempt = action => { try { action(); } catch (e) { ok = false; } };
        for (const key of ['_timer', '_timeout']) attempt(() => this._removeTimer(key));
        const process = this._process;
        const cancellable = this._cancellable;
        this._process = null;
        this._cancellable = null;
        if (process) attempt(() => process.force_exit());
        if (cancellable) attempt(() => cancellable.cancel());
        return ok;
    }

    /** Restarts monitoring with the current settings and a fresh notification episode. */
    _restart() {
        if (!this._cancel()) {
            this._report(Errors.classify('internal'));
            return;
        }
        this._job = null;
        this._updated = null;
        this._issue = null;
        this._failures = 0;
        this._notified.clear();
        this._refresh();
    }

    /**
     * Emits one notification per code and episode, without stderr or AWS identifiers.
     * If the notification service fails, attempts to display a fallback in the menu.
     * @param {Object} issue Issue classified by Errors.
     */
    _notify(issue) {
        if (this._notified.has(issue.code)) return;
        this._notified.add(issue.code);
        try {
            if (issue.severity === 'critical')
                Main.criticalNotify('AWS Cold Restore Monitor', issue.message);
            else Main.notify('AWS Cold Restore Monitor', issue.message);
        } catch (e) {
            try { this._details.message.set_text([issue.message, _("Could not send the system notification.")].join('\n')); }
            catch (ignored) { global.logError('AWS Cold Restore Monitor: could not display the notification.'); }
        }
    }

    /**
     * Presents an issue with fallbacks for rendering or notification failures.
     * Critical issues remain visible and prevent further automatic queries.
     * @param {Object} issue Issue containing severity, message, and retry policy.
     */
    _report(issue) {
        if (this._disposed) return;
        this._issue = issue;
        try { this._render(''); }
        catch (e) {
            this._issue = Errors.classify('internal');
            this._cancel();
            try { this._label.set_text(_("AWS · Internal error")); } catch (ignored) { /* Fall back to a notification. */ }
        }
        this._notify(this._issue);
    }

    /**
     * Renders the state while retaining pending errors until recovery or a settings restart.
     * @param {string} message Query message used when there is no pending issue.
     */
    _render(message) {
        const job = this._job;
        const issue = this._issue;
        const percent = job ? job.percent : null;
        const progress = percent === null ? _("no percentage") : `${percent}%`;
        const critical = issue && issue.severity === 'critical';
        const stale = issue && issue.code !== 'job-failed' && issue.code !== 'job-aborted';
        const detail = issue ? issue.message : message;
        this._label.set_text(issue ? (critical ? _("AWS · Error") : _("AWS · Retrying")) : job ? _("AWS %s").format(progress) : _("AWS · %s").format(message));
        this._progress.setValue(percent === null ? 0 : percent / 100);
        this._progress.actor.visible = percent !== null;
        const status = job ? job.Status : '—';
        const tooltip = [_("AWS Cold Restore Monitor: %s").format(detail)];
        if (job) tooltip.push(_("%s · %s").format(status, progress));
        tooltip.push(this.restoreJobId || _("Right-click and choose Configure to select a restore job."));
        this.set_applet_tooltip(tooltip.join('\n'));
        const messages = [detail];
        if (critical) messages.push(_("Automatic queries are paused. Fix the problem and click Refresh now or change the settings."));
        if (job && job.StatusMessage) messages.push(_("AWS: %s").format(String(job.StatusMessage).slice(0, 1800)));
        const values = {
            status: stale && job ? _("Status: %s (previous result; query pending)").format(status) : _("Status: %s").format(status),
            percent: _("Estimated progress: %s").format(progress),
            job: _("Job: %s").format(this.restoreJobId || _("not configured")),
            profile: _("Profile: %s · Region: %s").format(this.profile || '—', this.region || '—'),
            created: _("Started: %s").format(Model.dateText(job && job.CreationDate)),
            completed: _("Completed: %s").format(Model.dateText(job && job.CompletionDate)),
            updated: _("Last successful query: %s").format(this._updated ? this._updated.toLocaleString() : '—'),
            message: messages.join('\n')
        };
        for (const key of Object.keys(values)) this._details[key].set_text(values[key]);
    }

    /** Schedules the next attempt; critical errors require user intervention. */
    _schedule() {
        if (this._disposed || this._issue && !this._issue.retry) return;
        this._removeTimer('_timer');
        this._timer = Mainloop.timeout_add_seconds(Errors.retryDelay(this.pollSeconds, this._failures), () => {
            this._timer = 0;
            this._guard(() => this._refresh());
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Records a failure and reschedules only when recovery can be attempted automatically.
     * @param {Object} issue Classified issue.
     */
    _failed(issue) {
        if (issue.retry) this._failures++;
        this._report(issue);
        this._schedule();
    }

    /**
     * Starts a query without waiting synchronously for AWS CLI.
     * Launch, communication, timeout, exit status, and JSON errors are handled separately.
     * A manual refresh can retry after a critical error; a running query is left in progress.
     */
    _refresh() {
        if (this._disposed || this._process) return;
        this._removeTimer('_timer');
        if (!this.settings) {
            this._report(Errors.classify('internal'));
            return;
        }
        if (![this.profile, this.region, this.restoreJobId, this.awsPath].every(v => typeof v === 'string' && v.trim())) {
            // A fresh installation without a job configured is not an AWS failure.
            if (!this.restoreJobId && !this._issue) this._render(_("Configure"));
            else this._report(Errors.issue('configuration', 'critical', _("Enter the profile, region, restore job ID, and AWS CLI path in Configure.")));
            return;
        }
        if (!Number.isFinite(this.pollSeconds) || this.pollSeconds < 10 || this.pollSeconds > 3600) {
            this._report(Errors.issue('interval', 'critical', _("The interval must be between 10 and 3600 seconds. Check the settings.")));
            return;
        }
        this._render(_("Querying…"));
        const generation = this._generation;
        let process;
        try {
            const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE});
            launcher.setenv('AWS_PAGER', '', true);
            launcher.setenv('AWS_CLI_AUTO_PROMPT', 'off', true);
            // Keeps CLI error classification independent of the desktop language.
            launcher.setenv('LC_ALL', 'C', true);
            process = launcher.spawnv(Model.command(this));
        } catch (e) {
            this._failed(Errors.classify('spawn', e));
            return;
        }
        this._process = process;
        this._cancellable = new Gio.Cancellable();
        this._timeout = Mainloop.timeout_add_seconds(60, () => {
            this._timeout = 0;
            this._guard(() => {
                const cancelled = this._cancel();
                this._failed(Errors.classify(cancelled ? 'timeout' : 'internal'));
            });
            return GLib.SOURCE_REMOVE;
        });
        process.communicate_utf8_async(null, this._cancellable, (source, result) => {
            let output, stderr, failure;
            try {
                const [ok, out, err] = source.communicate_utf8_finish(result);
                if (!ok) throw new Error('Communication failed');
                output = out;
                stderr = err;
            } catch (e) { failure = e; }
            // Even cancelled callbacks must consume their Gio result.
            if (this._disposed || generation !== this._generation) return;
            this._guard(() => {
                this._removeTimer('_timeout');
                if (failure) {
                    const cancelled = this._cancel();
                    this._failed(Errors.classify(cancelled ? 'transport' : 'internal', failure));
                    return;
                }
                this._process = null;
                this._cancellable = null;
                if (!source.get_successful()) {
                    const code = source.get_if_exited() ? source.get_exit_status() : 130;
                    this._failed(Errors.classify('cli', stderr, code));
                    return;
                }
                let job;
                try { job = Model.parseJob(output); }
                catch (e) { this._failed(Errors.classify('response', e)); return; }
                const recovering = this._issue !== null;
                this._job = job;
                this._updated = new Date();
                this._issue = null;
                this._failures = 0;
                if (['FAILED', 'ABORTED'].includes(job.Status)) {
                    this._report(Errors.issue('job-' + job.Status.toLowerCase(), 'critical',
                        job.Status === 'FAILED' ? _("AWS reports that the restore failed. Review the job in AWS Backup.") : _("AWS reports that the restore was aborted. Review the job in AWS Backup.")));
                    return;
                }
                if (recovering) this._notified.clear();
                this._render(_("Query successful"));
                if (job.percent === null)
                    this._notify(Errors.issue('percent', 'warning', _("AWS has not reported a valid percentage. The job status is still available.")));
                else this._notified.delete('percent');
                if (stderr && stderr.trim())
                    this._notify(Errors.issue('cli-warning', 'warning', _("The query succeeded, but AWS CLI issued a warning. Run the query in your terminal to review it.")));
                else this._notified.delete('cli-warning');
                this._schedule();
            });
        });
    }

    /** Releases each resource even if another fails; no new notifications after removal. */
    on_applet_removed_from_panel() {
        this._disposed = true;
        const ok = this._cancel();
        for (const action of [() => { if (this.settings) this.settings.finalize(); }, () => this.menu.destroy()]) {
            try { action(); }
            catch (e) { global.logError('AWS Cold Restore Monitor: resource cleanup failed.'); }
        }
        if (!ok) global.logError('AWS Cold Restore Monitor: could not cancel all resources.');
    }
}

/**
 * Creates an instance, attempting to notify construction failures before Cinnamon
 * handles the failed load. An interface that could not be created cannot be recovered here.
 * @param {Object} metadata Applet metadata.
 * @param {St.Side} orientation Panel side.
 * @param {number} panelHeight Panel height.
 * @param {number} instanceId Instance identifier.
 * @returns {ColdRestoreMonitorApplet} Initialized instance.
 * @throws {Error} If the applet cannot be constructed.
 */
function main(metadata, orientation, panelHeight, instanceId) {
    try { return new ColdRestoreMonitorApplet(metadata, orientation, panelHeight, instanceId); }
    catch (e) {
        try { Main.criticalNotify('AWS Cold Restore Monitor', _("Could not load the applet. Check the installation and add it again.")); }
        catch (ignored) { global.logError('AWS Cold Restore Monitor: initialization failed.'); }
        throw new Error('AWS Cold Restore Monitor: could not initialize the applet.');
    }
}
