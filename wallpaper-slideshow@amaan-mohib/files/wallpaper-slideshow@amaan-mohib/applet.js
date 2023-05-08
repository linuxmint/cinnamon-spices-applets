const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const UUID = "wallpaper-slideshow@amaan-mohib";
const ICON = "icon";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID;
const Gettext = imports.gettext;
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}
function log(message) {
  global.log(`[${UUID}]: ${message}`);
}
function logError(message) {
  global.logError(`[${UUID}]: ${message}`);
}
const toHHMMSS = (secs) => {
  const sec_num = parseInt(secs, 10);
  const hours = Math.floor(sec_num / 3600);
  const minutes = Math.floor(sec_num / 60) % 60;
  const seconds = sec_num % 60;

  return [hours, minutes, seconds].map((v) => (v < 10 ? "0" + v : v));
};
function formatTime(time) {
  const [hours, minutes, seconds] = toHHMMSS(Number(time));
  const timeArr = [];
  if (hours !== "00") timeArr.push(`${hours}hr`);
  if (minutes !== "00") timeArr.push(`${minutes}min`);
  if (seconds !== "00") timeArr.push(`${seconds}s`);
  return timeArr.join(" ");
}

const SettingsMap = {
  wallpaper_delay: "Delay",
  wallpaper_path: "Wallpapers path",
  wallpaper_timer: "Timer (interval to check for updates)",
  wallpaper_paused: "Pause slideshow",
};

function WallpaperSlideshow(orientation, panel_height, instance_id) {
  this.settings = new Settings.AppletSettings(this, UUID, instance_id);
  this._init(orientation, panel_height, instance_id);
}

