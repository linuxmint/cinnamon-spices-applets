#!/usr/bin/gjs

const Notify = imports.gi.Notify;

let text = '';

if (ARGV.length > 0) {
    text = ARGV[0];
}

Notify.init('DGS notification');

let notify = new Notify.Notification({
    summary: 'DGS Notification',
    body: 'Your turn to play in game: ' + text,
    'icon-name': 'dialog-information'
});

notify.show();