const Main = imports.ui.main;
const OsdWindow = imports.ui.osdWindow;

const Osd150 = require('./osd150');

class MyExtension {
    constructor(meta) {
        this._meta = meta;
    }

    enable() {
        Main.osdWindowManager = new Osd150.OsdWindowManager();
    }

    disable() {
        Main.osdWindowManager = new OsdWindow.OsdWindowManager();
    }
}

let extension = null;

function enable() {
    try {
        extension.enable();
    } catch (err) {
        extension.disable();
        throw err;
    }
}

function disable() {
    try {
        extension.disable();
    } catch (err) {
        global.logError(err);
    } finally {
        extension = null;
    }
}

function init(metadata) {
    extension = new MyExtension(metadata);
}
