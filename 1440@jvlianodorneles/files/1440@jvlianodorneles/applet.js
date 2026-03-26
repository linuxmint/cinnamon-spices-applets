const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Gettext = imports.gettext;
const UUID = "1440@jvlianodorneles";

Gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// MyApplet is an instance of Applet.TextApplet.
function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip(_("Time remaining until the end of the day"));

        this._updateTime();
    },

    // This function is called when the applet is removed from the panel.
    on_applet_removed_from_panel: function() {
        // We remove the update loop to avoid memory leaks.
        if (this.updateLoop) {
            Mainloop.source_remove(this.updateLoop);
        }
    },

    // This function calculates and updates the time remaining in the day.
    _updateTime: function() {
        try {
            // Get the current date.
            const now = new Date();

            // Create a Date object for the end of the day.
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

            // Calculate the difference in milliseconds.
            const diff = endOfDay.getTime() - now.getTime();

            // Convert the difference to minutes and round it down.
            const minutes = Math.floor(diff / (1000 * 60));

            // Set the applet text.
            this.set_applet_label("⌛️ " + minutes + " " + _("min"));

        } catch (e) {
            global.logError(e);
            this.set_applet_label("Error");
        }

        // Schedule the next update for 60 seconds in the future.
        this.updateLoop = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._updateTime));
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}