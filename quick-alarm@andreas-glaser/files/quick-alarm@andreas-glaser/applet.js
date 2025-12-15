const Applet = imports.ui.applet;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const AppletManager = imports.ui.appletManager;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

let APPLET_PATH = null;
let AlarmService = null;
let Time = null;

function _playChime(onPid) {
  const candidates = [
    // Preferred: play a known system sound file directly (more reliable than sound-theme lookup).
    {
      cmd: "paplay",
      argv: () => {
        const paths = [
          "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga",
          "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.ogg",
        ];
        const soundPath = paths.find((p) => GLib.file_test(p, GLib.FileTest.EXISTS));
        return soundPath ? ["paplay", soundPath] : null;
      },
    },
    // Fallback: sound-theme lookup.
    {
      cmd: "canberra-gtk-play",
      argv: () => ["canberra-gtk-play", "-i", "alarm-clock-elapsed"],
    },
  ];

  for (const candidate of candidates) {
    try {
      if (!GLib.find_program_in_path(candidate.cmd)) continue;
      const argv = candidate.argv();
      if (!argv) continue;
      const pid = Util.spawn(argv);
      if (onPid && pid) onPid(pid);
      return;
    } catch (e) {
      // try next candidate
    }
  }
}

function QuickAlarmApplet(metadata, orientation, panelHeight, instanceId) {
  this._init(metadata, orientation, panelHeight, instanceId);
}

QuickAlarmApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _updatePanelIconSize() {
    try {
      if (!this._applet_icon) return;
      const base = this.getPanelIconSize(St.IconType.SYMBOLIC);
      this._applet_icon.set_icon_size(Math.round(base * 1.3));
    } catch (e) {
      // ignore
    }
  },

  _applyPanelIconStyle() {
    try {
      if (this.actor) this.actor.add_style_class_name("qa-applet");
    } catch (e) {
      // ignore
    }
  },

  _setPanelState(state) {
    this._panelState = state;
    if (!this.actor) return;
    this.actor.remove_style_class_name("qa-state-idle");
    this.actor.remove_style_class_name("qa-state-queued");
    this.actor.remove_style_class_name("qa-state-ringing");
    this.actor.add_style_class_name(`qa-state-${state}`);

    try {
      if (!this._applet_icon) return;
      this._applet_icon.remove_style_class_name("warning");
      this._applet_icon.remove_style_class_name("error");
      if (state === "queued") this._applet_icon.add_style_class_name("warning");
      if (state === "ringing") this._applet_icon.add_style_class_name("error");
    } catch (e) {
      // ignore
    }
  },

  _stopBlinking() {
    if (this._blinkTimerId) {
      GLib.source_remove(this._blinkTimerId);
      this._blinkTimerId = 0;
    }
    try {
      if (this._applet_icon) this._applet_icon.add_style_class_name("error");
    } catch (e) {
      // ignore
    }
  },

  _startBlinking() {
    this._stopBlinking();
    this._blinkTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
      if (!this._applet_icon) return GLib.SOURCE_REMOVE;
      if (this._applet_icon.has_style_class_name("error"))
        this._applet_icon.remove_style_class_name("error");
      else this._applet_icon.add_style_class_name("error");
      return GLib.SOURCE_CONTINUE;
    });
  },

  _startRingingWindow(durationMs) {
    this._isRinging = true;
    this._setPanelState("ringing");
    this._startBlinking();

    if (this._ringEndTimerId) {
      GLib.source_remove(this._ringEndTimerId);
      this._ringEndTimerId = 0;
    }
    this._ringEndTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, durationMs, () => {
      // Ensure we actually stop any currently playing audio processes.
      this._ringEndTimerId = 0;
      this._stopAllSounds();
      return GLib.SOURCE_REMOVE;
    });
  },

  _refreshPanelState() {
    if (this._isRinging) {
      this._setPanelState("ringing");
      return;
    }
    const alarms = this._service ? this._service.list() : [];
    this._setPanelState(alarms.length > 0 ? "queued" : "idle");
  },

  _getEntryText() {
    if (this._entry.get_text) return this._entry.get_text();
    if (this._entry.clutter_text && this._entry.clutter_text.get_text)
      return this._entry.clutter_text.get_text();
    return "";
  },

  _setEntryText(text) {
    if (this._entry.set_text) return this._entry.set_text(text);
    if (this._entry.clutter_text && this._entry.clutter_text.set_text)
      return this._entry.clutter_text.set_text(text);
  },

  _init(metadata, orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

    this._soundMode = "chime";
    this._ringSeconds = 10;
    this._activeSoundTimers = new Set();
    this._activeAudioPids = new Set();
    this._blinkTimerId = 0;
    this._ringEndTimerId = 0;
    this._isRinging = false;
    this._panelState = "idle";

    this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
    this.settings.bind("soundMode", "_soundMode");
    this.settings.bind("ringSeconds", "_ringSeconds");

    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    this.set_applet_icon_symbolic_name("alarm-symbolic");
    this._updatePanelIconSize();
    this.set_applet_label("");
    this.set_applet_tooltip(this._("Quick Alarm"));
    this._applyPanelIconStyle();
    this._setPanelState("idle");

    this._notificationSource = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(this._notificationSource);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.menu.actor.add_style_class_name("qa-menu");

    this._interfaceSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });
    this._interfaceSettings.connect("changed::gtk-theme", () => this._applyThemeClass());
    this._applyThemeClass();

    const gearIcon = new St.Icon({
      icon_name: "emblem-system-symbolic",
      icon_type: St.IconType.SYMBOLIC,
      icon_size: 16,
    });
    this._settingsButton = new St.Button({
      child: gearIcon,
      can_focus: true,
      style_class: "qa-gear",
    });
    this._settingsButton.connect("clicked", () => {
      try {
        this.menu.close();
      } catch (e) {
        // ignore
      }
      this.configureApplet();
    });

    const headerRow = new St.BoxLayout({ vertical: false, x_expand: true, style_class: "qa-header-row" });
    const headerIcon = new St.Icon({
      icon_name: "alarm-symbolic",
      icon_type: St.IconType.SYMBOLIC,
      icon_size: 16,
      style_class: "qa-header-icon",
    });
    const headerLabel = new St.Label({
      text: this._("Quick Alarm"),
      x_expand: true,
      style_class: "qa-header",
    });
    headerRow.add_child(headerIcon);
    headerRow.add_child(headerLabel);
    headerRow.add_child(this._settingsButton);

    this._headerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    this._headerItem.addActor(headerRow, { expand: true, span: -1, align: St.Align.START });
    this.menu.addMenuItem(this._headerItem);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._entry = new St.Entry({
      style_class: "qa-entry",
      hint_text: "Type: in 10m tea  •  11am standup  •  5 seconds",
      track_hover: true,
      can_focus: true,
    });

    this._addButton = new St.Button({
      child: new St.Icon({
        icon_name: "list-add-symbolic",
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 16,
      }),
      can_focus: true,
      style_class: "qa-add",
    });
    this._addButton.connect("clicked", () => this._submit());

    const entryRow = new St.BoxLayout({ vertical: false, x_expand: true, style_class: "qa-entry-row" });
    entryRow.add_child(this._entry);
    entryRow.add_child(this._addButton);

    this._entryItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    this._entryItem.addActor(entryRow, { expand: true, span: -1, align: St.Align.START });
    this.menu.addMenuItem(this._entryItem);

    this._errorLabel = new St.Label({ style_class: "qa-error", text: "" });
    this._errorLabel.clutter_text.line_wrap = true;
    this._errorLabel.clutter_text.line_wrap_mode = 2; // Pango.WrapMode.WORD_CHAR
    this._errorLabel.clutter_text.ellipsize = 0; // Pango.EllipsizeMode.NONE
    this._errorItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
    this._errorItem.addActor(this._errorLabel, { expand: true, span: -1, align: St.Align.START });
    this.menu.addMenuItem(this._errorItem);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this._listSection = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this._listSection);

    this._service = new AlarmService(
      () => this._render(),
      (alarm) => this._fire(alarm),
    );

    this._entryText = this._entry.clutter_text;
    this._entryText.connect("activate", () => this._submit());
    this._entryText.connect("key-press-event", (_actor, event) => {
      const symbol = event.get_key_symbol();
      if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
        this._submit();
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    });
    this.menu.connect("open-state-changed", (_menu, isOpen) => {
      if (!isOpen) return;
      this._errorLabel.text = "";
      this._entry.grab_key_focus();
    });

    this._render();
  },

  _applyThemeClass() {
    const theme = this._interfaceSettings.get_string("gtk-theme") || "";
    const isDark = /dark/i.test(theme);
    if (!this.menu || !this.menu.actor) return;
    this.menu.actor.remove_style_class_name("qa-theme-light");
    this.menu.actor.remove_style_class_name("qa-theme-dark");
    this.menu.actor.add_style_class_name(isDark ? "qa-theme-dark" : "qa-theme-light");
  },

  on_applet_clicked() {
    this.menu.toggle();
  },

  on_panel_height_changed() {
    this._updatePanelIconSize();
  },

  on_applet_removed_from_panel() {
    this._stopAllSounds();
    this._service.destroy();
    try {
      this._notificationSource.destroy();
    } catch (e) {
      // ignore
    }
    if (this._ringEndTimerId) GLib.source_remove(this._ringEndTimerId);
    this._ringEndTimerId = 0;
    this._stopBlinking();
    this.settings.finalize();
  },

  _submit() {
    try {
      const input = this._getEntryText();
      const parsed = Time.parseAlarmSpec(input, new Date(), (s) => this._(s));
      if (!parsed.ok) {
        this._errorLabel.text = parsed.error;
        return;
      }

      const label = parsed.label || `Alarm ${Time.formatTime(parsed.due, parsed.showSeconds)}`;
      this._service.add(parsed.due, label, parsed.showSeconds);
      this._setEntryText("");
      this._errorLabel.text = "";
      this._render();
    } catch (e) {
      global.logError(e);
      this._errorLabel.text = this._("Something went wrong. Check Looking Glass logs.");
    }
  },

  _fire(alarm) {
    this._playAlarmSound();
    const title = this._("Alarm");
    const body = alarm.label || `Alarm ${Time.formatTime(alarm.due, alarm.showSeconds)}`;

    const notification = new MessageTray.Notification(this._notificationSource, title, body);
    notification.setTransient(false);
    notification.connect("clicked", () => {
      this._stopAllSounds();
      try {
        notification.destroy();
      } catch (e) {
        // ignore
      }
    });
    this._notificationSource.notify(notification);
  },

  _stopAllSounds() {
    for (const id of this._activeSoundTimers) GLib.source_remove(id);
    this._activeSoundTimers.clear();

    for (const pid of this._activeAudioPids) {
      try {
        Util.spawn(["kill", "-TERM", String(pid)]);
      } catch (e) {
        // ignore
      }
    }
    this._activeAudioPids.clear();

    this._isRinging = false;
    if (this._ringEndTimerId) GLib.source_remove(this._ringEndTimerId);
    this._ringEndTimerId = 0;
    this._stopBlinking();
    this._refreshPanelState();
  },

  _playAlarmSound() {
    if (this._soundMode !== "ring") {
      _playChime((pid) => this._activeAudioPids.add(pid));
      this._startRingingWindow(2000);
      return;
    }

    const seconds = Math.max(1, Number(this._ringSeconds) || 1);
    const intervalMs = 1000;
    const endAt = Date.now() + seconds * 1000;

    _playChime((pid) => this._activeAudioPids.add(pid));
    this._startRingingWindow(seconds * 1000);

    const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
      if (Date.now() >= endAt) {
        this._activeSoundTimers.delete(timerId);
        return GLib.SOURCE_REMOVE;
      }
      _playChime((pid) => this._activeAudioPids.add(pid));
      return GLib.SOURCE_CONTINUE;
    });

    this._activeSoundTimers.add(timerId);
  },

  _render() {
    this._listSection.removeAll();
    const alarms = this._service.list();

    if (alarms.length === 0) {
      const emptyItem = new PopupMenu.PopupMenuItem(this._("No alarms queued"), { reactive: false });
      this._listSection.addMenuItem(emptyItem);
      this.set_applet_label("");
      this.set_applet_tooltip(this._("Quick Alarm"));
      this._refreshPanelState();
      return;
    }

    const next = alarms[0];
    this.set_applet_label("");
    this.set_applet_tooltip(`${Time.formatTime(next.due, next.showSeconds)} ${next.label || ""}`.trim());
    this._refreshPanelState();

    for (const alarm of alarms) {
      const row = new PopupMenu.PopupBaseMenuItem({ reactive: false });
      const box = new St.BoxLayout({ vertical: false, x_expand: true, style_class: "qa-alarm-box" });

      const timeLabel = new St.Label({
        text: Time.formatTime(alarm.due, alarm.showSeconds),
        style_class: "qa-alarm-time",
      });
      const textLabel = new St.Label({
        text: alarm.label || "",
        x_expand: true,
        style_class: "qa-alarm-label",
      });

      const removeButton = new St.Button({
        child: new St.Icon({
          icon_name: "window-close-symbolic",
          icon_type: St.IconType.SYMBOLIC,
          icon_size: 14,
        }),
        can_focus: true,
        style_class: "qa-remove",
      });
      removeButton.connect("clicked", () => this._service.remove(alarm.id));

      box.add_child(timeLabel);
      box.add_child(textLabel);
      box.add_child(removeButton);
      row.addActor(box, { expand: true, span: -1, align: St.Align.START });
      this._listSection.addMenuItem(row);
    }
  },
};

function main(metadata, orientation, panelHeight, instanceId) {
  APPLET_PATH = AppletManager.appletMeta[metadata.uuid].path;
  // Cinnamon Spices installs translations to ~/.local/share/locale/<lang>/LC_MESSAGES/<uuid>.mo
  Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");
  imports.searchPath.unshift(APPLET_PATH);
  AlarmService = imports.services.alarmService.AlarmService;
  Time = imports.lib.time;
  return new QuickAlarmApplet(metadata, orientation, panelHeight, instanceId);
}
