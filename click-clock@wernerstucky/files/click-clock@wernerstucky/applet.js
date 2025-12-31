const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;

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
    this.set_applet_tooltip("Click to view the time and date");
  },

  on_applet_clicked: function () {
    try {
      // global.log("Applet clicked!"); // Debug log

      let now = new Date();
      let localeDate = now.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      let localeTime = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      let displayString = `${localeDate} ${localeTime}`;

      this.set_applet_label(displayString);
      this.set_applet_tooltip(`Current date and time: ${displayString}`);

      if (this._timeoutId) {
        Mainloop.source_remove(this._timeoutId);
      }

      this._timeoutId = Mainloop.timeout_add_seconds(
        20,
        Lang.bind(this, function () {
          this._resetToIcon();
          return false;
        })
      );
    } catch (e) {
      global.logError("Error in on_applet_clicked: " + e);
    }
  },

  _resetToIcon: function () {
    try {
      // global.log("Resetting to icon."); // Debug log
      this.set_applet_label("");
      this.set_applet_icon_name("clock");
      this.set_applet_tooltip("Click to view the time and date");
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
