/*
 * Copyright (C) 2026 paynalton
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/** Tests the Gettext domain and fallback contract without a desktop session. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('binds the applet domain and delegates messages without changing placeholders', () => {
    const calls = [];
    const context = vm.createContext({imports: {
        gettext: {
            bindtextdomain: (domain, directory) => calls.push([domain, directory]),
            dgettext: (domain, text) => {
                assert.equal(domain, 'aws-cold-restore-monitor@paynalton.tech');
                return {'Profile: %s · Region: %s': 'Perfil: %s · Región: %s'}[text] || text;
            }
        },
        gi: {GLib: {get_home_dir: () => '/tmp/test-user', build_filenamev: parts => parts.join('/')}}
    }});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../files/aws-cold-restore-monitor@paynalton.tech/i18n.js'), 'utf8'), context);
    assert.deepEqual(calls, [['aws-cold-restore-monitor@paynalton.tech', '/tmp/test-user/.local/share/locale']]);
    assert.equal(context._('Profile: %s · Region: %s'), 'Perfil: %s · Región: %s');
    assert.equal(context._('Missing translation'), 'Missing translation');
});
