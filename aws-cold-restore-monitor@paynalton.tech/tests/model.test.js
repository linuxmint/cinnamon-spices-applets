/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Model contract tests without Cinnamon or real AWS calls.
 * The VM context exposes module globals without changing the Cinnamon module format.
 * Run with node --test tests/model.test.js.
 * @file
 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const model = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../files/aws-cold-restore-monitor@paynalton.tech/model.js'), 'utf8'), model);

/** Checks percentage bounds and formats, including missing progress for COMPLETED. */
test('AWS percentages: zero, decimals, optional percent suffix and unavailable values', () => {
    for (const [raw, expected] of [['0', 0], ['42.75', 42.75], ['100%', 100], [12, 12], [null, null], ['', null], ['N/A', null], ['12bad', null], [-1, null], [101, null]])
        assert.equal(model.parseJob(JSON.stringify({Status: 'RUNNING', PercentDone: raw})).percent, expected);
    assert.equal(model.parseJob('{"Status":"COMPLETED"}').percent, null);
});

/** Checks that invalid JSON and missing or incorrectly typed statuses raise errors. */
test('rejects invalid output without fabricating progress', () => {
    for (const output of ['bad', 'null', '{}', '{"Status":2}'])
        assert.throws(() => model.parseJob(output));
});

/** Checks argv with spaces and literal shell syntax without executing commands. */
test('configuration values remain separate literal arguments, never shell code', () => {
    const job = 'job; touch /tmp/should-not-exist';
    const args = Array.from(model.command({awsPath: '/a path/aws', profile: '$(whoami)', region: 'us-east-1', restoreJobId: job}));
    assert.equal(args[0], '/a path/aws');
    assert.equal(args[args.indexOf('--profile') + 1], '$(whoami)');
    assert.equal(args[args.indexOf('--restore-job-id') + 1], job);
    assert.equal(args[args.indexOf('--output') + 1], 'json');
});

/** Checks missing dates and equivalence between Unix seconds and an ISO string. */
test('supports absent, ISO and AWS Unix timestamps', () => {
    assert.equal(model.dateText(null), '—');
    assert.equal(model.dateText(0), model.dateText('1970-01-01T00:00:00Z'));
});
