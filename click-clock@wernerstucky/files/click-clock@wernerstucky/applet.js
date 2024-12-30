const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;

function MyApplet(metadata, orientation, panelHeight, instance_id) {
  this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function (metadata, orientation, panelHeight, instance_id) {
    Applet.TextIconApplet.prototype._init.call(
      this,
      orientation,
      panelHeight,
      instance_id
    );

    this.set_applet_icon_name("clock");
    this.set_applet_tooltip("Click to view the time");

    // Debug: Log initialization
    // global.log("Click-Clock applet initialized successfully.");
  },

  // Override the default on_applet_clicked method
  on_applet_clicked: function () {
    try {
      // global.log("Applet clicked!"); // Debug log

      let now = new Date();
      let timeString = now.toLocaleTimeString();

      // global.log("Current time: " + timeString); // Log the time
      this.set_applet_label(timeString);
      this.set_applet_tooltip(`Current time: ${timeString}`);

      // Reset to icon after 20 seconds
      if (this._timeoutId) {
        Mainloop.source_remove(this._timeoutId);
      }

      this._timeoutId = Mainloop.timeout_add_seconds(20, () => {
        this._resetToIcon();
        return false; // Stop the timeout
      });
    } catch (e) {
      global.logError("Error in on_applet_clicked: " + e);
    }
  },

  _resetToIcon: function () {
    try {
      // global.log("Resetting to clock icon."); // Debug log
      this.set_applet_label("");
      this.set_applet_icon_name("clock");
      this.set_applet_tooltip("Click to view the time");
    } catch (e) {
      global.logError("Error in _resetToIcon: " + e);
    }
  },

  on_applet_removed_from_panel: function () {
    try {
      if (this._timeoutId) {
        Mainloop.source_remove(this._timeoutId);
      }
    } catch (e) {
      global.logError("Error in on_applet_removed_from_panel: " + e);
    }
  },
};

function main(metadata, orientation, panelHeight, instance_id) {
  return new MyApplet(metadata, orientation, panelHeight, instance_id);
}
