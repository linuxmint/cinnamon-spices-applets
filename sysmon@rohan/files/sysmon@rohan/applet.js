const UUID = "sysmon@rohan";

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const HOME_DIR = GLib.get_home_dir();

Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

let GTop;
let failed = false;
try {
  GTop = imports.gi.GTop;
} catch (e) {
  global.logError(_("Required GTop package missing!: ") + e);
  failed = true;
}

function MyApplet(metadata, orientation, panelHeight, instanceId) {
  this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
  __proto__: Applet.TextApplet.prototype,

  _init: function(metadata, orientation, panelHeight, instanceId) {
    Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

    if (failed) {
      this.errorLabel = new St.Label();
      this.errorLabel.set_text(_("Error!"));
      this.actor.add(this.errorLabel, {
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE,
        y_fill: false
      });
      this._applet_tooltip.set_text(_("Required GTop package missing!"));
    } else {

      this._applet_tooltip._tooltip.set_style("text-align: left; font-family: monospace; font-size: 9pt");

      this._applet_context_menu.addMenuItem(new Applet.MenuItem(_("Clear Page Cache"), "user-trash", () => {
        Util.spawnCommandLineAsync("pkexec sh -c 'sync && echo 1 > /proc/sys/vm/drop_caches'");
      }));

      this.settings = new Settings.AppletSettings(this, UUID, instanceId);
      this._bind_settings();

      this.cpuLabel = new St.Label();
      this.memLabel = new St.Label();

      let iconBasePath = HOME_DIR + "/.local/share/cinnamon/applets/sysmon@rohan/icons";

      let cpuIconPath = iconBasePath + "/cpu-symbolic.svg";
      let memIconPath = iconBasePath + "/ram-symbolic.svg";

      let cpuIconFile = Gio.File.new_for_path(cpuIconPath);
      let memIconFile = Gio.File.new_for_path(memIconPath);

      this.cpuIcon = new St.Icon({
        gicon: new Gio.FileIcon({
          file: cpuIconFile
        }),
        icon_size: panelHeight * 0.4,
        style_class: "system-status-icon"
      });

      this.memIcon = new St.Icon({
        gicon: new Gio.FileIcon({
          file: memIconFile
        }),
        icon_size: panelHeight * 0.4,
        style_class: "system-status-icon"
      });

      this.cpuLabel.set_style("text-align: left");
      this.memLabel.set_style("text-align: left");

      this.cpuLabel.set_text("---%");
      this.memLabel.set_text("---");

      this.actor.add(this.cpuIcon, {
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE,
        y_fill: false
      });
      this.actor.add(this.cpuLabel, {
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE,
        y_fill: false
      });

      this.actor.add(new St.Label({
        text: " "
      }));

      this.actor.add(this.memIcon, {
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE,
        y_fill: false
      });
      this.actor.add(this.memLabel, {
        x_align: St.Align.MIDDLE,
        y_align: St.Align.MIDDLE,
        y_fill: false
      });

      this.actor.add(new St.Label({
        text: " "
      }));

      this.cpuDataProvider = new MultiCPUDataProvider();
      this.memDataProvider = new MemDataProvider();

      this.timeout = Mainloop.timeout_add_seconds(1, () => this._update());
    }
  },
  _remove_timeout: function() {
    if (this.timeout) {
      Mainloop.source_remove(this.timeout);
      this.timeout = 0;
    }
  },

  _update_display: function() {
    this.cpuLabel.visible = this.displayCpu;
    this.memLabel.visible = this.displayRam;
  },

  _bind_settings: function() {
    this.settings.bindProperty(Settings.BindingDirection.IN, "displayCpu", "displayCpu", this._update_display.bind(this), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "displayRam", "displayRam", this._update_display.bind(this), null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "updateInterval", "updateInterval", null, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "toggleRam", "toggleRam", null, null);
  },

  _update: function() {
    let shortInfo,
      longInfo,
      tooltip;
    [shortInfo, longInfo] = this.cpuDataProvider.data();

    this.cpuLabel.set_text(shortInfo);
    tooltip = "<b>" + _("CPUs") + "</b>   " + "\n" + longInfo + "\n\n";

    [shortInfo, longInfo] = this.memDataProvider.data();
    if (this.toggleRam) {
      let percentUsed = parseFloat(shortInfo);
      let usedInGB = (percentUsed / 100) * (this.memDataProvider.memSize / 1000000000);
      shortInfo = usedInGB.toFixed(1) + "GB";

    }
    this.memLabel.set_text(shortInfo);

    tooltip += "<b>" + _("Memory") + "</b> (<i>" + (this.memDataProvider.memSize / 1000000000).toFixed(1) + _("GB") + (this.memDataProvider.swapSize ? "; " + (this.memDataProvider.swapSize / 1000000000).toFixed(1) + _("GB swap") : "") + "</i>)\n" + longInfo + "\n\n";
    this._applet_tooltip.set_markup(tooltip);
    this._remove_timeout();
    this.timeout = Mainloop.timeout_add_seconds(this.updateInterval, () => this._update());
  },

  _runSysMon: function() {

    const _appSys = imports.gi.Cinnamon.AppSystem.get_default();
    let gnomeSystemMonitor = _appSys.lookup_app('gnome-system-monitor.desktop');

    if (gnomeSystemMonitor) {

      gnomeSystemMonitor.activate();
      return;
    }
    gnomeSystemMonitor = _appSys.lookup_app('org.gnome.SystemMonitor.desktop');
    if (gnomeSystemMonitor) {
      gnomeSystemMonitor.activate();
    }
  },

  on_applet_clicked: function(event) {
    this._runSysMon();
  },

  on_applet_removed_from_panel: function() {
    if (!failed) {
      this._remove_timeout();
    } else {
      this.errorLabel.destroy();
    }
  }
};