WallpaperSlideshow.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(
      this,
      orientation,
      panel_height,
      instance_id
    );

    Object.keys(SettingsMap).forEach((key) => {
      this.settings.bindProperty(
        Settings.BindingDirection.IN,
        key,
        key,
        function () {
          this.property_changed(key);
        },
        null
      );
    });
    this.set_applet_icon_name("icon");
    this.set_applet_tooltip(_("Wallpaper Slideshow"));
    this.initialize_wallpaper_dir();
    this.initMenu(orientation);
    this._start_applet();
  },

  on_applet_clicked: function () {
    this.menu.toggle();
  },

  open_settings: function () {
    Util.spawnCommandLine(CMD_SETTINGS);
  },

  _start_applet: function (override) {
    if (this.wallpaper_paused) {
      this.buildMenu();
      this._removeTimeout();
    } else {
      this.run_wallpaper_script(override);
      this._setTimeout(this.wallpaper_timer || 3600);
    }
  },
  _run_command: function (command = "") {
    try {
      const args = command.split(" ");
      let proc = Gio.Subprocess.new(
        args,
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
      );
      proc.communicate_utf8_async(null, null, (proc, res) => {
        try {
          let [, stdout, stderr] = proc.communicate_utf8_finish(res);

          // Failure
          if (!proc.get_successful()) throw new Error(stderr);

          // Success
          this._lastTimeLabel = "";
          stdout.split("\n").forEach((output) => {
            if (output.startsWith("Last changed")) {
              this._lastTimeLabel = output;
            }
          });
          this.buildMenu();
        } catch (e) {
          logError(e);
        }
      });
    } catch (e) {
      logError(e);
    }
  },
  run_wallpaper_script: function (override) {
    const dir = Gio.file_new_for_path(this.wallpaper_path);
    if (dir.query_exists(null) && this.wallpaper_path && this.wallpaper_delay) {
      const command =
        AppletDir +
        "/scripts/wallpaper_script.py" +
        ` ${this.wallpaper_path} ${
          override === "next" || override === "prev"
            ? override
            : this.wallpaper_delay
        }`;
      this._run_command(command);
    }
  },

  property_changed: function (key) {
    this._removeTimeout();
    if (key === "wallpaper_path") {
      this.initialize_wallpaper_dir();
      if (this.wallpaper_path.startsWith("file://")) {
        this.wallpaper_path = this.wallpaper_path.slice("file://".length);
      }
    }

    if (SettingsMap[key] !== this[key]) {
      this._start_applet();
    }
    SettingsMap[key] = this[key];
  },

  initialize_wallpaper_dir: function () {
    if (!this.wallpaper_path) {
      this.wallpaper_path = GLib.get_home_dir() + "/Pictures/wallpapers";
    }
  },

  _removeTimeout: function () {
    if (this._timeout) {
      Mainloop.source_remove(this._timeout);
      // log(`Timeout removed`);
      this._timeout = null;
    }
  },

  _setTimeout: function (seconds) {
    /** Cancel current timeout in event of an error and try again shortly */
    this._removeTimeout();
    // log(`Setting timeout (${seconds}s)`);
    this._timeout = Mainloop.timeout_add_seconds(
      seconds,
      Lang.bind(this, this._start_applet)
    );
  },

  initMenu: function (orientation) {
    // The menu manager closes the menu after focus has changed.
    // Without adding the menu to the menu manager, the menu would stay open
    // until the user clicked on the applet again.
    this.menuManager = new PopupMenu.PopupMenuManager(this);

    // Create the menu
    this.menu = new Applet.AppletPopupMenu(this, orientation);

    // Add the menu to the menu manager
    this.menuManager.addMenu(this.menu);
    this.buildMenu();
  },

  buildMenu() {
    this.menu.removeAll();
    const dir = Gio.file_new_for_path(this.wallpaper_path);
    if (!dir.query_exists(null)) {
      let notExistsLabelItem = new PopupMenu.PopupMenuItem(
        _("The wallpaper path does not exists!")
      );
      notExistsLabelItem.connect(
        "activate",
        Lang.bind(this, () => {
          this.open_settings();
        })
      );
      this.menu.addMenuItem(notExistsLabelItem);
      return;
    }
    // Create the "delay" label
    let delayLabel = new PopupMenu.PopupMenuItem(
      _("Delay") + `: ${formatTime(Number(this.wallpaper_delay))}`
    );
    delayLabel.connect(
      "activate",
      Lang.bind(this, () => {
        this.open_settings();
      })
    );
    this.menu.addMenuItem(delayLabel);
    if (this._lastTimeLabel) {
      let labelItem = new PopupMenu.PopupMenuItem(_(this._lastTimeLabel), {
        reactive: false,
      });
      this.menu.addMenuItem(labelItem);
    }

    if (this.wallpaper_path) {
      let openDirItem = new PopupMenu.PopupMenuItem(
        _("Open wallpapers directory")
      );
      openDirItem.connect(
        "activate",
        Lang.bind(this, () => {
          Util.spawnCommandLine(`xdg-open ${this.wallpaper_path}`);
        })
      );
      this.menu.addMenuItem(openDirItem);
    }

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let nextMenuItem = new PopupMenu.PopupMenuItem(_("Next"));
    nextMenuItem.connect(
      "activate",
      Lang.bind(this, () => {
        this.wallpaper_paused = false;
        this._start_applet("next");
      })
    );
    this.menu.addMenuItem(nextMenuItem);
    let prevMenuItem = new PopupMenu.PopupMenuItem(_("Previous"));
    prevMenuItem.connect(
      "activate",
      Lang.bind(this, () => {
        this.wallpaper_paused = false;
        this._start_applet("prev");
      })
    );
    this.menu.addMenuItem(prevMenuItem);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let pauseMenuItem = new PopupMenu.PopupSwitchMenuItem(
      _("Paused"),
      this.wallpaper_paused
    );
    pauseMenuItem.connect(
      "toggled",
      Lang.bind(this, (item) => {
        this.wallpaper_paused = item.state;
        this._start_applet();
      })
    );
    this.menu.addMenuItem(pauseMenuItem);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let settingsItem = new PopupMenu.PopupMenuItem(_("Preferences"));
    settingsItem.connect(
      "activate",
      Lang.bind(this, () => {
        this.open_settings();
      })
    );
    this.menu.addMenuItem(settingsItem);
  },

  destroy: function () {
    this._removeTimeout();
  },
  on_applet_removed_from_panel() {
    this._removeTimeout();
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new WallpaperSlideshow(orientation, panel_height, instance_id);
}
