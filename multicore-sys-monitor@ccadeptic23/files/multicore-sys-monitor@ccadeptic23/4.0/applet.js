// Multi-core System Monitor.
// Copyright (C) 2017 Jason Hicks <jaszhix@gmail.com>.
// Copyright (C) 2011-2012 Chace Clark <ccdevelop23@gmail.com>.
//
// Multi-core System Monitor is libre software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or newer.
//
// You should have received a copy of the GNU General Public License along with
// this file. If not, see <http://www.gnu.org/licenses/>.

const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const appSystem = imports.gi.Cinnamon.AppSystem.get_default();
const Util = imports.misc.util;
const Main = imports.ui.main;
const Applet = imports.ui.applet;

const UUID = 'multicore-sys-monitor@ccadeptic23';

let _, tryFn, ConfigSettings, SpawnProcess, Graphs, DataProviders;
if (typeof require !== 'undefined') {
  const utils = require('./utils');
  _ = utils._;
  tryFn = utils.tryFn;
  ConfigSettings = require('./ConfigSettings').ConfigSettings;
  SpawnProcess = require('./SpawnProcess');
  Graphs = require('./Graphs');
  DataProviders = require('./DataProviders');
} else {
  const AppletDir = imports.ui.appletManager.applets[UUID];
  _ = AppletDir.utils._;
  tryFn = AppletDir.utils.tryFn;
  ConfigSettings = AppletDir.ConfigSettings.ConfigSettings;
  SpawnProcess = AppletDir.SpawnProcess;
  Graphs = AppletDir.Graphs;
  DataProviders = AppletDir.DataProviders;
}

let GTop, gtopFailed;
tryFn(function() {
  GTop = imports.gi.GTop;
}, function(e) {
  let icon = new St.Icon({
    icon_type: St.IconType.FULLCOLOR,
    icon_size: 24 * global.ui_scale,
    gicon: new Gio.FileIcon({
      file: Gio.file_new_for_path(
        GLib.get_home_dir() +
        '/.local/share/cinnamon/applets/multicore-sys-monitor@ccadeptic23/3.4/icon.png'
      )
    })
  });
  Main.criticalNotify(
    _('Dependency missing'),
    _(
      'Please install the GTop package\n' +
      '\tUbuntu / Mint: gir1.2-gtop-2.0\n' +
      '\tFedora: libgtop2-devel\n' +
      '\tArch: libgtop\n' +
      'to use ' + UUID
    ), icon);
  gtopFailed = true;
});

if (typeof Object.assign !== 'function') {
  // Must be writable: true, enumerable: false, configurable: true
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
  String.prototype.padStart = function padStart(targetLength, padString) {
    targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
    padString = String(padString || ' ');
    if (this.length > targetLength) {
      return String(this);
    } else {
      targetLength = targetLength - this.length;
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
      }
      return padString.slice(0, targetLength) + String(this);
    }
  };
}
// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
if (!String.prototype.padEnd) {
  String.prototype.padEnd = function padEnd(targetLength, padString) {
    targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
    padString = String(padString || ' ');
    if (this.length > targetLength) {
      return String(this);
    } else {
      targetLength = targetLength - this.length;
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
      }
      return String(this) + padString.slice(0, targetLength);
    }
  };
}

const properties = [
  {graph: 'multiCpuGraph', provider: 'multiCpuProvider', abbrev: 'CPU'},
  {graph: 'memoryGraph', provider: 'memoryProvider', abbrev: 'MEM'},
  {graph: 'swapGraph', provider: 'swapProvider', abbrev: 'Swap'},
  {graph: 'networkGraph', provider: 'networkProvider', abbrev: 'NET'},
  {graph: 'diskGraph', provider: 'diskProvider', abbrev: 'Disk'}
];

function MyApplet(metadata, orientation, panel_height) {
  this._init(metadata, orientation, panel_height);
}

let appletClass = gtopFailed ? 'IconApplet' : 'Applet';

