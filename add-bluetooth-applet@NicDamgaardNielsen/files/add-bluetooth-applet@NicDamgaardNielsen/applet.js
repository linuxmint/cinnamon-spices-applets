var Applet = imports.ui.applet;
var GLib = imports.gi.GLib;
var Gio = imports.gi.Gio;
var St = imports.gi.St;
var PopupMenu = imports.ui.popupMenu;
var Util = imports.misc.util;
var Settings = imports.ui.settings;
var Tooltips = imports.ui.tooltips;
var ModalDialog = imports.ui.modalDialog;

function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function (metadata, orientation, panel_height, instance_id) {
    Applet.IconApplet.prototype._init.call(
      this,
      orientation,
      panel_height,
      instance_id,
    );

    this._metadata = metadata;
    let symbolicSvgPath = metadata.path + "/icon-symbolic.svg";
    let svgPath = metadata.path + "/icon.svg";
    let pngPath = metadata.path + "/icon.png";

    if (GLib.file_test(symbolicSvgPath, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_symbolic_path(symbolicSvgPath);
    } else if (GLib.file_test(svgPath, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_path(svgPath);
    } else if (GLib.file_test(pngPath, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_path(pngPath);
    } else {
      this.set_applet_icon_name("bluetooth-active");
    }

    this.set_applet_tooltip("Harald Bluetooth a.k.a. ᚼᛅᚱᛅᛚᛏᚱ");

    this.settings = new Settings.AppletSettings(
      this,
      metadata.uuid,
      instance_id,
    );
    this.settings.bind("bg-color", "bgColor", this._onStyleChanged.bind(this));
    this.settings.bind(
      "bg-opacity",
      "bgOpacity",
      this._onStyleChanged.bind(this),
    );
    this.settings.bind(
      "btn-bg-color",
      "btnBgColor",
      this._onStyleChanged.bind(this),
    );
    this.settings.bind(
      "btn-text-color",
      "btnTextColor",
      this._onStyleChanged.bind(this),
    );
    this.settings.bind(
      "device-text-color",
      "deviceTextColor",
      this._onStyleChanged.bind(this),
    );

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this._applyBackgroundStyle();

    this._mode = "paired";
    this._buildContextMenu();
  },

  _onStyleChanged: function () {
    this._applyBackgroundStyle();
    if (this.menu && this.menu.isOpen) {
      this.refreshMenu();
    }
  },

  _getRgbaString: function () {
    let colorStr = this.bgColor || "rgb(0,0,0)";
    let alpha =
      (typeof this.bgOpacity === "number" ? this.bgOpacity : 100) / 100.0;

    let match = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (match) {
      return (
        "rgba(" +
        match[1] +
        ", " +
        match[2] +
        ", " +
        match[3] +
        ", " +
        alpha.toFixed(2) +
        ")"
      );
    }

    if (colorStr.startsWith("#") && colorStr.length >= 7) {
      let r = parseInt(colorStr.substr(1, 2), 16);
      let g = parseInt(colorStr.substr(3, 2), 16);
      let b = parseInt(colorStr.substr(5, 2), 16);
      return "rgba(" + r + ", " + g + ", " + b + ", " + alpha.toFixed(2) + ")";
    }

    return "rgba(0, 0, 0, " + alpha.toFixed(2) + ")";
  },

  _getButtonStyle: function () {
    let btnBg = this.btnBgColor || "rgb(51,51,51)";
    let btnTxt = this.btnTextColor || "rgb(255,255,255)";
    return (
      "background-color: " +
      btnBg +
      "; color: " +
      btnTxt +
      "; padding: 4px 8px; margin-right: 8px; border-radius: 4px;"
    );
  },

  _getDeviceTextStyle: function () {
    let devTxt = this.deviceTextColor || "rgb(255,255,255)";
    return "color: " + devTxt + "; padding-top: 4px;";
  },

  _applyBackgroundStyle: function () {
    let rgba = this._getRgbaString();
    let devTxt = this.deviceTextColor || "rgb(255,255,255)";
    let pct = typeof this.bgOpacity === "number" ? this.bgOpacity : 100;
    let clutterAlpha = Math.round((pct / 100.0) * 255);

    // Strip Cinnamon theme background classes that paint an opaque layer underneath
    if (this.menu.actor) {
      this.menu.actor.style_class = "";
      this.menu.actor.style =
        "background-color: transparent; border: none; box-shadow: none;";
      if (typeof this.menu.actor.set_opacity === "function") {
        this.menu.actor.set_opacity(clutterAlpha);
      }
    }

    if (this.menu._boxPointer) {
      this.menu._boxPointer.style_class = "";
      this.menu._boxPointer.style =
        "-arrow-background-color: transparent; -arrow-border-color: transparent; background-color: transparent;";
      if (this.menu._boxPointer.bin) {
        this.menu._boxPointer.bin.style_class = "";
        this.menu._boxPointer.bin.style = "background-color: transparent;";
      }
    }

    let menuBox = this.menu.box || this.menu;
    if (menuBox) {
      menuBox.style_class = "";
      menuBox.style =
        "background-color: " +
        rgba +
        "; color: " +
        devTxt +
        "; padding: 8px; border-radius: 6px;";
    }
  },

  _setStyle: function (item, extraStyle) {
    if (!item) return;
    let target = item.actor ? item.actor : item;
    let devTxt = this.deviceTextColor || "rgb(255,255,255)";
    if (target) {
      target.style =
        "background-color: transparent; color: " +
        devTxt +
        ";" +
        (extraStyle || "");
    }
  },

  _addToMenuItem: function (menuItem, widget) {
    if (!menuItem || !widget) return;
    if (typeof menuItem.add_child === "function") {
      menuItem.add_child(widget);
    } else if (typeof menuItem.addActor === "function") {
      menuItem.addActor(widget);
    } else if (menuItem.actor) {
      menuItem.actor.add_child(widget);
    }
  },

  _showAboutUsDialog: function () {
    let dialog = new ModalDialog.ModalDialog();
    let pngPath = this._metadata.path + "/icon.png";

    let contentBox = new St.BoxLayout({
      vertical: true,
      style: "padding: 16px; spacing: 12px; min-width: 280px;",
    });

    let titleLabel = new St.Label({
      text: "Harald Bluetooth (ᚼᛅᚱᛅᛚᛏᚱ)",
      style: "font-weight: bold; font-size: 14pt;",
    });
    contentBox.add_child(titleLabel);

    if (GLib.file_test(pngPath, GLib.FileTest.EXISTS)) {
      let file = Gio.File.new_for_path(pngPath);
      let gicon = new Gio.FileIcon({ file: file });
      let icon = new St.Icon({
        gicon: gicon,
        icon_size: 192,
      });
      contentBox.add_child(icon);
    } else {
      contentBox.add_child(
        new St.Label({
          text: "icon.png not found at: " + pngPath,
        }),
      );
    }

    let websiteBtn = new St.Button({
      label: "Please visit us at our website www.xlets.ca",
      reactive: true,
      can_focus: true,
      style: "text-decoration: underline; color: #4da6ff; padding-top: 4px;",
    });
    websiteBtn.connect("clicked", () => {
      Util.spawnCommandLine("xdg-open https://xlets.ca");
    });
    contentBox.add_child(websiteBtn);

    dialog.contentLayout.add_child(contentBox);
    dialog.setButtons([
      {
        label: "Close",
        action: () => {
          dialog.close();
        },
      },
    ]);
    dialog.open();
  },

  _buildContextMenu: function () {
    if (this._applet_context_menu) {
      let searchItem = new PopupMenu.PopupMenuItem("Search for Devices");
      searchItem.connect("activate", () => {
        this._mode = "search";
        this._startScanAndRefresh();
      });

      let target = searchItem.actor ? searchItem.actor : searchItem;
      if (target) {
        new Tooltips.Tooltip(
          target,
          "Click to find Blue Tooth devices, then wait for the list of available devices to pop up.",
        );
      }

      this._applet_context_menu.addMenuItem(searchItem);

      this._applet_context_menu.addAction("Remove Device", () => {
        this._mode = "remove";
        this.refreshMenu();
        this.menu.open(false);
      });

      this._applet_context_menu.addAction("About us...", () => {
        this._showAboutUsDialog();
      });
    }
  },

  on_applet_clicked: function (event) {
    this._mode = "paired";
    this._applyBackgroundStyle();
    this.refreshMenu();
    this.menu.toggle();
  },

  _bytesToString: function (bytes) {
    if (!bytes) return "";
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
      let str = "";
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  },

  _runCommand: function (cmd) {
    try {
      let [res, out, err, status] = GLib.spawn_sync(
        null,
        ["bash", "-c", "TERM=dumb " + cmd],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null,
      );
      if (out) {
        // Strip any ANSI escape sequences just in case
        return this._bytesToString(out)
          .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
          .trim();
      }
    } catch (e) {
      global.logError("Bluetooth command error: " + e);
    }
    return "";
  },

  _parseDevices: function (output) {
    let devices = [];
    if (!output) return devices;
    let lines = output.split("\n");
    for (let line of lines) {
      // Match "Device XX:XX:XX:XX:XX:XX Name" anywhere on the line
      let match = line.match(
        /Device\s+([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})\s+(.+)/,
      );
      if (match) {
        devices.push({
          mac: match[1].trim(),
          name: match[2].trim(),
        });
      }
    }
    return devices;
  },
  _getPairedDevices: function () {
    let output = this._runCommand("bluetoothctl devices Paired");
    let parsed = this._parseDevices(output);
    if (parsed.length === 0) {
      output = this._runCommand("bluetoothctl paired-devices");
      parsed = this._parseDevices(output);
    }
    return parsed;
  },
  _getConnectedStatus: function (mac) {
    let output = this._runCommand("bluetoothctl info " + mac);
    return output.indexOf("Connected: yes") !== -1;
  },
  _getScannedDevices: function () {
    let output = this._runCommand("bluetoothctl devices");
    let allDevices = this._parseDevices(output);
    let pairedMacs = this._getPairedDevices().map((d) => d.mac);
    return allDevices.filter((d) => {
      if (pairedMacs.indexOf(d.mac) !== -1) return false;
      let macDashes = d.mac.replace(/:/g, "-").toUpperCase();
      let devNameUpper = d.name.trim().toUpperCase();
      return devNameUpper !== macDashes && devNameUpper !== d.mac.toUpperCase();
    });
  },
  _startScanAndRefresh: function () {
    if (this._scanTimeoutId) {
      GLib.source_remove(this._scanTimeoutId);
      this._scanTimeoutId = null;
    }
    // Update tooltip and send a subtle desktop notification so you know it's scanning
    this.set_applet_tooltip("Scanning for Bluetooth devices...");
    try {
      GLib.spawn_async(
        null,
        [
          "notify-send",
          "-i",
          "bluetooth-active",
          "Bluetooth",
          "Scanning for nearby devices...",
        ],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null,
      );
    } catch (e) {}
    // Run the 7-second scan in the background
    try {
      GLib.spawn_async(
        null,
        [
          "bash",
          "-c",
          "(echo 'power on'; echo 'scan on'; sleep 7; echo 'scan off') | bluetoothctl",
        ],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null,
      );
    } catch (e) {
      global.logError("Bluetooth scan spawn error: " + e);
    }
    // Wait until the scan finishes, then populate and pop up the menu
    this._scanTimeoutId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      7,
      () => {
        this._scanTimeoutId = null;
        this.set_applet_tooltip("Harald Bluetooth a.k.a. ᚼᛅᚱᛅᛚᛏᚱ");
        this._mode = "search";
        this._applyBackgroundStyle();
        this.refreshMenu();
        this.menu.open(true);
        return GLib.SOURCE_REMOVE;
      },
    );
  },
  _addSearchButton: function () {
    let btnBg = this.btnBgColor || "rgb(51,51,51)";
    let btnTxt = this.btnTextColor || "rgb(255,255,255)";
    let searchItem = new PopupMenu.PopupMenuItem("Search for Devices");
    let target = searchItem.actor ? searchItem.actor : searchItem;
    if (target) {
      target.style =
        "background-color: " +
        btnBg +
        "; color: " +
        btnTxt +
        "; border-radius: 4px; margin-top: 4px;";
      new Tooltips.Tooltip(
        target,
        "Click to find Blue Tooth devices, then wait for the list of available devices to pop up.",
      );
    }
    searchItem.connect("activate", () => {
      this._mode = "search";
      this._startScanAndRefresh();
    });
    this.menu.addMenuItem(searchItem);
  },
  _formatDeviceName: function (name) {
    if (!name) return "Unknown Device";
    let clean = name
      // Strip standard UUIDs (with or without surrounding brackets/parentheses)
      .replace(
        /[\[]?\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b[]]?/gi,
        "",
      )
      // Strip MAC addresses (colon or hyphen separated, with or without brackets)
      .replace(/[\[]?\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b[]]?/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return clean.length > 0 ? clean : "Unknown Device";
  },
  refreshMenu: function () {
    this.menu.removeAll();
    let btnStyle = this._getButtonStyle();
    let devTextStyle = this._getDeviceTextStyle();
    try {
      if (this._mode === "paired") {
        let devices = this._getPairedDevices();
        if (devices.length === 0) {
          let item = new PopupMenu.PopupMenuItem(
            "No previously connected devices",
          );
          this._setStyle(item);
          this.menu.addMenuItem(item);
          this._addSearchButton();
          return;
        }
        for (let dev of devices) {
          let isConnected = this._getConnectedStatus(dev.mac);
          let box = new St.BoxLayout({
            style: "background-color: transparent; padding: 4px;",
          });
          let btn = new St.Button({
            label: isConnected ? "Disconnect" : "Connect",
            reactive: true,
            can_focus: true,
            style: btnStyle,
          });
          let label = new St.Label({
            text: this._formatDeviceName(dev.name),
            style: devTextStyle,
          });
          btn.connect("clicked", () => {
            if (isConnected) {
              this._runCommand("bluetoothctl disconnect " + dev.mac);
            } else {
              this._runCommand("bluetoothctl connect " + dev.mac);
            }
            this.refreshMenu();
          });
          box.add_child(btn);
          box.add_child(label);
          let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: true });
          this._addToMenuItem(menuItem, box);
          this._setStyle(menuItem);
          this.menu.addMenuItem(menuItem);
        }
      } else if (this._mode === "search") {
        let devices = this._getScannedDevices();
        if (devices.length === 0) {
          let item = new PopupMenu.PopupMenuItem("No new devices found");
          this._setStyle(item);
          this.menu.addMenuItem(item);
          this._addSearchButton();
          return;
        }
        for (let dev of devices) {
          let box = new St.BoxLayout({
            style: "background-color: transparent; padding: 4px;",
          });
          let btn = new St.Button({
            label: "Connect",
            reactive: true,
            can_focus: true,
            style: btnStyle,
          });
          let label = new St.Label({
            text: this._formatDeviceName(dev.name),
            style: devTextStyle,
          });
          let connectAction = () => {
            this.menu.removeAll();
            let statusItem = new PopupMenu.PopupMenuItem(
              "Pairing & connecting to " +
                this._formatDeviceName(dev.name) +
                "...",
            );
            this._setStyle(statusItem);
            this.menu.addMenuItem(statusItem);
            GLib.spawn_async(
              null,
              [
                "bash",
                "-c",
                "bluetoothctl trust " +
                  dev.mac +
                  " && bluetoothctl pair " +
                  dev.mac +
                  " && bluetoothctl connect " +
                  dev.mac,
              ],
              null,
              GLib.SpawnFlags.SEARCH_PATH,
              null,
            );
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 4, () => {
              this._mode = "paired";
              this.refreshMenu();
              return GLib.SOURCE_REMOVE;
            });
          };
          btn.connect("clicked", connectAction);
          box.add_child(btn);
          box.add_child(label);
          let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: true });
          menuItem.connect("activate", connectAction);
          this._addToMenuItem(menuItem, box);
          this._setStyle(menuItem);
          this.menu.addMenuItem(menuItem);
        }
        this._addSearchButton();
      } else if (this._mode === "remove") {
        let devices = this._getPairedDevices();
        if (devices.length === 0) {
          let item = new PopupMenu.PopupMenuItem("No devices to remove");
          this._setStyle(item);
          this.menu.addMenuItem(item);
          return;
        }

        for (let dev of devices) {
          let box = new St.BoxLayout({
            style: "background-color: transparent; padding: 4px;",
          });
          let btn = new St.Button({
            label: "Remove Device",
            reactive: true,
            can_focus: true,
            style: btnStyle,
          });
          let label = new St.Label({
           text: this._formatDeviceName(dev.name),
            style: devTextStyle,
          });
          btn.connect("clicked", () => {
            this._runCommand("bluetoothctl remove " + dev.mac);
            this.refreshMenu();
          });

          box.add_child(btn);
          box.add_child(label);
          let menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: true });
          this._addToMenuItem(menuItem, box);
          this._setStyle(menuItem);
          this.menu.addMenuItem(menuItem);
        }
      }


    } catch (err) {
      let errItem = new PopupMenu.PopupMenuItem("Error: " + err.message);
      this.menu.addMenuItem(errItem);
    }
  },
};
function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(metadata, orientation, panel_height, instance_id);
}

