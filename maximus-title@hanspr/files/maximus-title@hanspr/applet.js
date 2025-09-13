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
        this.signalManager.connect(global.display, 'notify::focus-window', () => {
            let w = global.display.focus_window
            if (w) {
                this.signalManager.connect(w, 'notify::title', () => {
                    this._onTitleChange(w.lastTitle)
                })
                this._onTitleChange(w.lastTitle)
            } else {
                this._onTitleChange()
            }
        }, this);
    }

    _onTitleChange(title) {
        if (title != undefined) {
            title = title.substring(0, 60)
        } else {
            title = global.display.focus_window.get_title().substring(0, 60)
        }
        this.set_applet_label(title);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}