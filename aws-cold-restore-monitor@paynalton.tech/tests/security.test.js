/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * Security regression checks with synthetic data and no AWS access.
 * Run with node --test tests/security.test.js; the Gio integration check requires cjs.
 * These checks cover specific boundaries, not an exhaustive vulnerability audit.
 * @file
 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {harness, moduleContext} = require('./helpers/applet');
const project = path.resolve(__dirname, '..');

/** Fails without printing the sensitive fixture or captured output in diagnostics. */
function assertPrivate(values, markers) {
    const serialized = JSON.stringify(values);
    assert.ok(markers.every(marker => !serialized.includes(marker)),
        'Private fixture data escaped into public error output');
}

/**
 * Captures the actual applet argv, then passes it through real Gio to a local recorder.
 * Shell payloads must remain literal arguments and must not create the sentinel file.
 */
test('security: applet argv survives real Gio execution without shell expansion', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-security-'));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const marker = path.join(directory, 'injection-executed');
    const executable = path.join(directory, 'fake aws');
    fs.writeFileSync(executable, '#!' + process.execPath + '\nprocess.stdout.write(JSON.stringify(process.argv.slice(2)));\n', {mode: 0o700});
    const config = {
        awsPath: executable,
        profile: `$(touch '${marker}')`,
        region: `us-east-1; touch '${marker}'`,
        restoreJobId: "`touch '" + marker + "'`\n--endpoint-url=https://example.invalid; * $HOME & | >"
    };
    const h = harness({config});
    t.after(() => h.applet.on_applet_removed_from_panel());
    assert.equal(h.launches.length, 1);
    const argv = h.launches[0];
    assert.equal(argv[0], executable);
    assert.deepEqual(argv.slice(1, 3), ['backup', 'describe-restore-job']);
    for (const [flag, value] of [['--profile', config.profile], ['--region', config.region], ['--restore-job-id', config.restoreJobId]]) {
        assert.equal(argv[argv.indexOf(flag) + 1], value);
    }
    assert.equal(argv.includes('--endpoint-url'), false);
    assert.deepEqual(h.environment, {AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off', LC_ALL: 'C'});
    const script = `
        const Gio = imports.gi.Gio;
        const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE});
        const process = launcher.spawnv(${JSON.stringify(argv)});
        const [ok, output, error] = process.communicate_utf8(null, null);
        if (!ok || !process.get_successful()) throw Error('Local recorder failed');
        print(output);
    `;
    const result = spawnSync('cjs', ['-c', script], {encoding: 'utf8', timeout: 10000});
    assert.ifError(result.error);
    assert.equal(result.status, 0, 'Real Gio recorder must exit successfully');
    assert.deepEqual(JSON.parse(result.stdout), argv.slice(1));
    assert.equal(fs.existsSync(marker), false, 'Shell payload must not execute');
});

/** Exercises error categories with private-looking, explicitly synthetic marker data. */
test('security: classified failures never include raw error details', () => {
    const errors = moduleContext('errors');
    const markers = ['SYNTHETIC_ACCOUNT_MARKER', 'SYNTHETIC_TOKEN_MARKER', 'SYNTHETIC_PROFILE_MARKER'];
    const cases = [
        ['timeout', '', null], ['internal', '', null], ['response', '', null],
        ['cli', 'ExpiredTokenException', 254], ['cli', 'AccessDeniedException', 254],
        ['cli', 'ResourceNotFoundException', 254], ['cli', 'SSL validation failed', 255],
        ['spawn', 'No such file', null], ['cli', 'InvalidParameter', 252],
        ['cli', 'ThrottlingException', 254], ['cli', 'Could not connect to endpoint', 255],
        ['transport', 'interrupted', null], ['cli', 'unrecognized failure', 255]
    ];
    for (const [stage, prefix, code] of cases) {
        for (const input of [prefix + ' ' + markers.join(' '), new Error(prefix + ' ' + markers.join(' '))]) {
            const issue = errors.classify(stage, input, code);
            assert.ok(issue.message.length > 0);
            assertPrivate(issue, markers);
        }
    }
});

/** Verifies notification and logging boundaries through real applet callback paths. */
test('security: notifications and logs omit private configuration and CLI output', () => {
    const markers = ['SYNTHETIC_JOB_MARKER', 'SYNTHETIC_PROFILE_MARKER', 'SYNTHETIC_STDERR_MARKER'];
    const config = {restoreJobId: markers[0], profile: markers[1]};
    for (const outcome of [
        [254, '', 'AccessDeniedException ' + markers[2]],
        [255, '', 'Could not connect to endpoint ' + markers[2]],
        [0, JSON.stringify({Status: 'RUNNING', PercentDone: '12', StatusMessage: markers[2]}), markers[2]],
        [0, markers[2], ''],
        [0, JSON.stringify({Status: 'FAILED', StatusMessage: markers[2]}), '']
    ]) {
        const h = harness({config});
        try {
            h.processes[0].complete(...outcome);
            assert.ok(h.notifications.length > 0);
            assertPrivate([h.notifications, h.logs], markers);
        } finally { h.applet.on_applet_removed_from_panel(); }
    }
    const h = harness({config, renderFail: true, notifyFail: true, privateError: markers[2]});
    try {
        assert.ok(h.logs.length > 0, 'Fallback logging must be exercised');
        assertPrivate([h.notifications, h.logs], markers);
    } finally { h.applet.on_applet_removed_from_panel(); }
});

/** Keeps AWS text as plain text, with a bounded status message in the local menu. */
test('security: AWS markup is displayed as text and long status messages are bounded', () => {
    const h = harness();
    try {
        const message = '<b>untrusted</b><a href="https://example.invalid">link</a>' + 'x'.repeat(5000);
        h.processes[0].complete(0, JSON.stringify({Status: 'RUNNING', PercentDone: '12', StatusMessage: message}));
        assert.ok(h.applet._details.message.text.includes(message.slice(0, 1800)));
        assert.equal(h.applet._details.message.text.includes(message.slice(0, 1801)), false);
    } finally { h.applet.on_applet_removed_from_panel(); }
});

/** Returns project text files without following symlinks or reading user credentials. */
function textFiles(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...textFiles(target));
        else if (entry.isFile() && (/\.(js|json|sh|py|po|pot|md|css)$/.test(entry.name) || entry.name === 'LICENSE')) files.push(target);
    }
    return files;
}

/** Checks common credential signatures; only file paths and rule names appear in failures. */
test('security: project text files contain no common embedded credential signatures', () => {
    const rules = [
        ['AWS access key ID', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
        ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
        ['assigned AWS secret', /(?:aws_secret_access_key|aws_session_token)\s*[=:]\s*["']?[A-Za-z0-9/+=]{32,}/i],
        ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/]
    ];
    // Positive controls ensure the detection rules are active without storing actual secrets.
    const samples = ['AK' + 'IA' + 'A'.repeat(16), '-----BEGIN ' + 'PRIVATE KEY-----',
        'aws_secret_' + 'access_key=' + 'A'.repeat(40), 'gh' + 'p_' + 'A'.repeat(36)];
    rules.forEach(([, pattern], index) => assert.ok(pattern.test(samples[index])));
    const findings = [];
    for (const file of textFiles(project)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const [name, pattern] of rules) {
            if (pattern.test(content)) findings.push(path.relative(project, file) + ': ' + name);
        }
    }
    assert.deepEqual(findings, [], 'Possible embedded credentials; values are intentionally omitted');
});
