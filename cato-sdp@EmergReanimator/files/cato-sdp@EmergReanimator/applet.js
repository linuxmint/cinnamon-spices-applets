/**
 * Cato SDP
 * Author: EmergReanimator
 *
 * Shows the connection status of the Cato SDP (Software Defined Perimeter)
 * Linux client in the panel, and lets the user connect/disconnect it from a
 * popup menu, by driving the official `cato-sdp` CLI:
 *   - cato-sdp start
 *   - cato-sdp stop
 *   - cato-sdp status
 *
 * Structure and async-subprocess conventions are based on the VPN-Sentinel
 * applet by claudiux.
 */

const Applet = imports.ui.applet;
const { AppletSettings, BindingDirection } = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const Clipboard = St.Clipboard.get_default();

// Max number of past cato-sdp invocations kept in memory for the
// "Copy Debug Info" action.
const HISTORY_LIMIT = 10;
// Truncate captured stdout/stderr so the log/clipboard never gets flooded.
const OUTPUT_LIMIT = 4000;

const UUID = "cato-sdp@EmergReanimator";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  let customTrans = Gettext.dgettext(UUID, str);
  if (customTrans !== str && customTrans !== "") return customTrans;
  return Gettext.gettext(str);
}

const STATE_ICON_FILE = {
  connected: "cato-sdp-connected.svg",
  disconnected: "cato-sdp-disconnected.svg",
  connecting: "cato-sdp-connecting.svg",
  unknown: "cato-sdp-disconnected.svg"
};

const STATE_STYLE = {
  connected: "cato-sdp-connected",
  disconnected: "cato-sdp-disconnected",
  connecting: "cato-sdp-connecting",
  unknown: "cato-sdp-unknown"
};

const STATE_LABEL = {
  connected: _("Connected"),
  disconnected: _("Disconnected"),
  connecting: _("Connecting\u2026"),
  unknown: _("Unknown")
};

// Strips ANSI color/escape sequences that the cato-sdp CLI includes in its
// (TTY-oriented) output, e.g. "\x1b[32m...\x1b[0m".
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(text) {
  return (text || "").replace(ANSI_REGEX, "");
}

class CatoSdpApplet extends Applet.TextIconApplet {
  constructor(metadata, orientation, panelHeight, instanceId) {
    super(orientation, panelHeight, instanceId);

    this.metadata = metadata;
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.set_applet_tooltip(_("Cato SDP"));

    // The status is conveyed via the icon + tooltip + menu only; no text
    // label is shown next to the icon in the panel.
    this.hideLabel();

    this.state = "unknown";
    this.details = {};
    this._busy = false;
    this._pollSourceId = 0;
    this._pendingSubprocess = null;
    this._history = [];

    // Settings
    this.settings = new AppletSettings(this, UUID, instanceId);
    this.settings.bindProperty(BindingDirection.IN, "update-interval", "updateInterval", this._onIntervalChanged.bind(this), null);
    this.settings.bindProperty(BindingDirection.IN, "binary-path", "binaryPath", null, null);
    this.settings.bindProperty(BindingDirection.IN, "show-notifications", "showNotifications", null, null);
    this.settings.bindProperty(BindingDirection.IN, "debug-mode", "debugMode", this._onDebugModeChanged.bind(this), null);

    // Popup menu (left-click)
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this.statusItem = new PopupMenu.PopupMenuItem(_("Status: Unknown"), { reactive: false });
    this.menu.addMenuItem(this.statusItem);

    this.statsItem = new PopupMenu.PopupSubMenuMenuItem(_("Statistics"));
    this.menu.addMenuItem(this.statsItem);

    this.statVersionItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statVersionItem);