function MultiCPUDataProvider() {
  this._init();
}

MultiCPUDataProvider.prototype = {
  _init: function() {
    this.gtop = new GTop.glibtop_cpu();
    this.CPUCount = 0;

    this.current = 0;
    this.last = 0;
    this.usage = 0;
    this.last_total = 0;

    this.CPUListTotal = [];
    this.CPUListNice = [];
    this.CPUListSys = [];
    this.CPUListUser = [];

    this.currentReadings = [];

    this._fetch_data();
  },

  _fetch_data: function() {
    GTop.glibtop_get_cpu(this.gtop);
    if (this.CPUCount <= 0) {
      for (let i = 0; i < this.gtop.xcpu_total.length; i++) {
        if (this.gtop.xcpu_total[i] > 0) {
          this.CPUListTotal[this.CPUCount] = 0;
          this.CPUListNice[this.CPUCount] = 0;
          this.CPUListSys[this.CPUCount] = 0;
          this.CPUListUser[this.CPUCount] = 0;
          this.currentReadings[this.CPUCount] = 0;
          this.CPUCount++;
        }
      }
    }
    let xcpu_total = this.gtop.xcpu_total.slice();
    let xcpu_nice = this.gtop.xcpu_nice.slice();
    let xcpu_sys = this.gtop.xcpu_sys.slice();
    let xcpu_user = this.gtop.xcpu_user.slice();
    for (let i = 0; i < this.CPUCount; i++) {
      let dtotal = xcpu_total[i] - this.CPUListTotal[i];
      let dnice = xcpu_nice[i] - this.CPUListNice[i];
      let dsys = xcpu_sys[i] - this.CPUListSys[i];
      let duser = xcpu_user[i] - this.CPUListUser[i];
      this.currentReadings[i] = dtotal > 0 ? (duser + dnice + dsys) / dtotal : 0;
    }
    this.CPUListTotal = xcpu_total;
    this.CPUListNice = xcpu_nice;
    this.CPUListSys = xcpu_sys;
    this.CPUListUser = xcpu_user;
  },

  data: function(longInfoTab = 2, longInfoSize = 5) {
    this._fetch_data();
    let overall = 0,
      longInfo = "";
    for (let i = 0; i < this.CPUCount; i++) {
      overall += this.currentReadings[i];
      longInfo += " ".repeat(longInfoTab) + _("Core ") + (((i + 1) < 10 ? "0" : "") + (i + 1)) + ": " + align((this.currentReadings[i] * 100).toFixed(1), longInfoSize) + "%  " + (i < this.CPUCount - 1 ? "\n" : "");
    }
    return [(overall / this.CPUCount * 100).toFixed(0) + "%", longInfo];
  }
};

