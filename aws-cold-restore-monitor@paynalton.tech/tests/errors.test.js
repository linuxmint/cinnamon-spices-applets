/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/** Classification, recovery, and lifecycle tests using simulated Cinnamon and Gio APIs. */
const {test} = require('node:test');
const assert = require('node:assert/strict');

const {moduleContext, harness} = require('./helpers/applet');
const errors = moduleContext('errors');

test('classifies known failures, conservatively treating unknown errors as critical', () => {
    for (const [stage, text, code, expected] of [
        ['timeout', '', null, 'temporary'], ['cli', 'ThrottlingException', 254, 'temporary'],
        ['cli', 'Could not connect to the endpoint URL', 255, 'temporary'],
        ['cli', 'ServiceUnavailableException', 254, 'temporary'],
        ['cli', 'ExpiredTokenException', 254, 'critical'], ['cli', 'AccessDeniedException', 254, 'critical'],
        ['cli', 'ResourceNotFoundException', 254, 'critical'], ['cli', 'SSL validation failed', 255, 'critical'],
        ['spawn', 'No such file', null, 'critical'], ['response', 'bad JSON', null, 'critical'],
        ['cli', '', 253, 'critical'], ['cli', 'unexpected', 255, 'critical'],
        ['transport', 'interrupted', null, 'temporary']
    ]) assert.equal(errors.classify(stage, text, code).severity, expected, text);
    assert.equal(errors.classify('cli', 'AccessDeniedException secret-account-id', 254).message.includes('secret-account-id'), false);
});

test('retry delay backs off and respects both bounds and configured intervals', () => {
    assert.deepEqual([1, 2, 3, 10].map(n => errors.retryDelay(30, n)), [30, 60, 120, 300]);
    assert.equal(errors.retryDelay(3600, 10), 3600);
    assert.equal(errors.retryDelay(NaN, 1), 30);
});

test('temporary failures notify once, retain stale data during retry and clear on recovery', () => {
    const h = harness();
    h.processes[0].complete();
    h.tick(h.applet._timer);
    h.processes[1].complete(255, '', 'Could not connect to endpoint');
    assert.equal(h.applet._job.percent, 42);
    assert.equal(h.notifications.length, 1);
    h.tick(h.applet._timer);
    assert.match(h.applet._label.text, /Retrying/);
    assert.match(h.applet._details.status.text, /previous result/);
    h.processes[2].complete(255, '', 'Could not connect to endpoint');
    assert.equal(h.notifications.length, 1);
    assert.equal(h.timers.get(h.applet._timer).seconds, 60);
    h.tick(h.applet._timer);
    h.processes[3].complete();
    assert.equal(h.applet._issue, null);
    assert.equal(h.applet._failures, 0);
});

test('critical authentication error stays visible, pauses polling and allows manual recovery', () => {
    const h = harness();
    h.processes[0].complete(254, '', 'ExpiredTokenException');
    assert.equal(h.notifications[0].severity, 'critical');
    assert.equal(h.timers.size, 0);
    h.applet._guard(() => h.applet._refresh());
    assert.equal(h.applet._issue.code, 'credentials');
    h.processes[1].complete();
    assert.equal(h.applet._issue, null);
    assert.ok(h.applet._timer);
});

test('timeout cancels process and communication, retries, and ignores late results', () => {
    const h = harness(), old = h.processes[0], cancellable = h.applet._cancellable;
    h.tick(h.applet._timeout);
    assert.equal(old.killed, true);
    assert.equal(cancellable.cancelled, true);
    assert.equal(h.applet._issue.code, 'timeout');
    old.complete();
    assert.equal(old.consumed, true);
    assert.equal(h.applet._job, null);
    assert.equal(h.notifications.length, 1);
    h.tick(h.applet._timer);
    h.processes[1].complete();
    assert.equal(h.applet._issue, null);
});

test('configuration changes and removal silently discard old callbacks and release resources', () => {
    const h = harness(), old = h.processes[0];
    h.applet._guard(() => h.applet._restart());
    old.complete(254, '', 'AccessDeniedException');
    assert.equal(h.notifications.length, 0);
    assert.equal(h.applet._process, h.processes[1]);
    h.applet.on_applet_removed_from_panel();
    h.processes[1].complete();
    assert.equal(h.timers.size, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.applet.settings.finalized, true);
    assert.equal(h.applet.menu.destroyed, true);
});

test('invalid JSON and failed or aborted restores are critical; missing percent is a warning', () => {
    for (const output of ['bad', '{"Status":"FAILED"}', '{"Status":"ABORTED"}']) {
        const h = harness(); h.processes[0].complete(0, output);
        assert.equal(h.applet._issue.severity, 'critical');
        assert.equal(h.timers.size, 0);
    }
    const h = harness(); h.processes[0].complete(0, '{"Status":"PENDING"}');
    assert.equal(h.applet._issue, null);
    assert.equal(h.notifications.length, 1);
    assert.ok(h.applet._timer);
});

test('spawn, setup, timers, settings and rendering errors do not escape to Cinnamon', () => {
    for (const name of ['spawnFail', 'asyncFail', 'timerFail', 'settingsFail', 'renderFail']) {
        const h = harness({[name]: true});
        assert.equal(h.applet._issue.severity, 'critical', name);
        assert.equal(h.timers.size, 0, name);
        assert.ok(h.notifications.length, name);
    }
});

test('notification failure has a menu fallback; cleanup continues when a resource throws', () => {
    const h = harness({notifyFail: true}); h.processes[0].complete(254, '', 'AccessDeniedException');
    assert.match(h.applet._details.message.text, /Could not send/);
    const other = harness({finalizeFail: true}); other.applet.on_applet_removed_from_panel();
    assert.equal(other.applet.menu.destroyed, true);
    assert.equal(other.timers.size, 0);
});

test('failure to terminate a process escalates and pauses automatic retries', () => {
    const h = harness({killFail: true}); h.tick(h.applet._timeout);
    assert.equal(h.applet._issue.code, 'internal');
    assert.equal(h.timers.size, 0);
});

test('transport failures release the running process and retry without losing the incident', () => {
    const h = harness(); h.processes[0].transportError = true;
    h.processes[0].complete();
    assert.equal(h.processes[0].killed, true);
    assert.equal(h.applet._process, null);
    assert.equal(h.applet._issue.severity, 'temporary');
    assert.ok(h.applet._timer);
});

test('successful CLI warnings notify only once until the warning clears', () => {
    const h = harness();
    for (let i = 0; i < 2; i++) {
        h.processes[i].complete(0, '{"Status":"RUNNING","PercentDone":"12"}', 'warning with private data');
        assert.equal(h.notifications.length, 1);
        h.tick(h.applet._timer);
    }
    assert.equal(h.notifications[0].message.includes('private data'), false);
    h.processes[2].complete();
    h.tick(h.applet._timer);
    h.processes[3].complete(0, '{"Status":"RUNNING","PercentDone":"12"}', 'warning');
    assert.equal(h.notifications.length, 2);
});

test('configuration action and retry scheduling failures are contained and pause polling', () => {
    const options = {configureFail: true};
    const h = harness(options);
    h.applet._guard(() => h.applet.configureApplet());
    assert.equal(h.applet._issue.code, 'internal');
    assert.equal(h.timers.size, 0);
    const timerOptions = {};
    const other = harness(timerOptions);
    timerOptions.timerFail = true;
    other.processes[0].complete();
    assert.equal(other.applet._issue.code, 'internal');
    assert.equal(other.timers.size, 0);
});