MyApplet.prototype = {
  __proto__: Applet[appletClass].prototype,

  _init: function(metadata, orientation, panel_height) {
    Applet[appletClass].prototype._init.call(this, orientation);

    if (gtopFailed) {
      this.set_applet_icon_path(metadata.path + '/icon.png');
      this.set_applet_tooltip(metadata.description);
      return;
    }

    this.actor.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
    this.childProcessHandler = null;
    this.metadata = metadata;
    this.panelHeight = panel_height;

    let dotCinnamonFilePath = GLib.get_home_dir() + '/.cinnamon/configs';
    if (Gio.file_new_for_path(dotCinnamonFilePath).query_exists(null))
      this.configFilePath = GLib.get_home_dir() + '/.cinnamon/configs/' + metadata.uuid;
    else
      this.configFilePath = GLib.get_home_dir() + '/.config/cinnamon/spices/' + metadata.uuid;
    this.shouldUpdate = true;

    let configFile = Gio.file_new_for_path(this.configFilePath);

    if (!configFile.query_exists(null)) {
      Util.spawnCommandLineAsync('mkdir ' + this.configFilePath, () => {
        this.__init(panel_height);
      });
    } else {
      this.__init(panel_height);
    }
  },

  __init: function() {
    this.configSettings = new ConfigSettings(this.configFilePath);

    this._initContextMenu();

    this.actor.connect('enter-event', () => {
      this.hovered = true;
      // Work around hovering over a PangoCairo canvas instance triggering a false positive panel leave event
      if (this.panel._autohideSettings !== 'false') {
        this.originalAutoHideSetting = this.panel._autohideSettings;
        this.panel._autohideSettings = 'true';
        this.panel._updatePanelVisibility();
      }
    });
    this.actor.connect('leave-event', () => {
      this.hovered = false;
      if (this.originalAutoHideSetting) {
        this.originalAutoHideSetting = null;
        this.panel._autohideSettings = this.originalAutoHideSetting;
      }
    });

    this.graphArea = new St.DrawingArea();

    this.graphArea.width = 1;
    this.graphArea.height = this.panelHeight * global.ui_scale;

    this.graphArea.connect('repaint', (area) => this.onGraphRepaint(area));

    this.multiCpuProvider = new DataProviders.MultiCpuDataProvider();
    this.configSettings.adjustCPUcount(this.multiCpuProvider.getCPUCount());

    this.memoryProvider = new DataProviders.MemDataProvider();
    this.swapProvider = new DataProviders.SwapDataProvider();
    this.networkProvider = new DataProviders.NetDataProvider();
    this.diskProvider = new DataProviders.DiskDataProvider();

    this.configSettings.adjustDevices('disk', this.diskProvider.currentReadings);
    this.diskProvider.setDisabledDevices(this.configSettings.getDisabledDevices('disk'));

    this.configSettings.adjustDevices('net', this.networkProvider.currentReadings);
    this.networkProvider.setDisabledInterfaces(this.configSettings.getDisabledDevices('net'));

    this.multiCpuGraph = new Graphs.GraphVBars(this.graphArea);
    this.memoryGraph = new Graphs.GraphPieChart(this.graphArea);
    this.swapGraph = new Graphs.GraphVBars(this.graphArea);

    this.networkGraph = new Graphs.GraphLineChart(this.graphArea, this.configSettings._prefs.net.width);
    //For us this means the heighest point wont represent a valuelower than 1Kb/s
    this.networkGraph.autoScale = this.configSettings._prefs.net.autoscale;
    this.networkGraph.logScale = this.configSettings._prefs.net.logscale;

    this.diskGraph = new Graphs.GraphLineChart(this.graphArea, this.configSettings._prefs.disk.width);
    this.diskGraph.autoScale = this.configSettings._prefs.disk.autoscale;
    this.diskGraph.logScale = this.configSettings._prefs.disk.logscale;

    this.actor.add_actor(this.graphArea);

    if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
      this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
    } else {
      this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
    }
    this.loopId = 0;
    this.loopId = Mainloop.timeout_add(this.configSettings._prefs.refreshRate, () => this._update());
  },

  on_applet_removed_from_panel: function() {
    if (gtopFailed) return;
    if (this.loopId) {
      Mainloop.source_remove(this.loopId);
    }
    this.shouldUpdate = false;
    this.graphArea.destroy();
    this.networkProvider.destroy();
    this.diskProvider.destroy();
  },

  on_panel_height_changed: function() {
    this.panelHeight = this._panelHeight;
  },

  _initContextMenu: function() {
    // Todo - make this a submenu item
    let preferences_menu_item = new Applet.MenuItem(_('Preferences'), Gtk.STOCK_EDIT, () => this.launchPreferences());
    this._applet_context_menu.addMenuItem(preferences_menu_item);
    this.out_reader = null;
  },
  launchPreferences: function() {
    let currentPreferences = JSON.stringify(this.configSettings._prefs);
    if (this.childProcessHandler == null) {
      // TBD
      this.childProcessHandler = new SpawnProcess.ProcessSpawnHandler(this.metadata.path, ['cjs', 'prefs.js', currentPreferences]);
    }
  },
  on_orientation_changed: function(orientation) {
    this._initContextMenu();
  },

  _runSysMon: function() {
    let gnomeSystemMonitor = appSystem.lookup_app('gnome-system-monitor.desktop');
    if (gnomeSystemMonitor) {
      gnomeSystemMonitor.activate();
    }
  },

  on_applet_clicked: function(event) {
    this._runSysMon();
  },

  _update: function() {
    // This loops on interval, we need to make sure it stops when the xlet is removed.
    if (!this.networkProvider) {
      if (this.loopId > 0) {
        Mainloop.source_remove(this.loopId);
      }
      this.loopId = 0;
      return false;
    }
    if (this.childProcessHandler != null) {
      let currentMessage = this.childProcessHandler.getCurrentMessage();

      if (currentMessage === 'SAVE') {
        this.configSettings.saveSettings();
      } else if (currentMessage !== 'SAVE' && currentMessage !== '') {
        this.configSettings.updateSettings(currentMessage);
      }
      // Do any required processing when configuration changes
      this.networkProvider.setDisabledInterfaces(this.configSettings.getDisabledDevices('net'));
      this.networkGraph.autoScale = this.configSettings._prefs.net.autoscale;
      this.networkGraph.logScale = this.configSettings._prefs.net.logscale;

      // check for new drives that are mounted
      this.configSettings.adjustDevices('net', this.networkProvider.currentReadings);
      this.diskProvider.setDisabledDevices(this.configSettings.getDisabledDevices('disk'));
      this.diskGraph.autoScale = this.configSettings._prefs.disk.autoscale;
      this.diskGraph.logScale = this.configSettings._prefs.disk.logscale;

      if (this.childProcessHandler.isChildFinished()) {
        this.childProcessHandler.destroy();
        this.childProcessHandler = null;
      }
    }

    // Set the Applet Tooltip
    let appletTooltipString = '';

    for (let i = 0; i < properties.length; i++) {
      if (properties[i].abbrev !== 'Swap') {
        this[properties[i].provider].isEnabled = this.configSettings._prefs[properties[i].abbrev.toLowerCase()].enabled;
      }
      this[properties[i].provider].getData();
      appletTooltipString += this[properties[i].provider].getTooltipString();
    }

    this.graphArea.queue_repaint();
    if (this.hovered) {
      this.set_applet_tooltip(appletTooltipString);
    }

    // set next refresh time
    return this.shouldUpdate;
  },
  onGraphRepaint: function(area) {
    let xOffset = 0;
    for (let i = 0; i < properties.length; i++) {
      if (properties[i].abbrev === 'Swap') {
        continue;
      }
      if (this[properties[i].provider].isEnabled) {
        // translate origin to the new location for the graph
        let areaContext = area.get_context();
        areaContext.translate(xOffset, 0);
        let width = this.configSettings._prefs[properties[i].abbrev.toLowerCase()].width * global.ui_scale;
        if (properties[i].abbrev === 'MEM') {
          // paint the "swap" backdrop
          this.swapGraph.paint(
            this.swapProvider.name,
            this.swapProvider.currentReadings,
            area,
            areaContext,
            // no label for the backdrop
            false,
            width,
            this.panelHeight - 2 * global.ui_scale,
            [0, 0, 0, 0],
            // clear background so that it doesn't mess up the other one
            [0, 0, 0, 0],
            this.configSettings._prefs.mem.swapcolors
          );
        }
        this[properties[i].graph].paint(
          this[properties[i].provider].name,
          this[properties[i].provider].currentReadings,
          area,
          areaContext,
          this.configSettings._prefs.labelsOn,
          width,
          this.panelHeight - 2 * global.ui_scale,
          this.configSettings._prefs.labelColor,
          this.configSettings._prefs.backgroundColor,
          this.configSettings['get' + properties[i].abbrev + 'ColorList']()
        );
        // return translation to origin
        areaContext.translate(-xOffset, 0);
        // update xOffset for next translation
        xOffset += width + 1;
      }
    }
    area.set_width(xOffset > 1 ? xOffset - 1 : 1);
    area.set_height(this.panelHeight);
  }
};

function main(metadata, orientation, panel_height) {
  return new MyApplet(metadata, orientation, panel_height);
}