function MemDataProvider() {
  this._init();
}

MemDataProvider.prototype = {
  _init: function() {
    this.gtopMem = new GTop.glibtop_mem();
    this.gtopSwap = new GTop.glibtop_swap();
    this.memSize = 0;
    this.swapSize = 0;
    this.currentReadings = [0, 0, 0, 0, 0];
    this._fetch_size();
  },

  _fetch_size: function() {
    GTop.glibtop_get_mem(this.gtopMem);
    this.memSize = this.gtopMem.total;
  },

  _fetch_data: function() {
    GTop.glibtop_get_mem(this.gtopMem);
    GTop.glibtop_get_swap(this.gtopSwap);
    let unavailableForUse = (this.gtopMem.used - this.gtopMem.buffer - this.gtopMem.cached) / this.gtopMem.total;
    let cached = this.gtopMem.cached / this.gtopMem.total;
    let buffer = this.gtopMem.buffer / this.gtopMem.total;
    let free = this.gtopMem.free / this.gtopMem.total;
    let swap = this.gtopSwap.used / this.gtopSwap.total;
    if (isNaN(swap)) this.swapSize = 0;
    else this.swapSize = this.gtopSwap.total;
    this.currentReadings = [unavailableForUse, cached, buffer, free, swap];
  },

  data: function(longInfoTab = 2, longInfoSize = 5) {
    this._fetch_data();
    let overall = this.currentReadings[0];
    let longInfo = " ".repeat(longInfoTab) + _("Used:   ") + (this.currentReadings[0] * this.memSize / 1000000000).toFixed(1) + _(" GB") + " (" + align((this.currentReadings[0] * 100).toFixed(1), longInfoSize) + "%)\n" + " ".repeat(longInfoTab) + _("Cache:  ") + (this.currentReadings[1] * this.memSize / 1000000000).toFixed(1) + _(" GB") + " (" + align((this.currentReadings[1] * 100).toFixed(1), longInfoSize) + "%)\n" + " ".repeat(longInfoTab) + _("Buffer: ") + (this.currentReadings[2] * this.memSize / 1000000000).toFixed(1) + _(" GB") + " (" + align((this.currentReadings[2] * 100).toFixed(1), longInfoSize) + "%)\n" + " ".repeat(longInfoTab) + _("Free:   ") + (this.currentReadings[3] * this.memSize / 1000000000).toFixed(1) + _(" GB") + " (" + align((this.currentReadings[3] * 100).toFixed(1), longInfoSize) + "%)";
    if (this.swapSize) {
      longInfo += "\n" + " ".repeat(longInfoTab) + _("Swap:   ") + (this.currentReadings[4] * this.memSize / 1000000000).toFixed(1) + _(" GB") + " (" + align((this.currentReadings[4] * 100).toFixed(1), longInfoSize) + "%)";
    }
    return [(overall * 100).toFixed(0) + "%", longInfo];
  }
};

function align(str, size) {
  str = String(str);
  return (str.length < size ? " ".repeat(size - str.length) + str : str);
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new MyApplet(metadata, orientation, panelHeight, instanceId);
}

