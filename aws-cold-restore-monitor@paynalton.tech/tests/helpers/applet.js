/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/** Shared Cinnamon/Gio test doubles; never reads credentials or contacts AWS. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '../../files/aws-cold-restore-monitor@paynalton.tech');

/** Loads a Cinnamon module into an isolated Node context. */
function moduleContext(name) {
    const context = vm.createContext({require: name => { if (name === './i18n') return {_: text => text}; throw Error(name); }});
    vm.runInContext(fs.readFileSync(path.join(base, name + '.js'), 'utf8'), context);
    return context;
}
const errors = moduleContext('errors');

/**
 * Constructs the real applet with actor, settings, timer, and process test doubles.
 * Allows old processes to finish out of order without network access or real credentials.
 * @param {Object} [options={}] Settings overrides and simulated failure switches.
 * @param {Object} [options.config] Synthetic settings supplied instead of defaults.
 * @param {string} [options.privateError] Synthetic detail for privacy failure checks.
 * @returns {Object} Applet and captured processes, argv, environment, notifications and logs.
 */
function harness(options = {}) {
    const timers = new Map(), processes = [], launches = [], environment = {}, notifications = [], logs = [];
    let nextId = 1;
    /** Minimal actor that accepts plain text and simulates rendering failures. */
    class Actor {
        constructor(props = {}) { Object.assign(this, props); this.clutter_text = {set_line_wrap() {}}; }
        set_text(text) { if (options.renderFail) throw Error(options.privateError || 'render'); this.text = text; }
        set_style() {} set_child() {} add_child() {}
        add_style_class_name() {} remove_style_pseudo_class() {}
    }
    /** Applet base exposing the local actor, tooltip and configuration action. */
    class BaseApplet {
        constructor() { this.actor = new Actor(); }
        set_applet_tooltip(text) { this.tooltip = text; }
        configureApplet() { if (options.configureFail) throw Error('settings'); }
    }
    /** Minimal menu with observable destruction. */
    class Menu {
        addMenuItem() {} addAction() {} toggle() {}
        destroy() { this.destroyed = true; }
    }
    /** Settings binding with per-test configuration and cleanup failures. */
    class Settings {
        constructor(target) { if (options.settingsFail) throw Error('settings'); this.target = target; }
        bind(key) { this.target[key] = {...{profile: 'default', region: 'us-east-1', restoreJobId: 'test', awsPath: 'aws', pollSeconds: 30}, ...options.config}[key]; }
        finalize() { this.finalized = true; if (options.finalizeFail) throw Error('finalize'); }
    }
    /** Controllable asynchronous process with exit, cancellation and completion state. */
    class Process {
        communicate_utf8_async(input, cancellable, callback) {
            this.callback = callback;
            if (options.asyncFail) throw Error('async setup');
        }
        communicate_utf8_finish() {
            this.consumed = true;
            if (this.transportError) throw Error('connection interrupted');
            return [true, this.output, this.stderr || ''];
        }
        get_successful() { return this.code === 0; }
        get_if_exited() { return true; }
        get_exit_status() { return this.code; }
        force_exit() { this.killed = true; if (options.killFail) throw Error('kill'); }
        complete(code = 0, output = '{"Status":"RUNNING","PercentDone":"42"}', stderr = '') {
            Object.assign(this, {code, output, stderr}); this.callback(this, {});
        }
    }
    const notify = severity => (title, message) => {
        if (options.notifyFail) throw Error(options.privateError || 'notification');
        notifications.push({severity, title, message});
    };
    const context = vm.createContext({
        require: name => name === './i18n' ? {_: text => text} : name === './errors' ? errors : moduleContext('model'),
        global: {logError: text => logs.push(text)},
        imports: {
            ui: {
                slider: {Slider: class {
                    constructor(value) { this.actor = new Actor(); this.value = value; }
                    setValue(value) { this.value = value; }
                }},
                applet: {Applet: BaseApplet, AppletPopupMenu: Menu},
                popupMenu: {PopupMenuManager: class {addMenu() {}}, PopupMenuItem: class {constructor() {this.label = new Actor(); this.actor = new Actor();}}, PopupSeparatorMenuItem: class {}},
                settings: {AppletSettings: Settings}, main: {notify: notify('temporary'), criticalNotify: notify('critical')}
            },
            mainloop: {
                timeout_add_seconds(seconds, callback) { if (options.timerFail) throw Error('timer'); const id = nextId++; timers.set(id, {seconds, callback}); return id; },
                source_remove(id) { timers.delete(id); }
            },
            gi: {
                St: {BoxLayout: Actor, Label: Actor, Bin: Actor, Widget: Actor},
                Clutter: {ActorAlign: {CENTER: 0, START: 1}}, GLib: {SOURCE_REMOVE: false},
                Gio: {SubprocessFlags: {STDOUT_PIPE: 1, STDERR_PIPE: 2},
                    Cancellable: class {cancel() {this.cancelled = true;}},
                    SubprocessLauncher: class {
                        setenv(key, value) { environment[key] = value; }
                        spawnv(argv) { launches.push(Array.from(argv)); if (options.spawnFail) throw Error(options.privateError || 'not found'); const p = new Process(); processes.push(p); return p; }
                    }}
            }
        }
    });
    vm.runInContext("String.prototype.format = function (...args) { let i = 0; return this.replace(/%s/g, () => String(args[i++])); };", context);
    vm.runInContext(fs.readFileSync(path.join(base, 'applet.js'), 'utf8'), context);
    const applet = context.main({uuid: 'test'}, 0, 30, 1);
    return {applet, processes, timers, notifications, logs, launches, environment,
        tick(id) { const timer = timers.get(id); assert.ok(timer); timers.delete(id); timer.callback(); }};
}


module.exports = {moduleContext, harness};
