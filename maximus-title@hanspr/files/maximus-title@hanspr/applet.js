const Applet = imports.ui.applet;
const SignalManager = imports.misc.signalManager;

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight, instanceId);
            this.metadata = metadata;
            this.uuid = metadata.uuid;
            this.orientation = orientation;
            this.panelHeight = panelHeight;
            this.instanceId = instanceId;
            this.appletPath = metadata.path;
            this.connectSignals();
            setTimeout(() => {
                this.initialized = true
            }, 500);
        } catch (e) {
            global.logError(e);
        }
    }

    connectSignals() {
        this.signalManager = new SignalManager.SignalManager(null);
        this.signalManager.connect(global.display, 'notify::focus-window', this._onTitleChange, this);
    }

    _onTitleChange() {
        this.set_applet_label(global.display.focus_window.get_title().substring(0, 60));
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}