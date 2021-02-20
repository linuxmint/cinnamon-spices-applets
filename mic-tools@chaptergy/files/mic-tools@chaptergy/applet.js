const Applet = imports.ui.applet;

const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Main = imports.ui.main;

const Gettext = imports.gettext;
const UUID = "mic-tools@chaptergy";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const DEBUG = false;

const Utils = require("./js/Utils.js");

const qLOG = Utils.LOG;

const Icon = Utils.Icon;
const PopupLabel = Utils.PopupLabel;
const PopupSwitch = Utils.PopupSwitch;
const PopupHeader = Utils.PopupHeader;

const ICONS = {
  INACTIVE: "/assets/%theme%/microphone-inactive.svg",
  ACTIVE: "/assets/%theme%/microphone-active.svg",
  LISTEN: "/assets/%theme%/microphone-listen.svg",
  MUTED: "/assets/%theme%/microphone-muted.svg",
};

class MicTools extends Applet.TextIconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.metadata = metadata;

    this.opt = {
      autoListen: true,
      lightIcons: true,
      keyMute: "",
      keyListen: "",
    };

    this._statusInfo = {
      /** Whether we are currently listening to the mic */
      listen: false,
      /** Whether we are currently muted */
      muted: false,
      /** How many currently active streams there are from the microphone */
      streamsActive: 0,
      /** Whether the loopback has been started (for listening) */
      loopbackRunning: false,
      /** Whether the requirements are fulfilled */
      requirements: {
        all: false,
        amixer: false,
        pactl: false,
      },
    };

    // Bind Settings
    this.settings = new Settings.AppletSettings(
      this.opt,
      metadata.uuid,
      instance_id
    );

    this.checkRequirements();

    this.settings.bind("lightIcons", "lightIcons", this.setIcon.bind(this));
    this.settings.bind("autoListen", "autoListen", () => {
      this.enableAutoListen.setToggleState(this.opt.autoListen);
    });
    this.settings.bind("keyMute", "keyMute", this.onKeyChanged.bind(this));
    this.settings.bind("keyListen", "keyListen", this.onKeyChanged.bind(this));

    this.setIcon();
    this.hide_applet_label(true);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    if (this._statusInfo.requirements.all) {
      this.createPopup();
    } else {
      this.createErrorPopup();
    }

    if (DEBUG || !this._statusInfo.requirements.all) {
      // Reload button
      let reload_btn = new PopupMenu.PopupIconMenuItem(
        _("Reload Applet"),
        "view-refresh-symbolic",
        Icon.SYMBOLIC,
        { hover: true }
      );
      reload_btn.connect("activate", this.reloadApplet.bind(this));
      this._applet_context_menu.addMenuItem(reload_btn);
    }

    if (DEBUG) {
      // Recompile languages button
      let recompile_btn = new PopupMenu.PopupIconMenuItem(
        _("Recompile Translations"),
        "preferences-desktop-locale-symbolic",
        Icon.SYMBOLIC,
        { hover: true }
      );
      recompile_btn.connect("activate", this.recompileTranslations.bind(this));
      this._applet_context_menu.addMenuItem(recompile_btn);
    }

    // Listen for changes to mic
    let [res, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(
      null,
      ["/bin/pactl", "subscribe"],
      null,
      0,
      null
    );
    this.pulseAudioUpdates = new Gio.DataInputStream({
      base_stream: new Gio.UnixInputStream({ fd: out_fd }),
    });

    if (this._statusInfo.requirements.all) {
      this.onKeyChanged();
      this.readPulseAudioSubscription();
    }
  }

  /**
   * Checks whether the required tools are installed
   */
  checkRequirements() {
    try {
      const [a, amixerOut] = GLib.spawn_command_line_sync("amixer --version");
      this._statusInfo.requirements.amixer = this.bin2string(
        amixerOut
      ).startsWith("amixer ");
    } catch (e) {
      this._statusInfo.requirements.amixer = false;
    }
    try {
      const [p, pactlOut] = GLib.spawn_command_line_sync("pactl --version");
      this._statusInfo.requirements.pactl = this.bin2string(
        pactlOut
      ).startsWith("pactl ");
    } catch (e) {
      this._statusInfo.requirements.pactl = false;
    }

    this._statusInfo.requirements.all =
      this._statusInfo.requirements.amixer &&
      this._statusInfo.requirements.pactl;
  }

  setIcon() {
    const theme = this.opt.lightIcons ? "light" : "dark";
    if (this._statusInfo.muted) {
      // We are muted
      this.set_applet_icon_symbolic_path(
        this.metadata.path + ICONS.MUTED.replace("%theme%", theme)
      );
    } else if (this._statusInfo.streamsActive > 0) {
      if (this._statusInfo.listen) {
        // We are listening to the microphone
        this.set_applet_icon_symbolic_path(
          this.metadata.path + ICONS.LISTEN.replace("%theme%", theme)
        );
      } else {
        // Microphone is just active
        this.set_applet_icon_symbolic_path(
          this.metadata.path + ICONS.ACTIVE.replace("%theme%", theme)
        );
      }
    } else {
      // Mic is inactive
      this.set_applet_icon_symbolic_path(
        this.metadata.path + ICONS.INACTIVE.replace("%theme%", theme)
      );
    }
  }

  /**
   * @param {boolean} newStatus
   */
  changeListen(newStatus) {
    if (this._statusInfo.listen !== newStatus) {
      this._statusInfo.listen = newStatus;
      if (newStatus) {
        // Enable listen
        if (!this._statusInfo.loopbackRunning)
          this.doCommand("pactl load-module module-loopback latency_msec=1");
        this._statusInfo.loopbackRunning = true;
        this.enableListen.setToggleState(true);
      } else {
        // Disable listen
        this.doCommand("pactl unload-module module-loopback");
        this._statusInfo.loopbackRunning = false;
        this.enableListen.setToggleState(false);
      }
      this.setIcon();
    }
  }

  /**
   * @param {boolean} newStatus
   */
  changeMuted(newStatus) {
    if (this._statusInfo.muted !== newStatus) {
      this._statusInfo.muted = newStatus;
      if (newStatus) {
        // Enable mute
        this.doCommand("amixer set Capture nocap");
        this.enableMute.setToggleState(true);
      } else {
        // Disable listen
        this.doCommand("amixer set Capture cap");
        this.enableMute.setToggleState(false);
      }
      this.setIcon();
    }
  }

  incrementStreamsActive() {
    this._statusInfo.streamsActive++;

    // There will now be 1 or more streams
    if (this.opt.autoListen) {
      this.changeListen(true);
      // This function will call `setIcon` if necessary
    } else {
      this.setIcon();
    }
  }

  decrementStreamsActive() {
    if (this._statusInfo.streamsActive > 0) {
      this._statusInfo.streamsActive--;

      // Microphone is no longer active if we are the last stream
      if (this._statusInfo.listen && this._statusInfo.streamsActive === 1) {
        this.changeListen(false);
        // Microphone is no longer active if we don't listen and there are no streams
      } else if (
        !this._statusInfo.listen &&
        this._statusInfo.streamsActive === 0
      ) {
        this.setIcon();
      }
    }
  }

  readPulseAudioSubscription() {
    try {
      this.pulseAudioUpdates.read_line_async(
        0,
        null,
        (gobject, async_res, user_data) => {
          const [outBin] = gobject.read_line_finish(async_res);
          const out = this.bin2string(Object.values(outBin));

          if (out.startsWith("Event 'new' on source-output")) {
            this.incrementStreamsActive();
          } else if (out.startsWith("Event 'remove' on source-output")) {
            this.decrementStreamsActive();
          }

          // Read next line if we should still listen
          this.updateLoop = Mainloop.timeout_add(
            1,
            this.readPulseAudioSubscription.bind(this)
          );
        },
        null
      );
    } catch (e) {
      qLOG("Encountered Error: ", e);
    }
  }

  bin2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
      result += String.fromCharCode(array[i]);
    }
    return result;
  }

  onKeyChanged() {
    Main.keybindingManager.addHotKey("keyMute", this.opt.keyMute, (event) => {
      this.changeMuted(!this._statusInfo.muted);
    });

    Main.keybindingManager.addHotKey(
      "keyListen",
      this.opt.keyListen,
      (event) => {
        this.changeListen(!this._statusInfo.listen);
      }
    );
  }

  createErrorPopup() {
    if (!this._statusInfo.requirements.amixer) {
      const infoTextAmixer = new PopupLabel({
        label: _(
          "Command 'amixer' is required but not installed. It is usually contained in the 'alsa-utils' package."
        ),
      });
      this.menu.addMenuItem(infoTextAmixer);
    }

    if (!this._statusInfo.requirements.pactl) {
      const infoTextPctl = new PopupLabel({
        label: _(
          "Command 'pctl' is required but not installed. It is usually contained in the 'pulseaudio' package."
        ),
      });
      this.menu.addMenuItem(infoTextPctl);
    }

    const infoTextReresh = new PopupLabel({
      label: _(
        "Please install the missing packages, right click on this applet and hit 'Refresh'."
      ),
    });
    this.menu.addMenuItem(infoTextReresh);
  }

  createPopup() {
    this.header = new PopupHeader({
      title: "Mic-Tools",
    });

    // config button
    let configBtn = new Icon({
      icon_name: "preferences-system-symbolic",
      icon_size: 16,
      icon_type: Icon.SYMBOLIC,
      reactive: true,
      activate: true,
      hover: true,
    });
    configBtn.connect("activate", (actor, value) => {
      this.configureApplet();
      this.menu.close();
    });
    this.header.setButton(configBtn);

    this.menu.addMenuItem(this.header);

    this.enableListen = new PopupSwitch({
      label: _("Listen to microphone"),
      active: this._statusInfo.listen,
    });
    this.enableListen.connect("toggled", this.listenChange.bind(this));
    this.menu.addMenuItem(this.enableListen);

    this.enableAutoListen = new PopupSwitch({
      label: _("Automatically listen when in use"),
      active: this.opt.autoListen,
    });
    this.enableAutoListen.connect("toggled", this.autoListenChange.bind(this));
    this.menu.addMenuItem(this.enableAutoListen);

    this.enableMute = new PopupSwitch({
      label: _("Mute microphone"),
      active: this._statusInfo.muted,
    });
    this.enableMute.connect("toggled", this.muteChange.bind(this));
    this.menu.addMenuItem(this.enableMute);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  }

  // Settings change functions
  listenChange(switcher, value) {
    this.changeListen(value);
  }

  autoListenChange(switcher, value) {
    this.opt.autoListen = value;
  }

  muteChange(switcher, value) {
    this.changeMuted(value);
  }

  on_applet_added_to_panel() {
    qLOG("Mic-Tools - ADDED TO PANEL");
  }

  on_applet_clicked(event) {
    this.menu.toggle();
  }

  on_applet_removed_from_panel() {
    qLOG("Mic-Tools - REMOVED FROM PANEL");
    this.settings.finalize();
    Main.keybindingManager.removeHotKey("keyToggle");
    Main.keybindingManager.removeHotKey("keyBrightnessUp");
    Main.keybindingManager.removeHotKey("keyBrightnessDown");
    if (this.updateLoop) {
      Mainloop.source_remove(this.updateLoop);
      this.updateLoop = undefined;
    }
  }

  async doCommand(command) {
    GLib.spawn_command_line_async(command);
  }

  // Cinnamon should be restarted after this.
  recompileTranslations() {
    let cmd = `cinnamon-xlet-makepot -r ${this.metadata.path}`;
    Util.spawnCommandLine(cmd);

    cmd = `cinnamon-xlet-makepot -i ${this.metadata.path}`;
    Util.spawnCommandLine(cmd);
  }

  reloadApplet() {
    let cmd = `dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'${this.metadata.uuid}' string:'APPLET'`;
    Util.spawnCommandLine(cmd);
  }

  openSettings() {
    Util.spawnCommandLine(
      "xlet-settings applet " + this._uuid + " " + this.instance_id
    );
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new MicTools(metadata, orientation, panel_height, instance_id);
}
