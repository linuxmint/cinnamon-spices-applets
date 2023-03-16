// Timer Applet

const AppletUUID = "timer@Severga";

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const MessageTray = imports.ui.messageTray;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib; // Needed for translations
const Gettext = imports.gettext; // Needed for translations
const SoundManager = imports.ui.soundManager;

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

function TimerApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

TimerApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    this.set_show_label_in_vertical_panels(false);
    this.set_applet_icon_symbolic_name("alarm");
    this.set_applet_label("");
    this.set_applet_tooltip(_("Timer: inactive"));

    this.period = 0;
    this.periodH = 0;
    this.periodM = 0;
    this.periodS = 0;
    this.endTime = new Date();

    this.timeout = null;
    this.timeTimeout = null;
    this.flashTimeout = null;
    this.flashCount = 0;
    this.sliderDragging = false;

    //this.soundOn = true;
    //this.soundPath = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga";
    //this.showNotifications = true;
    //this.openSubmenu = "Quick setup";
    this.preset = [
      /*60,
      120,
      180,
      300,
      600,
      900,
      1200,
      1800,
      2700,
      3600,
      7200*/
    ];

    this.soundManager = new SoundManager.SoundManager();

    this.settings = new Settings.AppletSettings(this, AppletUUID, instance_id);
    this._bind_settings();

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.periodMenuItem = new PopupMenu.PopupMenuItem(_("In:  00:00:00"), {reactive: false});
    this.periodMenuItem.actor.set_style("font-family: monospace; background: #6B8355; font-weight: bold");
    this.menu.addMenuItem(this.periodMenuItem);
    this.timeMenuItem = new PopupMenu.PopupMenuItem(_("At:  --:--:--"), {reactive: false});
    this.timeMenuItem.actor.set_style("font-family: monospace; background: #6B8355; font-weight: bold");
    this.menu.addMenuItem(this.timeMenuItem);
    this.turnOffSwitchMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Turn off computer on timer"));
    this.turnOffSwitchMenuItem.actor.set_style("background: #6B8355");
    this.menu.addMenuItem(this.turnOffSwitchMenuItem);
    this.menu.addMenuItem(new PopupMenu.PopupMenuItem("", {reactive: false}));
    this.quickMenuItem = new PopupMenu.PopupSubMenuMenuItem(_("Quick setup"));
    let tip1 = new PopupMenu.PopupMenuItem(_("        Tip: set slider to zero to deactivate timer"), {reactive: false});
    tip1.actor.set_style("font-size: 8pt; font-style: italic");
    this.quickMenuItem.menu.addMenuItem(tip1);
    this.menu.addMenuItem(this.quickMenuItem);
    let axisMenuItem = new St.BoxLayout({
      width: 400,
      height: 30
    });
    let b = new St.Label({
      text: _("     00:00:00"),
      x_expand: true,
      y_expand: true,
      x_align: 1,
      y_align: 3
    });
    let e = new St.Label({
      text: _("24:00:00     "),
      x_expand: true,
      y_expand: true,
      x_align: 3,
      y_align: 3
    });
    axisMenuItem.add(b);
    axisMenuItem.add(e);
    this.quickMenuItem.menu.addActor(axisMenuItem);
    this.sliderMenuItem = new PopupMenu.PopupSliderMenuItem(0);
    this.sliderMenuItem.connect("drag-begin", Lang.bind(this, this.on_slider_drag_begin));
    this.sliderMenuItem.connect("drag-end", Lang.bind(this, this.on_slider_drag_end));
    this.sliderMenuItem.connect("value-changed", Lang.bind(this, this.on_slider_changed));
    this.quickMenuItem.menu.addMenuItem(this.sliderMenuItem);
    this.preciseMenuItem = new PopupMenu.PopupSubMenuMenuItem(_("Precise setup"));
    this.menu.addMenuItem(this.preciseMenuItem);
    let spinsMenuItem = new St.BoxLayout({
      x_align: 2
    });
    // Hours
    let h = new St.BoxLayout({
      vertical: true
    });
    let hplus = new St.Button({
      label: _("  +  ")
    });
    hplus.connect("clicked", Lang.bind(this, this.on_hplus_clicked));
    this.hSpin = new St.Label({
      text: _("00"),
      x_align: 2,
    });
    this.hSpin.value = 0;
    let hminus = new St.Button({
      label: _("  -  ")
    });
    hminus.connect("clicked", Lang.bind(this, this.on_hminus_clicked));
    h.add_actor(hplus);
    h.add_actor(this.hSpin);
    h.add_actor(hminus);
    // Separator
    let c1 = new St.Label({
      text: _("  :  "),
      y_align: 2
    });
    // Minutes
    let m = new St.BoxLayout({
      vertical: true
    });
    let mplus = new St.Button({
      label: _("  +  ")
    });
    mplus.connect("clicked", Lang.bind(this, this.on_mplus_clicked));
    this.mSpin = new St.Label({
      text: _("00"),
      x_align: 2
    });
    this.mSpin.value = 0;
    let mminus = new St.Button({
      label: _("  -  ")
    });
    mminus.connect("clicked", Lang.bind(this, this.on_mminus_clicked));
    m.add_actor(mplus);
    m.add_actor(this.mSpin);
    m.add_actor(mminus);
    // Separator
    let c2 = new St.Label({
      text: _("  :  "),
      y_align: 2
    });
    // Seconds
    let s = new St.BoxLayout({
      vertical: true
    });
    let splus = new St.Button({
      label: _("  +  ")
    });
    splus.connect("clicked", Lang.bind(this, this.on_splus_clicked));
    this.sSpin = new St.Label({
      text: _("00"),
      x_align: 2
    });
    this.sSpin.value = 0;
    let sminus = new St.Button({
      label: _("  -  ")
    });
    sminus.connect("clicked", Lang.bind(this, this.on_sminus_clicked));
    s.add_actor(splus);
    s.add_actor(this.sSpin);
    s.add_actor(sminus);
    spinsMenuItem.add(h);
    spinsMenuItem.add(c1);
    spinsMenuItem.add(m);
    spinsMenuItem.add(c2);
    spinsMenuItem.add(s);
    this.preciseMenuItem.menu.addActor(spinsMenuItem);
    this.preciseMenuItem.menu.addAction(_("Set time (today)"), function () {
      this._remove_timeout();
      this._remove_flashTimeout();
      this.actor.set_style("");
      this.set_applet_label("");
      this.set_applet_tooltip(_("Timer: inactive"));
      this.sliderMenuItem.setValue(0);

      this.endTime = new Date(); this.endTime.setHours(this.hSpin.value); this.endTime.setMinutes(this.mSpin.value); this.endTime.setSeconds(this.sSpin.value);
      this.period = Math.floor((this.endTime.getTime() - Date.now()) / 1000);
      if (this.period > 0) {
        this.periodH = Math.floor(this.period / 3600);
        this.periodM = Math.floor(this.period % 3600 / 60);
        this.periodS = this.period % 60;
        this._tick();
      }
      else {
        this.period = 0;
        this.periodH = 0;
        this.periodM = 0;
        this.periodS = 0;
        this.periodMenuItem.setLabel(_("In:  00:00:00"));
        this.timeMenuItem.setLabel(_("At:  --:--:--"));
      }
    }.bind(this));
    this.preciseMenuItem.menu.addAction(_("Set time (tomorrow)"), function () {
      this._remove_timeout();
      this._remove_flashTimeout();
      this.actor.set_style("");
      this.set_applet_label("");
      this.set_applet_tooltip(_("Timer: inactive"));
      this.sliderMenuItem.setValue(0);

      this.endTime = new Date(); this.endTime.setHours(this.hSpin.value + 24); this.endTime.setMinutes(this.mSpin.value); this.endTime.setSeconds(this.sSpin.value);
      this.period = Math.floor((this.endTime.getTime() - Date.now()) / 1000);
      if (this.period > 0) {
        this.periodH = Math.floor(this.period / 3600);
        this.periodM = Math.floor(this.period % 3600 / 60);
        this.periodS = this.period % 60;
        this._tick();
      }
      else {
        this.period = 0;
        this.periodH = 0;
        this.periodM = 0;
        this.periodS = 0;
        this.periodMenuItem.setLabel(_("In:  00:00:00"));
        this.timeMenuItem.setLabel(_("At:  --:--:--"));
      }
    }.bind(this));
    this.preciseMenuItem.menu.addAction(_("Set period"), function () {
      this._remove_timeout();
      this._remove_flashTimeout();
      this.actor.set_style("");
      this.set_applet_label("");
      this.set_applet_tooltip(_("Timer: inactive"));
      this.sliderMenuItem.setValue(0);

      this.periodH = this.hSpin.value;
      this.periodM = this.mSpin.value;
      this.periodS = this.sSpin.value;
      this.period = this.periodH * 3600 + this.periodM * 60 + this.periodS;
      this.endTime = new Date(Date.now() + this.period * 1000);
      if (this.period) this._tick();
      else this.timeMenuItem.setLabel(_("At:  --:--:--"));
    }.bind(this));
    this.preciseMenuItem.menu.addAction(_("Add preset"), function () {
      let p = this.applet.hSpin.value * 3600 + this.applet.mSpin.value * 60 + this.applet.sSpin.value;
      if (p) {
        this.applet.preset.push(p);
        this.applet.preset.sort(function (a, b) {return a - b});
        this.applet.settings.setValue("preset", this.applet.preset);
        this.applet._createPresetsMenuItem();
      }
    }.bind({applet: this}));
    this.presetsMenuItem = new PopupMenu.PopupSubMenuMenuItem(_("Presets"));
    this.menu.addMenuItem(this.presetsMenuItem);
    this._createPresetsMenuItem();
  },

  _bind_settings: function() {
    this.settings.bindProperty(Settings.BindingDirection.IN,      "soundOn",        "soundOn",        null, null);
    this.settings.bindProperty(Settings.BindingDirection.IN,      "soundPath",      "soundPath",      null, null);
    this.settings.bindProperty(Settings.BindingDirection.IN,      "showNotifications",  "showNotifications",  null, null);
    this.settings.bindProperty(Settings.BindingDirection.IN,      "openSubmenu",      "openSubmenu",      null, null);
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "preset",       "preset",       null, null);
  },

  _createPresetsMenuItem: function () {
    this.presetMenuItem = [];
    this.presetsMenuItem.menu.removeAll();
    let tip2 = new PopupMenu.PopupMenuItem(_("        Tip: use 'Precise setup' to add preset and  [ × ]  button to remove preset"), {reactive: false});
    tip2.actor.set_style("font-size: 8pt; font-style: italic");
    this.presetsMenuItem.menu.addMenuItem(tip2);
    for (let i = 0; i < this.preset.length; i++) {
      // Preset item
      let h = Math.floor(this.preset[i] / 3600);
      let m = Math.floor(this.preset[i] % 3600 / 60);
      let s = this.preset[i] % 60;
      this.presetMenuItem[i] = new PopupMenu.PopupMenuItem((h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s, {});
      this.presetMenuItem[i].connect("activate", function () {
        this.applet._remove_timeout();
        this.applet._remove_flashTimeout();
        this.applet.actor.set_style("");
        this.applet.set_applet_label("");
        this.applet.set_applet_tooltip(_("Timer: inactive"));
        this.applet.sliderMenuItem.setValue(0);

        this.applet.period = this.preset;
        this.applet.periodH = Math.floor(this.preset / 3600);
        this.applet.periodM = Math.floor(this.preset % 3600 / 60);
        this.applet.periodS = this.preset % 60;
        this.applet.endTime = new Date(Date.now() + this.preset * 1000);
        if (this.preset) this.applet._tick();
        else this.applet.timeMenuItem.setLabel(_("At:  --:--:--"));
      }.bind({applet: this, preset: this.preset[i]}));
      // Preset item delete button
      let del=new St.Button({label: _("[ × ]")});
      del.connect("clicked", function () {
        this.applet.preset.splice(this.i, 1);
        this.applet.settings.setValue("preset", this.applet.preset);
        this.applet._createPresetsMenuItem();
      }.bind({applet: this, i: i}));
      this.presetMenuItem[i].addActor(del);
      this.presetsMenuItem.menu.addMenuItem(this.presetMenuItem[i]);
    }
  },

  on_hplus_clicked: function() {
    if (this.hSpin.value < 23) this.hSpin.value++;
    else this.hSpin.value = 0;
    this.hSpin.text = (this.hSpin.value < 10 ? "0" : "") + this.hSpin.value;
  },

  on_hminus_clicked: function() {
    if (this.hSpin.value > 0) this.hSpin.value--;
    else this.hSpin.value = 23;
    this.hSpin.text = (this.hSpin.value < 10 ? "0" : "") + this.hSpin.value;
  },

  on_mplus_clicked: function() {
    if (this.mSpin.value < 59) this.mSpin.value++;
    else this.mSpin.value = 0;
    this.mSpin.text = (this.mSpin.value < 10 ? "0" : "") + this.mSpin.value;
  },

  on_mminus_clicked: function() {
    if (this.mSpin.value > 0) this.mSpin.value--;
    else this.mSpin.value = 59;
    this.mSpin.text = (this.mSpin.value < 10 ? "0" : "") + this.mSpin.value;
  },

  on_splus_clicked: function() {
    if (this.sSpin.value < 59) this.sSpin.value++;
    else this.sSpin.value = 0;
    this.sSpin.text = (this.sSpin.value < 10 ? "0" : "") + this.sSpin.value;
  },

  on_sminus_clicked: function() {
    if (this.sSpin.value > 0) this.sSpin.value--;
    else this.sSpin.value = 59;
    this.sSpin.text = (this.sSpin.value < 10 ? "0" : "") + this.sSpin.value;
  },

  on_applet_clicked: function(event) {
    this._remove_flashTimeout();
    this.actor.set_style("");
    if (this.openSubmenu == "Quick setup") this.quickMenuItem.menu.open();
    else if (this.openSubmenu == "Precise setup") this.preciseMenuItem.menu.open();
    else this.presetsMenuItem.menu.open();
    this.menu.toggle();
  },

  on_applet_removed_from_panel: function(event) {
    this._remove_timeout();
    this._remove_flashTimeout();
  },

  on_slider_drag_begin: function () {
    this.sliderDragging = true;
    this._updateTime();
  },

  on_slider_drag_end: function () {
    this._remove_timeTimeout();
    this.sliderDragging = false;
    this.on_slider_changed();
  },

  _updateTime: function () {
    this._remove_timeTimeout();
    this.on_slider_changed();
    this.timeTimeout = Mainloop.timeout_add_seconds(1, () => this._updateTime());
  },

  _remove_timeout: function() {
    if (this.timeout != null) {
      Mainloop.source_remove(this.timeout);
      this.timeout = null;
    }
  },

  _remove_timeTimeout: function() {
    if (this.timeTimeout != null) {
      Mainloop.source_remove(this.timeTimeout);
      this.timeTimeout = null;
    }
  },

  _remove_flashTimeout: function() {
    if (this.flashTimeout != null) {
      Mainloop.source_remove(this.flashTimeout);
      this.flashTimeout = null;
    }
  },

  on_slider_changed: function () {
    this._remove_timeout();
    this._remove_flashTimeout();
    this.actor.set_style("");
    this.set_applet_label("");
    this.set_applet_tooltip(_("Timer: inactive"));

    let v = Math.round(this.sliderMenuItem.value * 100);
    if (v) {
      if (v <= 19) {
        this.period = v + 1;
      }
      else if (v <= 27) {
        this.period = 25 + (v - 20) * 5;
      }
      else if (v <= 46) {
        this.period = 120 + (v - 28) * 60;
      }
      else if (v <= 54) {
        this.period = 1500 + (v - 47) * 300;
      }
      else {
        this.period = 5400 + (v - 55) * 1800;
      }
      this.periodH = Math.floor(this.period / 3600);
      this.periodM = Math.floor(this.period % 3600 / 60);
      this.periodS = this.period % 60;
      this.endTime = new Date(Date.now() + this.period * 1000);
    }
    else {
      this.period = 0;
      this.periodH = 0;
      this.periodM = 0;
      this.periodS = 0;
    }

    this.periodMenuItem.setLabel(_("In:  ") + (this.periodH < 10 ? "0" : "") + this.periodH + ":" + (this.periodM < 10 ? "0" : "") + this.periodM + ":" + (this.periodS < 10 ? "0" : "") + this.periodS);
    if (this.period) {
      let h = this.endTime.getHours();
      let m = this.endTime.getMinutes();
      let s = this.endTime.getSeconds();
      let today = new Date(); today.setHours(0); today.setMinutes(0); today.setSeconds(0);
      this.timeMenuItem.setLabel(_("At:  ") + (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + (this.endTime.getTime() > today.getTime() + 86400000 ? " (tomorrow)" : ""));
      if (!this.sliderDragging) this._tick();
    }
    else {
      this.timeMenuItem.setLabel(_("At:  --:--:--"));
    }
  },

  _tick: function () {
    this._remove_timeout();
    this.period = Math.floor((this.endTime.getTime() - Date.now()) / 1000);
    if (this.period >= 0) {
      this.periodH = Math.floor(this.period / 3600);
      this.periodM = Math.floor(this.period % 3600 / 60);
      this.periodS = this.period % 60;
      let label = (this.periodH < 10 ? "0" : "") + this.periodH + ":" + (this.periodM < 10 ? "0" : "") + this.periodM + ":" + (this.periodS < 10 ? "0" : "") + this.periodS;
      this.periodMenuItem.setLabel(_("In:  ") + label);
      let h = this.endTime.getHours();
      let m = this.endTime.getMinutes();
      let s = this.endTime.getSeconds();
      let today = new Date();
      today.setHours(0);
      today.setMinutes(0);
      today.setSeconds(0);
      this.timeMenuItem.setLabel(_("At:  ") + (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + (this.endTime.getTime() > today.getTime() + 86400000 ? " (tomorrow)" : ""));
      this._moveSlider();
      if (this.turnOffSwitchMenuItem.state && this.period < 10) this.set_applet_label(_("Turn off in ") + this.periodS + _("s"));
      else this.set_applet_label(label);
      this.set_applet_tooltip(_("Timer: ") + label);
      this.timeout = Mainloop.timeout_add_seconds(1, () => this._tick());
    }
    else {
      this.set_applet_label("");
      this.set_applet_tooltip(_("Timer: inactive"));
      this.periodMenuItem.setLabel(_("In:  00:00:00"));
      this.sliderMenuItem.setValue(0);
      this.timeMenuItem.setLabel(_("At:  --:--:--"));
      if (this.turnOffSwitchMenuItem.state) {
        Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.RequestShutdown");
      }
      else {
        this.flashCount = 0;
        this._flash();
        if (this.soundOn && this.soundPath) {
          //Util.spawnCommandLine("play " + this.soundPath);
          try {
            global.play_sound_file(0, this.soundPath, "", null);
          } catch(e) {
            this.soundManager.playSoundFile(0, this.soundPath);
          }
        }
        if (this.showNotifications) {
          //Util.spawnCommandLine('zenity --notification --text=\"Timer:  Time\'s up!\" --window-icon=clock');

          let source = new MessageTray.SystemNotificationSource();
          Main.messageTray.add(source);
          let notification = new MessageTray.Notification(source, _("Timer"), _("Time's up!"));
          notification.setTransient(false);
          notification.setUrgency(MessageTray.Urgency.NORMAL);
          source.notify(notification);
        }
      }
    }
  },

  _moveSlider: function () {
    if (this.period > 3600) {
      this.sliderMenuItem.setValue(0.54 + (1 - 0.54) * (this.period - 3600) / (86400 - 3600));
    }
    else if (this.period > 1200) {
      this.sliderMenuItem.setValue(0.46 + (0.54 - 0.46) * (this.period - 1200) / (3600 - 1200));
    }
    else if (this.period > 60) {
      this.sliderMenuItem.setValue(0.27 + (0.46 - 0.27) * (this.period - 60) / (1200 - 60));
    }
    else if (this.period > 20) {
      this.sliderMenuItem.setValue(0.19 + (0.27 - 0.19) * (this.period - 20) / (60 - 20));
    }
    else {
      this.sliderMenuItem.setValue(0.19 * this.period / 20);
    }
  },

  _flash: function () {
    this._remove_flashTimeout();
    if (this.actor.get_style() == "") {
      this.actor.set_style("color: red");
    }
    else this.actor.set_style("");
    this.flashCount++;
    if (this.flashCount < 10) this.flashTimeout = Mainloop.timeout_add_seconds(1, () => this._flash());
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new TimerApplet(metadata, orientation, panel_height, instance_id);
}
