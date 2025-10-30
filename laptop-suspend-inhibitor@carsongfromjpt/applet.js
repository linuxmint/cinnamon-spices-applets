const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

class MyTrayApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.appletPath = metadata.path + "/";

        this.set_applet_tooltip("Laptop Suspend Inhibitor: Click to disable suspension when the laptop lid is closed, click again to re-enable. Useful for playing music with the laptop closed.");

        // dconf schema and key
        this.dconfKey = "/org/cinnamon/settings-daemon/plugins/power/";
        this.dconfClient = new Gio.Settings({ schema_id: "org.cinnamon.settings-daemon.plugins.power" });

        // Watch dconf for changes
        this.dconfClient.connect("changed", () => this.updateIcon());

        this.updateIcon();
    }

    updateIcon() {
        let value = this.dconfClient.get_string("lid-close-battery-action");
        if (value === "suspend") {
            this.set_applet_icon_symbolic_name("suspend");
        } else {
            this.set_applet_icon_symbolic_name("lock-screen");
        }
    }

    on_applet_clicked(event) {
        // Run your script when clicked
        GLib.spawn_command_line_async(this.appletPath + "switch-mode.sh");
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyTrayApplet(metadata, orientation, panelHeight, instanceId);
}

