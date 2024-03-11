// Night Light Applet

const AppletUUID = "nightlight@Severga";

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const MessageTray = imports.ui.messageTray;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext; // Needed for translations

const HOME_DIR = GLib.get_home_dir();
// l10n support
Gettext.bindtextdomain(AppletUUID, HOME_DIR + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// Localisation/translation support
function _(str, uuid=AppletUUID) {
  var customTrans = Gettext.dgettext(uuid, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

function NightLightApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

NightLightApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.settings = new Settings.AppletSettings(this, AppletUUID, instance_id);

    this.sctInstalled = false;
    if (GLib.find_program_in_path("sct")) this.sctInstalled = true;
    if (!this.sctInstalled) {
      this.actor.set_style("color: yellow");
      this.set_applet_icon_symbolic_name("dialog-warning-symbolic.symbolic");
      global.logError(_("Night Light can't work properly: sct package not installed!"));
      this.set_applet_tooltip(_("Night Light") + ": " + _("error"));
      let source = new MessageTray.SystemNotificationSource();
      Main.messageTray.add(source);
      let notification = new MessageTray.Notification(source, _("Night Light"), _("Warning: 'sct' command not found! This applet is a frontend for this command. Please, install 'sct' package and restart Cinnamon or reload the applet."));
      notification.setTransient(false);
      notification.setUrgency(MessageTray.Urgency.NORMAL);
      source.notify(notification);
    } else {
      this.set_applet_icon_symbolic_name("night-light-symbolic");
      this.mode = 0;
      this.autoAndOn = false;
      this.modeName = [_("off"), _("on"), _("auto")];
      this.temperature = 3500;
      this.startH = 21;
      this.startM = 0;
      this.endH = 9;
      this.endM = 0;
      this.timeout = null;

      this._bind_settings();

      this._switch();
    }
  },

  _bind_settings: function() {
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "mode", "mode", null, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "temperature", "temperature", this.on_temperature_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "startH", "startH", this.on_schedule_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "startM", "startM", this.on_schedule_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "endH", "endH", this.on_schedule_changed, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "endM", "endM", this.on_schedule_changed, null);
  },

  _update_tooltip: function() {
    this.set_applet_tooltip(_("Night Light") + ": " + this.modeName[this.mode]);
  },

  _turn_on: function() {
    this.actor.set_style("color: red");
    Util.spawnCommandLine("sct " + this.temperature);
  },

  _turn_off: function() {
    this.actor.set_style("");
    Util.spawnCommandLine("sct");
  },

  _check_time: function() {
    let now = Date.now();
    let start = new Date();
    start.setHours(this.startH);
    start.setMinutes(this.startM);
    start.setSeconds(0);
    let end;
    if ((this.endH * 60 + this.endM) >= (this.startH * 60 + this.startM)) {
      end = new Date();
    } else {
      end = new Date (now + 86400000);
    }
    end.setHours(this.endH);
    end.setMinutes(this.endM);
    end.setSeconds(0);
    if (now >= start && now < end) {
      this.autoAndOn = true;
      this._turn_on();
    } else {
      this.autoAndOn = false;
      this._turn_off();
    }
    return true;
  },

  _switch: function() {
    if (this.mode == 0) {
      this._remove_timeout();
      this.autoAndOn = false;
      this._turn_off();
    } else if (this.mode == 1) {
      this._remove_timeout();
      this.autoAndOn = false;
      this._turn_on();
    } else {
      this._remove_timeout();
      this._check_time();
      this.timeout = Mainloop.timeout_add_seconds(60, () => this._check_time());
    }
    this._update_tooltip();
  },

  on_applet_clicked: function(event) {
    if (this.sctInstalled) {
      if (++this.mode > 2) this.mode = 0;
      this._switch();
    }
  },

  on_applet_removed_from_panel: function(event) {
    if (this.sctInstalled) {
      this._remove_timeout();
      Util.spawnCommandLine("sct");
    }
  },

  on_temperature_changed: function() {
    if (this.mode == 1 || (this.mode == 2 && this.autoAndOn)) Util.spawnCommandLine("sct " + this.temperature);
  },

  on_schedule_changed: function() {
    if (this.mode == 2) this._check_time();
  },

  _remove_timeout: function() {
    if (this.timeout != null) {
      Mainloop.source_remove(this.timeout);
      this.timeout = null;
    }
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new NightLightApplet(metadata, orientation, panel_height, instance_id);
}
