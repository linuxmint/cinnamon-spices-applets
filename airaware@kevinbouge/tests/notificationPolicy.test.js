#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const NotificationPolicy = imports.notificationPolicy;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function testDisabledNeverNotifies() {
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('moderate', 'high', 'disabled'),
        false,
        'disabled notifications should never notify'
    );
}

function testInitialCategoryDoesNotNotify() {
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange(null, 'very-high', 'high-very-high'),
        false,
        'initial category should not notify'
    );
}

function testSameCategoryDoesNotNotify() {
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('high', 'high', 'high-very-high'),
        false,
        'same category should not notify again'
    );
}

function testVeryHighOnlyNotifiesOnlyOnVeryHighTransition() {
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('moderate', 'high', 'very-high'),
        false,
        'very-high-only setting should not notify when high begins'
    );
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('high', 'very-high', 'very-high'),
        true,
        'very-high-only setting should notify when very high begins'
    );
}

function testHighAndVeryHighNotifiesOnBothTransitions() {
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('moderate', 'high', 'high-very-high'),
        true,
        'high plus very high setting should notify when high begins'
    );
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('high', 'very-high', 'high-very-high'),
        true,
        'high plus very high setting should notify when very high begins'
    );
    assertEqual(
        NotificationPolicy.shouldNotifyRiskChange('high', 'moderate', 'high-very-high'),
        false,
        'lower-risk transitions should not notify'
    );
}

function main() {
    const tests = [
        testDisabledNeverNotifies,
        testInitialCategoryDoesNotNotify,
        testSameCategoryDoesNotNotify,
        testVeryHighOnlyNotifiesOnlyOnVeryHighTransition,
        testHighAndVeryHighNotifiesOnBothTransitions,
    ];

    for (const test of tests)
        test();

    print(`notificationPolicy: ${tests.length} tests passed`);
}

main();
