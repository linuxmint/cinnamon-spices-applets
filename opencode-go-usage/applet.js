const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

const APPLET_DIR = GLib.get_user_data_dir() + "/cinnamon/applets/opencode-go-usage@clrblind";
const CURL_TIMEOUT = 10;
const DEFAULT_INTERVAL = 30;
const MIN_INTERVAL = 5;
const MAX_INTERVAL = 3600;

class OpenCodeApplet extends Applet.IconApplet {
  constructor(metadata, orientation, panelHeight, instanceId) {
    super(orientation, panelHeight, instanceId);

    this.set_applet_icon_path(APPLET_DIR + "/icon.png");
    this.set_applet_tooltip("OpenCode GO Usage");

    this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
    this.settings.bind("update_interval", "interval", this.on_settings_changed);
    this.settings.bind("auth_cookie", "cookie", this.on_settings_changed);
    this.settings.bind("workspace_id", "workspace_id", this.on_settings_changed);
    this.settings.bind("font_size", "font_size", this._applyFontStyle);
    this.settings.bind("monospace", "monospace", this._applyFontStyle);
    this.settings.bind("font_family", "font_family", this._applyFontStyle);
    this.settings.bind("font_color", "font_color", this._applyFontStyle);
    this.settings.bind("show_notifications", "show_notifications", null);

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);

    this._container = new St.BoxLayout({
      vertical: true,
      style: "padding: 8px 12px;"
    });
    this.menu.box.add(this._container);

    this._timer = null;

    this._prevPcts = {};
    this._notified = {};

    this._applet_context_menu.addAction("Refresh", () => this._update());
    this._applet_context_menu.addAction("Test Notification", () => {
      Util.spawn(["notify-send", "-a", "Opencode", "-i", APPLET_DIR + "/icon.png", "Test", "Notification works"]);
    });

    this._applyFontStyle();

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      this._update();
      this._startTimer();
      return GLib.SOURCE_REMOVE;
    });
  }

  _notifyLimitReset(name) {
    if (!this.show_notifications) return;
    if (this._notified[name]) return;
    this._notified[name] = true;
    Util.spawn(["notify-send", "-a", "Opencode", "-i", APPLET_DIR + "/icon.png", "Limit Reset", name + " usage reset to 0%"]);
  }

  _applyFontStyle() {
    this._container.style = `padding: 8px 12px;`;
    this._container.get_children().forEach(c => this._applyFontAttrs(c));
  }

  _applyFontAttrs(label) {
    const family = this.monospace ? "monospace" : (this.font_family || "sans-serif");
    const color = this.font_color ? `color: ${this.font_color};` : "";
    label.style = `font-family: ${family}; font-size: ${this.font_size}pt; ${color}`;
  }

  _setPopupText(lines) {
    this._container.get_children().forEach(c => c.destroy());
    lines.forEach(line => {
      const label = new St.Label({ text: line });
      this._applyFontAttrs(label);
      this._container.add(label);
    });
  }

  _checkResets(lines) {
    lines.forEach(line => {
      const m = line.match(/^([^|]+)\|\s*(\d+)\s*%/);
      if (!m) return;
      const name = m[1].trim();
      const pct = parseInt(m[2], 10);
      if (pct < 0 || pct > 100) return;
      const prev = this._prevPcts[name];
      this._prevPcts[name] = pct;
      if (pct === 0 && prev !== undefined && prev > 0) {
        this._notifyLimitReset(name);
      }
      if (pct > 0) {
        delete this._notified[name];
      }
    });
  }

  _validateSettings() {
    const ws = (this.workspace_id || "").trim();
    if (!ws) return "Configure workspace_id in settings";
    if (!/^wrk_/.test(ws)) return "workspace_id must start with wrk_";
    const ck = (this.cookie || "").trim();
    if (!ck) return "Configure auth cookie in settings";
    if (ck.length < 20) return "Auth cookie too short — check value";
    return null;
  }

  _update() {
    const err = this._validateSettings();
    if (err) {
      this._setPopupText([err]);
      this.set_applet_tooltip("");
      return;
    }

    const argv = [
      "curl", "-s", "--max-time", String(CURL_TIMEOUT),
      "--cookie", `auth=${this.cookie}`,
      `https://opencode.ai/workspace/${this.workspace_id}/go`
    ];

    let subprocess = new Gio.Subprocess({
      argv: argv,
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    });

    try {
      subprocess.init(null);
    } catch (e) {
      this._setPopupText(["Curl not found"]);
      this.set_applet_tooltip(e.message);
      return;
    }

    subprocess.communicate_utf8_async(null, null, (obj, res) => {
      let success, stdout, stderr;
      try {
        [success, stdout, stderr] = obj.communicate_utf8_finish(res);
      } catch (e) {
        this._setPopupText(["Fetch error"]);
        this.set_applet_tooltip(e.message || "");
        return;
      }

      let exitCode = success ? subprocess.get_exit_status() : -1;

      if (exitCode === 0 && stdout && stdout.length > 0) {
        const lines = this._parseOutput(stdout);
        this._setPopupText(lines);
        this._checkResets(lines);
        this.set_applet_tooltip("OpenCode GO Usage");
      } else if (exitCode === 0) {
        this._setPopupText(["No data"]);
        this.set_applet_tooltip("");
      } else {
        this._setPopupText(["Error: " + exitCode]);
        this.set_applet_tooltip(stderr || "");
      }
    });
  }

  _parseOutput(html) {
    const lines = [];
    html = html.replace(/\n/g, "");
    const items = html.split(/<div[^>]+data-slot="usage-item"/);
    for (const item of items) {
      const m = item.match(/usage-label">([^<]+).*?usage-value"><!--\$-->([0-9]+).*?Resets in<!--\/--> <!--\$-->([^<]+)/);
      if (m) {
        const label = m[1].trim();
        const pct = m[2];
        const reset = m[3].trim();
        lines.push(label.padEnd(15) + " | " + pct.padStart(3) + "% | Resets in: " + reset);
      }
    }
    return lines.length > 0 ? lines : [];
  }

  on_applet_clicked(event) {
    this._update();
    this.menu.toggle();
  }

  _startTimer() {
    this._timer = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      this._intervalValid() ? this.interval : DEFAULT_INTERVAL,
      () => {
        this._update();
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  _intervalValid() {
    return this.interval >= MIN_INTERVAL && this.interval <= MAX_INTERVAL;
  }

  on_applet_removed_from_panel() {
    if (this._timer) {
      GLib.source_remove(this._timer);
      this._timer = null;
    }
  }

  on_settings_changed() {
    if (this._timer) {
      GLib.source_remove(this._timer);
    }
    this._startTimer();
    this._update();
  }
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new OpenCodeApplet(metadata, orientation, panelHeight, instanceId);
}
