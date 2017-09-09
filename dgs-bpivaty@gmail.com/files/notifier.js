#!/usr/bin/gjs

// const System = imports.system;
const Notify = imports.gi.Notify;
const GSound = imports.gi.GSound;

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

let hello = new GSound.Context();
hello.init(null);
hello.play_simple({ "event.id" : "phone-incoming-call", 
                    "event.description" : "hello world" }, null);
GLib.usleep (2000000);