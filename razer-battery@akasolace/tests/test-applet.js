// Exercise panel rendering and lifecycle with Cinnamon API doubles.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
let callback, timeoutCallback, processCount = 0, exited = 0;
const removed = [];
let localeDir;
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
    mainloop: {timeout_add_seconds(s, cb) { if (s === 15) timeoutCallback = cb; return s; }, source_remove(id) { removed.push(id); }},
    gi: {GLib:{build_filenamev:parts=>parts.join('/'), get_user_data_dir:()=>'/custom/data', SOURCE_REMOVE:false, SOURCE_CONTINUE:true}, Gio:{SubprocessFlags:{STDOUT_PIPE:1, STDERR_PIPE:2},
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
applet._render({devices:[{name:'A',battery:0,charging:false},{name:'B',battery:55,charging:true}]});
assert.equal(applet.label, '0% / 55%');
assert.equal(applet.icon, 'battery-caution-charging-symbolic');
applet._refresh();
timeoutCallback();
callback(process, {});
assert.equal(applet.label, '—');
assert.match(applet.tooltip, /timed out/);
applet._refresh();
applet.on_applet_removed_from_panel();
callback(process, {});
assert.equal(applet.label, '—', 'late callbacks must not update removed applet');
assert.ok(removed.includes(60));
assert.equal(exited, 2);
assert.ok(applet.menu.destroyed);
console.log('Applet rendering, overlap prevention, timeout and cleanup checks passed.');
