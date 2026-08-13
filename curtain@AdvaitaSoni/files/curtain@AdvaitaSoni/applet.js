const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Lang = imports.lang
const { KeyHandler } = require("./keyhandler")
const { getEnabled, setEnableChangedCallback } = require("./keyMap")

const { SignalManager } = imports.misc.signalManager;
class TileApplet extends Applet.TextIconApplet {
    signalManager
    keyHandler;

    constructor(orientation, panel_height, instance_id) {
        try {
            super(orientation, panel_height, instance_id)
            this.set_show_label_in_vertical_panels(false);
            this.signalManager = new SignalManager()
            this.signalManager.connect(global.workspace_manager, "active-workspace-changed", this.update, this)
            this.signalManager.connect(global.workspace_manager, "workspace-added", this.update, this)
            this.signalManager.connect(global.workspace_manager, "workspace-removed", this.update, this)
            setEnableChangedCallback(Lang.bind(this, this.update));
            this.keyHandler = new KeyHandler()
            this.update()
        } catch (e) {
            global.log("error in creating TileApplet ", e.message)
        }
    }

    update() {
        let iconStr = this.getAppletStatus() ? "object-select-symbolic" : "process-stop-symbolic";
        let index = global.screen.get_active_workspace_index() + 1;
        let totalWorkspaces = global.workspace_manager.n_workspaces;
        let labelStr = `${index} / ${totalWorkspaces}`

        this.set_applet_label(labelStr)
        this.set_applet_icon_symbolic_name(iconStr)
    }

    getAppletStatus() {
        return getEnabled();
    }

    on_applet_removed_from_panel() {
        this.signalManager.disconnectAllSignals();
        this.keyHandler.destroy();
        this.signalManager = null;
        this.keyHandler = null;
    }
}

function custom_shortcuts() {
    Util.spawnCommandLineAsync("cinnamon-settings keyboard -t shortcuts");
}

function main(metadata, orientation, panel_height, instance_id) {
    return new TileApplet(orientation, panel_height, instance_id);
}