    this.statConnectionItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statConnectionItem);

    this.statDurationItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statDurationItem);

    this.statRxItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statRxItem);

    this.statTxItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statTxItem);

    this.statsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.statInterfaceItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statInterfaceItem);

    this.statTunnelIpItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statTunnelIpItem);

    this.statInternalIpItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statInternalIpItem);

    this.statDnsItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    this.statsItem.menu.addMenuItem(this.statDnsItem);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.connectItem = new PopupMenu.PopupIconMenuItem(_("Connect"), "network-vpn-symbolic", St.IconType.SYMBOLIC);
    this.connectItem.connect("activate", () => this._connect());
    this.menu.addMenuItem(this.connectItem);

    this.disconnectItem = new PopupMenu.PopupIconMenuItem(_("Disconnect"), "network-vpn-disabled-symbolic", St.IconType.SYMBOLIC);
    this.disconnectItem.connect("activate", () => this._disconnect());
    this.menu.addMenuItem(this.disconnectItem);

    this.debugSeparator = new PopupMenu.PopupSeparatorMenuItem();
    this.menu.addMenuItem(this.debugSeparator);

    this.debugItem = new PopupMenu.PopupIconMenuItem(_("Copy Debug Info"), "edit-copy-symbolic", St.IconType.SYMBOLIC);
    this.debugItem.connect("activate", () => this._copyDebugInfo());
    this.menu.addMenuItem(this.debugItem);

    this._updateView();
    this._updateDebugMenuVisibility();
    this._log("Applet starting. binary-path=\"" + this.binaryPath + "\" PATH=\"" + GLib.getenv("PATH") + "\"");
    this._checkStatus();
    this._startPolling();
  }

  on_applet_clicked() {
    this.menu.toggle();
  }

  on_applet_removed_from_panel() {
    this._stopPolling();
    if (this._pendingSubprocess) {
      try {
        this._pendingSubprocess.force_exit();
      } catch (e) {
        // Already gone, ignore.
      }
      this._pendingSubprocess = null;
    }
    this.settings.finalize();
  }

  _onIntervalChanged() {
    this._stopPolling();
    this._startPolling();
  }

  _onDebugModeChanged() {
    this._updateDebugMenuVisibility();
    this._log("Debug mode enabled.");
  }

  _updateDebugMenuVisibility() {
    this.debugSeparator.actor.visible = this.debugMode;
    this.debugItem.actor.visible = this.debugMode;
  }

  /**
   * _log:
   * Logs @message to Cinnamon's log (visible with "journalctl --user -f
   * /usr/bin/cinnamon" or Looking Glass), only when debug mode is enabled.
   */
  _log(message) {
    if (this.debugMode) global.log("[" + UUID + "] " + message);
  }

  _truncate(text) {
    text = (text || "").trim();
    if (text.length > OUTPUT_LIMIT) {
      text = text.slice(0, OUTPUT_LIMIT) + "\n... (truncated)";
    }
    return text;
  }

  _recordHistory(argv, result) {
    this._history.push({
      time: new Date().toISOString(),
      argv: argv.join(" "),
      stdout: this._truncate(result.stdout),
      stderr: this._truncate(result.stderr),
      exitCode: result.exitCode
    });
    while (this._history.length > HISTORY_LIMIT) this._history.shift();
  }

  _copyDebugInfo() {
    let lines = [
      "Cato SDP debug info",
      "binary-path: " + this.binaryPath,
      "PATH: " + GLib.getenv("PATH"),
      "current state: " + this.state,
      ""
    ];
    for (let entry of this._history) {
      lines.push("$ " + entry.argv + "  (exit " + entry.exitCode + ", " + entry.time + ")");
      if (entry.stdout) lines.push("stdout: " + entry.stdout);
      if (entry.stderr) lines.push("stderr: " + entry.stderr);
      lines.push("");
    }
    Clipboard.set_text(St.ClipboardType.CLIPBOARD, lines.join("\n"));
    Main.notify(_("Cato SDP"), _("Debug info copied to clipboard."));
  }

  _startPolling() {
    if (this._pollSourceId) return;
    this._pollSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.updateInterval, () => {
      this._checkStatus();
      return GLib.SOURCE_CONTINUE;
    });
  }

  _stopPolling() {
    if (this._pollSourceId) {
      GLib.source_remove(this._pollSourceId);
      this._pollSourceId = 0;
    }
  }

  /**
   * _run:
   * @args (array): arguments passed to the cato-sdp binary (argv form, no shell).
   *
   * Returns a Promise resolving to {stdout, stderr, exitCode}. Every
   * invocation is recorded in @this._history, and logged when debug mode
   * is enabled.
   */
  _run(args) {
    let argv = [this.binaryPath].concat(args);
    return new Promise((resolve) => {
      let subprocess;
      try {
        subprocess = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
      } catch (e) {
        // Most common cause: the binary isn't in PATH, or binary-path is wrong.
        let result = { stdout: "", stderr: "Failed to launch \"" + this.binaryPath + "\": " + e, exitCode: -1 };
        global.logError("[" + UUID + "] " + result.stderr);
        this._recordHistory(argv, result);
        resolve(result);
        return;
      }
      this._pendingSubprocess = subprocess;
      this._log("Running: " + argv.join(" "));
      subprocess.communicate_utf8_async(null, null, (proc, res) => {
        let stdout = "", stderr = "", exitCode = -1;
        try {
          let [, out, err] = proc.communicate_utf8_finish(res);
          stdout = stripAnsi(out || "");
          stderr = stripAnsi(err || "");
          exitCode = proc.get_exit_status();
        } catch (e) {
          stderr = "" + e;
        }
        if (this._pendingSubprocess === subprocess) this._pendingSubprocess = null;
        let result = { stdout, stderr, exitCode };
        this._recordHistory(argv, result);
        this._log("Result of \"" + argv.join(" ") + "\": exitCode=" + exitCode +
          (stdout.trim() ? "\nstdout: " + this._truncate(stdout) : "") +
          (stderr.trim() ? "\nstderr: " + this._truncate(stderr) : ""));
        resolve(result);
      });
    });
  }

  _parseStatus(result) {
    let text = (result.stdout + " " + result.stderr).trim();

    // The Cato client reports an explicit machine-readable state field,
    // e.g. "state = STATE_AUTHENTICATED". Prefer it over generic keyword
    // matching: words like "authenticated" would otherwise be wrongly
    // matched by a loose /authenticat/ pattern meant to catch "connecting".
    let stateMatch = text.match(/state\s*=\s*(STATE_[A-Z_]+)/i);
    if (stateMatch) {
      let state = stateMatch[1].toUpperCase();
      if (state === "STATE_AUTHENTICATED" || state === "STATE_CONNECTED") return "connected";
      if (/CONNECTING|AUTHENTICATING|PENDING/.test(state)) return "connecting";
      if (/DISCONNECTED|IDLE|STOPPED|NOT_CONNECTED/.test(state)) return "disconnected";
    }

    // Fallback for outputs without a "state" field (older/newer client
    // versions, or plain error messages).
    if (/not\s+connected|disconnected|no\s+active\s+connection/i.test(text)) return "disconnected";
    if (/\bconnecting\b|\bpending\b/i.test(text)) return "connecting";
    if (/\bconnected\b/i.test(text)) return "connected";
    if (result.exitCode !== 0) return "disconnected";
    return "unknown";
  }

  _parseDetails(text) {
    text = text || "";
    let details = {};

    let patterns = {
      version: /Cato Client:\s*(\S+)/i,
      popAddress: /pop address\s*=\s*(\S+)/i,
      tunnelIp: /tunnel ip\s*=\s*(\S+)/i,
      internalIp: /internal ip\s*=\s*(\S+)/i,
      dns1: /dns1\s*=\s*(\S+)/i,
      dns2: /dns2\s*=\s*(\S+)/i,
      tunDevice: /tun device\s*=\s*(\S+)/i,
      duration: /duration\s*=\s*(\S+)/i,
      account: /Account:\s*(.+)/i,
      user: /User:\s*(.+)/i
    };
    for (let key in patterns) {
      let m = text.match(patterns[key]);
      if (m) details[key] = m[1].trim();
    }

    let popName = text.match(/pop name\s*=\s*"([^"]*)"/i);
    if (popName) details.popName = popName[1].trim();

    let rx = text.match(/bio_rx_bytes\s*=\s*(\d+)(?:\s*\(([^)]*)\))?/i);
    if (rx) details.rxBytes = rx[1] + (rx[2] ? " (" + rx[2] + ")" : "");

    let tx = text.match(/bio_tx_bytes\s*=\s*(\d+)(?:\s*\(([^)]*)\))?/i);
    if (tx) details.txBytes = tx[1] + (tx[2] ? " (" + tx[2] + ")" : "");

    return details;
  }

  async _checkStatus() {
    let result = await this._run(["status"]);
    let newState = this._parseStatus(result);
    this.details = this._parseDetails(result.stdout + "\n" + result.stderr);
    this._setState(newState);
  }

  async _connect() {
    if (this._busy) return;
    this._busy = true;
    this._setState("connecting");
    this._setMenuSensitive(false);
    let result = await this._run(["start"]);
    if (result.exitCode !== 0) {
      this._notifyCommandFailure("start", result);
    }
    this._busy = false;
    this._setMenuSensitive(true);
    await this._checkStatus();
  }

  async _disconnect() {
    if (this._busy) return;
    this._busy = true;
    this._setMenuSensitive(false);
    let result = await this._run(["stop"]);
    if (result.exitCode !== 0) {
      this._notifyCommandFailure("stop", result);
    }
    this._busy = false;
    this._setMenuSensitive(true);
    await this._checkStatus();
  }

  /**
   * _notifyCommandFailure:
   * Always logs and surfaces a notification on failure (regardless of the
   * "show-notifications" setting, which only governs status-change
   * notifications), since a failed start/stop needs the user's attention.
   */
  _notifyCommandFailure(action, result) {
    let detail = (result.stderr || result.stdout || "").trim();
    let message = detail
      ? detail.split("\n")[0].slice(0, 200)
      : _("Exit code: %d").format(result.exitCode);
    global.logError("[" + UUID + "] cato-sdp " + action + " failed (exit " + result.exitCode + "): " + detail);
    Main.notifyError(_("Cato SDP"), message);
  }

  _setMenuSensitive(sensitive) {
    this.connectItem.setSensitive(sensitive);
    this.disconnectItem.setSensitive(sensitive);
  }

  _setState(newState) {
    let changed = newState !== this.state;
    this.state = newState;
    this._updateView();

    if (changed && this.showNotifications && (newState === "connected" || newState === "disconnected")) {
      Main.notify(_("Cato SDP"), STATE_LABEL[newState]);
    }
  }

  _updateView() {
    this.set_applet_icon_path(this.metadata.path + "/icons/" + (STATE_ICON_FILE[this.state] || STATE_ICON_FILE.unknown));
    this.actor.set_style_class_name(STATE_STYLE[this.state] || STATE_STYLE.unknown);
    this.statusItem.label.set_text(_("Status: ") + (STATE_LABEL[this.state] || STATE_LABEL.unknown));

    let connected = this.state === "connected";
    let connecting = this.state === "connecting";
    this.connectItem.setSensitive(!connected && !connecting && !this._busy);
    this.disconnectItem.setSensitive(connected && !this._busy);

    this._updateTooltip();
    this._updateStatistics();
  }

  _updateTooltip() {
    let label = STATE_LABEL[this.state] || STATE_LABEL.unknown;
    let connectionName = this.details.account || this.details.popName;
    let tooltip = _("Cato SDP") + ": " + label;
    if ((this.state === "connected" || this.state === "connecting") && connectionName) {
      tooltip += " (" + connectionName + ")";
    }
    this.set_applet_tooltip(tooltip);
  }

  _updateStatistics() {
    let d = this.details || {};
    let empty = _("\u2014"); // em dash placeholder for unavailable values.
    let dns = [d.dns1, d.dns2].filter(Boolean).join(", ");

    this.statVersionItem.label.set_text(_("Version: ") + (d.version || empty));
    this.statConnectionItem.label.set_text(_("Connection: ") + (d.account || d.popName || empty));
    this.statDurationItem.label.set_text(_("Duration: ") + (d.duration || empty));
    this.statRxItem.label.set_text(_("Received: ") + (d.rxBytes || empty));
    this.statTxItem.label.set_text(_("Sent: ") + (d.txBytes || empty));
    this.statInterfaceItem.label.set_text(_("Interface: ") + (d.tunDevice || empty));
    this.statTunnelIpItem.label.set_text(_("Tunnel IP: ") + (d.tunnelIp || empty));
    this.statInternalIpItem.label.set_text(_("Internal IP: ") + (d.internalIp || empty));
    this.statDnsItem.label.set_text(_("DNS: ") + (dns || empty));
  }
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new CatoSdpApplet(metadata, orientation, panelHeight, instanceId);
}
