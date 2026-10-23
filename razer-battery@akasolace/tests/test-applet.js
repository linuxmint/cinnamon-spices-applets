// Exercise panel rendering and lifecycle with Cinnamon API doubles.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
let callback, timeoutCallback, processCount = 0, exited = 0;
const removed = [];
let localeDir, sessionSignal, subscription, unsubscribed;
let nextTimer = 1;
const timers = new Map();
function fireTimer(seconds) {
    const entry = [...timers].find(([, timer]) => timer.seconds === seconds);
    assert.ok(entry, `expected a ${seconds}-second timer`);
    const [id, timer] = entry;
    if (!timer.cb()) timers.delete(id);
}
function screenSaver(active) {
    sessionSignal(null, null, null, null, null, {deep_unpack: () => [active]});
}
class Base {
    setAllowedLayout() {}
    set_applet_icon_symbolic_name(x) { this.icon = x; }
    set_applet_label(x) { this.label = x; }
    set_applet_tooltip(x) { this.tooltip = x; }
}
class Menu {
    constructor() { this.items = []; }
    removeAll() { this.items = []; }
    addMenuItem(x) { this.items.push(x); }
    toggle() {}
    destroy() { this.destroyed = true; }
}
class Item {
    constructor(label) { this.label = label; }
    setSensitive() {}
    connect() {}
}
const process = {
    communicate_utf8_async(a, b, cb) { callback = cb; },
    communicate_utf8_finish() { return [true, JSON.stringify({devices: [{name:'Mouse', battery:100, charging:false}]})]; },
    get_successful() { return true; },
    force_exit() { exited++; }
};
const context = {imports: {
    gettext: {bindtextdomain(uuid, directory) { localeDir = directory; }, dgettext(uuid, text) {return text;}},
    ui: {applet: {TextIconApplet:Base, AllowedLayout:{BOTH:0}, AppletPopupMenu:Menu},
        popupMenu: {PopupMenuManager:class {addMenu() {}}, PopupMenuItem:Item, PopupSeparatorMenuItem:Item}},
    mainloop: {
        timeout_add_seconds(seconds, cb) {
            if (seconds === 15) timeoutCallback = cb;
            const id = nextTimer++;
            timers.set(id, {seconds, cb});
            return id;
        },
        source_remove(id) { removed.push(id); timers.delete(id); }
    },
    gi: {GLib:{build_filenamev:parts=>parts.join('/'), get_user_data_dir:()=>'/custom/data', SOURCE_REMOVE:false, SOURCE_CONTINUE:true}, Gio:{DBusSignalFlags:{NONE:0}, DBus:{session:{
        signal_subscribe(...args) { subscription = args.slice(0, 4); sessionSignal = args[6]; return 42; },
        signal_unsubscribe(id) { unsubscribed = id; }
    }}, SubprocessFlags:{STDOUT_PIPE:1, STDERR_PIPE:2},
        Subprocess:{new() {processCount++; return process;}}}}
}};
vm.createContext(context);
vm.runInContext(`String.prototype.format = function(...args) {
    let i = 0;
    return this.replace(/%[%sd]/g, token => token === '%%' ? '%' : String(args[i++]));
};`, context);
vm.runInContext(fs.readFileSync('files/razer-battery@akasolace/applet.js', 'utf8'), context);
assert.equal(localeDir, '/custom/data/locale', 'translations must use the XDG data directory');
const applet = context.main({path:'/test'}, 0, 30, 1);
applet._refresh();
assert.equal(processCount, 1, 'overlapping queries must be suppressed');
callback(process, {});
assert.equal(applet.label, '100%');
assert.deepEqual(subscription, ['org.cinnamon.ScreenSaver', 'org.cinnamon.ScreenSaver',
    'ActiveChanged', '/org/cinnamon/ScreenSaver']);
fireTimer(3);
assert.equal(processCount, 2, 'login must retry after hardware settles');
callback(process, {});
screenSaver(true);
assert.equal(processCount, 2, 'locking must not trigger a query');
screenSaver(false);
assert.equal(processCount, 3, 'unlock must refresh immediately');
screenSaver(false);
assert.equal(processCount, 3, 'unlock during a query must not overlap it');
assert.equal([...timers.values()].filter(t => t.seconds === 3).length, 1, 'repeated unlock must debounce the retry');
callback(process, {});
assert.equal(processCount, 4, 'unlock during a query must queue a fresh reading');
callback(process, {});
fireTimer(3);
assert.equal(processCount, 5, 'unlock must retry after hardware settles');
callback(process, {});
applet._render({devices:[{name:'A',battery:0,charging:false},{name:'B',battery:55,charging:true}]});
assert.equal(applet.label, '0% / 55%');
assert.equal(applet.icon, 'battery-caution-charging-symbolic');
applet._refresh();
fireTimer(15);
callback(process, {});
assert.equal(applet.label, '—');
assert.match(applet.tooltip, /timed out/);
applet._refresh();
screenSaver(false); // pending read and retry must both be cleaned up
applet.on_applet_removed_from_panel();
callback(process, {});
assert.equal(applet.label, '—', 'late callbacks must not update removed applet');
assert.equal(timers.size, 0, 'all timers must be removed');
assert.equal(unsubscribed, 42, 'screensaver subscription must be removed');
const countAfterRemoval = processCount;
screenSaver(false);
assert.equal(processCount, countAfterRemoval, 'late unlock must not query after removal');
assert.equal(exited, 2);
assert.ok(applet.menu.destroyed);
console.log('Applet rendering, overlap prevention, timeout and cleanup checks passed.');
