// Multi-core System Monitor.
// Copyright (C) 2011-2012 Chace Clark <ccdevelop23@gmail.com>.
//
// Multi-core System Monitor is libre software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or newer.
//
// You should have received a copy of the GNU General Public License along with
// this file. If not, see <http://www.gnu.org/licenses/>.
/*  Imports SearchPath
 * 0 /usr/share/cinnamon/js
 * 1 /usr/share/cinnamon/gjs-1.0
 * 2 /usr/share/gnome/gjs-1.0
 * 3 /usr/local/share/gjs-1.0
 * 4 /usr/share/gjs-1.0
 * 5 /usr/share/mdm/gjs-1.0
 * 6 /usr/lib/gjs-1.0
 * 7 /usr/share/gjs-1.0
 * 8 ~/.local/share/cinnamon/applets/multicore-sys-monitor@ccadeptic23 (via metadata)
 * */
var ImportError = false; //flag import error
var ImportErrorMsg = '';
// Todo: clean up this try-catch
try {
  var Applet = imports.ui.applet;
  var Lang = imports.lang;
  var Mainloop = imports.mainloop;
  var St = imports.gi.St;
  var Gtk = imports.gi.Gtk;
  var GLib = imports.gi.GLib;
  var Gio = imports.gi.Gio;
  var Cinnamon = imports.gi.Cinnamon;
  var Gettext = imports.gettext;
  var GTop = imports.gi.GTop; //psst this is really only to see if we can
  var UUID = 'multicore-sys-monitor@ccadeptic23';
  var Util = imports.misc.util;
} catch (err) {
  ImportError = true;
  global.logError(err);
  ImportErrorMsg = err.toString();
}

const AppletDir = imports.ui.appletManager.applets[UUID];
const ConfigSettings = AppletDir.ConfigSettings.ConfigSettings;
const SpawnProcess = AppletDir.SpawnProcess;
const Graphs = AppletDir.Graphs;
const DataProviders = AppletDir.DataProviders;
const ErrorApplet = AppletDir.ErrorApplet;

// Translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// findIndex polyfill for mozjs24
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
// https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
if (!Array.prototype.findIndex) {
  Object.defineProperty(Array.prototype, 'findIndex', {
    value: function(predicate) {
      // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      var thisArg = arguments[1];

      // 5. Let k be 0.
      var k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, kValue, k, O)).
        // d. If testResult is true, return k.
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return k;
        }
        // e. Increase k by 1.
        k++;
      }

      // 7. Return -1.
      return -1;
    }
  });
}
// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
  String.prototype.padStart = function padStart(targetLength,padString) {
      targetLength = targetLength>>0; //floor if number or convert non-number to 0;
      padString = String(padString || ' ');
      if (this.length > targetLength) {
          return String(this);
      }
      else {
          targetLength = targetLength-this.length;
          if (targetLength > padString.length) {
              padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
          }
          return padString.slice(0,targetLength) + String(this);
      }
  };
}
// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
if (!String.prototype.padEnd) {
  String.prototype.padEnd = function padEnd(targetLength,padString) {
      targetLength = targetLength>>0; //floor if number or convert non-number to 0;
      padString = String(padString || ' ');
      if (this.length > targetLength) {
          return String(this);
      }
      else {
          targetLength = targetLength-this.length;
          if (targetLength > padString.length) {
              padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
          }
          return String(this) + padString.slice(0,targetLength);
      }
  };
}

function MyApplet(metadata, orientation) {
  this._init(metadata, orientation);
}

MyApplet.prototype = {
  __proto__: Applet.Applet.prototype,

  _init: function(metadata, orientation) {
    Applet.Applet.prototype._init.call(this, orientation);

    this.childProcessHandler = null;

    this.metadata = metadata;
    this.configFilePath = GLib.get_home_dir() + '/.cinnamon/configs/' + metadata.uuid;

    let configFile = Gio.file_new_for_path(this.configFilePath);

    if (!configFile.query_exists(null)) {
      Util.spawnCommandLineAsync('mkdir ' + this.configFilePath, () => {
        this.__init();
      });
    } else {
      this.__init();
    }
  },

  __init: function() {
    this.configSettings = new ConfigSettings(this.configFilePath);

    this._initContextMenu();

    //this.gtop = new GTop.glibtop_cpu();

    this.graphArea = new St.DrawingArea();

    this.graphArea.width = this.getAppletWidth();
    this.graphArea.height = this.configSettings.getHeight();
    this.graphArea.connect('repaint', Lang.bind(this, this.onGraphRepaint));

    this.multiCpuProvider = new DataProviders.MultiCpuDataProvider();
    //resize the cpucolorslist from the potential newcpucount
    this.configSettings.adjustCPUcount(this.multiCpuProvider.getCPUCount());

    this.memProvider = new DataProviders.MemDataProvider();
    this.swapProvider = new DataProviders.SwapDataProvider();

    // Defer the remaining initialization as netProvider and diskProvider classes have been
    // isolated with causing GTop init errors on mozjs38.
    // Better fix should be considered.
    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, () => {
      this.netProvider = new DataProviders.NetDataProvider();
      this.diskProvider = new DataProviders.DiskDataProvider();
      this.configSettings.adjustDiskDevices(this.diskProvider.getDiskDevices());
      this.diskProvider.setDisabledDevices(this.configSettings.getDiskDisabledDevices());

      this.configSettings.adjustNetInterfaces(Object.keys(this.netProvider.getNetDevices()));
      this.netProvider.setDisabledInterfaces(this.configSettings.getNETDisabledDevices());

      this.multiCpuGraph = new Graphs.GraphVBars(this.graphArea, this.multiCpuProvider);
      this.memGraph = new Graphs.GraphPieChart(this.graphArea, this.memProvider);
      this.swapGraph = new Graphs.GraphVBars(this.graphArea, this.swapProvider);

      this.netGraph = new Graphs.GraphLineChart(this.graphArea, this.netProvider, this.configSettings.getNETWidth());
      this.netGraph.setMinScaleYvalue(1.0); //For us this means the heighest point wont represent a valuelower than 1Kb/s
      this.netGraph.setAutoScale(this.configSettings.isNETAutoScaled());
      this.netGraph.setLogScale(this.configSettings.isNETLogScaled());

      this.diskGraph = new Graphs.GraphLineChart(this.graphArea, this.diskProvider, this.configSettings.getDiskWidth());
      this.diskGraph.setMinScaleYvalue(1.0); //For us this means the heighest point wont represent a valuelower than 1Kb/s
      this.diskGraph.setAutoScale(this.configSettings.isDiskAutoScaled());
      this.diskGraph.setLogScale(this.configSettings.isDiskLogScaled());

      this.graphs = [];
      this.graphs[0] = this.multiCpuGraph;
      this.graphs[1] = this.memGraph;
      this.graphs[2] = this.swapGraph;
      this.graphs[3] = this.netGraph;
      this.graphs[4] = this.diskGraph;

      this.actor.add_actor(this.graphArea);
      this._update();
    });
  },

  _initContextMenu: function() {
    let preferences_menu_item = new Applet.MenuItem(_('Preferences'), Gtk.STOCK_EDIT, Lang.bind(this, this.launchPreferences));
    this._applet_context_menu.addMenuItem(preferences_menu_item);
    this.out_reader = null;
  },
  launchPreferences: function() {
    var currprefs = this.configSettings.getCurrentPreferencesString();
    print(this.configFilePath, ['prefs.js', currprefs]);
    if (this.childProcessHandler == null) {
      this.childProcessHandler = new SpawnProcess.ProcessSpawnHandler(this.metadata.path, ['prefs.js', currprefs]);
    }
  },
  on_orientation_changed: function(orientation) {
    this._initContextMenu();
  },

  _runSysMon: function() {
    let _appSys = Cinnamon.AppSystem.get_default();
    let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
    _gsmApp.activate();
  },

  on_applet_clicked: function(event) {
    this._runSysMon();
  },

  _update: function() {
    if (this.childProcessHandler != null) {
      var currentmsg = this.childProcessHandler.getCurrentMessage();

      if (currentmsg === 'SAVE') {
        this.configSettings.saveSettings();
      } else if (currentmsg !== 'SAVE' && currentmsg !== '') {
        //currentmsg is "" when we have not had time to read anything yet
        this.configSettings.updateSettings(currentmsg);
      }

      if (this.childProcessHandler.isChildFinished()) {
        this.childProcessHandler.destroy();
        this.childProcessHandler = null;
      }
    }
    //Do any required processing when configuration changes
    this.netProvider.setDisabledInterfaces(this.configSettings.getNETDisabledDevices());
    this.netGraph.setAutoScale(this.configSettings.isNETAutoScaled());
    this.netGraph.setLogScale(this.configSettings.isNETLogScaled());
    //check for new drives that are mounted
    this.configSettings.adjustDiskDevices(Object.keys(this.diskProvider.getDiskDevices()));
    this.diskGraph.setAutoScale(this.configSettings.isDiskAutoScaled());
    this.diskGraph.setLogScale(this.configSettings.isDiskLogScaled());

    //update data from providers.. a bit convoluted i may change later

    this.multiCpuProvider.isEnabled = this.configSettings.isCPUEnabled();
    this.memProvider.isEnabled = this.configSettings.isMEMEnabled();
    this.netProvider.isEnabled = this.configSettings.isNETEnabled();
    this.diskProvider.isEnabled = this.configSettings.isDiskEnabled();

    for (var i = 0; i < this.graphs.length; i++) {
      this.graphs[i].refreshData();
    }

    //global.logError(this.diskProvider.getData());

    this.graphArea.queue_repaint();

    //Set the Applet Tooltip
    var appletTooltipstr = '';
    appletTooltipstr += this.multiCpuProvider.getTooltipString();
    appletTooltipstr += this.memProvider.getTooltipString();
    appletTooltipstr += this.swapProvider.getTooltipString();
    appletTooltipstr += this.netProvider.getTooltipString();
    appletTooltipstr += this.diskProvider.getTooltipString();
    this.set_applet_tooltip(appletTooltipstr.trim());

    //set next refresh time
    Mainloop.timeout_add(this.configSettings.getRefreshRate(), Lang.bind(this, this._update));
  },
  getAppletWidth: function() {
    var appwidth = 0;

    if (this.configSettings.isCPUEnabled()) {
      appwidth += this.configSettings.getCPUWidth() + 1;
    }
    if (this.configSettings.isMEMEnabled()) {
      appwidth += this.configSettings.getMEMWidth() + 1;
    }
    if (this.configSettings.isNETEnabled()) {
      appwidth += this.configSettings.getNETWidth() + 1;
    }
    if (this.configSettings.isDiskEnabled()) {
      appwidth += this.configSettings.getDiskWidth() + 1;
    }

    appwidth--; //last one doesnt need the pixel space between
    //prevents error when all are disabled
    if (appwidth <= 0) {
      appwidth = 1;
    }

    return appwidth;
  },
  onGraphRepaint: function(area) {
    try {
      area.get_context().translate(0, 2);
      var xoffset = 0;
      if (this.configSettings.isCPUEnabled()) {
        area.get_context().translate(xoffset, 0);
        this.multiCpuGraph.paint(
          area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getCPUWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getCPUColorList()
        );

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getCPUWidth() + 1; //update xoffset for next translation
      }

      if (this.configSettings.isMEMEnabled()) {
        area.get_context().translate(xoffset, 0); //translate origin to the new location for the graph
        //paint the "swap" backdrop
        this.swapGraph.paint(
          area,
          false, //never use labels for the backdrop
          this.configSettings.getMEMWidth(),
          this.configSettings.getHeight(),
          [0, 0, 0, 0],
          [0, 0, 0, 0], //want a clear background so that it doesnt mess up the other one
          this.configSettings.getSwapColorList()
        );

        //paint the memory piechart over it
        this.memGraph.paint(
          area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getMEMWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getMEMColorList()
        );

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getMEMWidth() + 1; //update xoffset for next translation
      }
      if (this.configSettings.isNETEnabled()) {
        area.get_context().translate(xoffset, 0); //translate origin to the new location for the graph

        //paint the memory piechart over it
        this.netGraph.paint(
          area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getNETWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getNETColorList()
        );

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getNETWidth() + 1; //update xoffset for next translation
      }
      if (this.configSettings.isDiskEnabled()) {
        area.get_context().translate(xoffset, 0); //translate origin to the new location for the graph

        //paint the memory piechart over it
        this.diskGraph.paint(
          area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getDiskWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getDiskColorList()
        );

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getDiskWidth() + 1; //update xoffset for next translation
      }
      area.set_width(this.getAppletWidth());
    } catch (e) {
      global.logError('in onGraphRepaint: ' + e.stack);
    }
  }
};

function main(metadata, orientation) {
  if (ImportError) {
    if (typeof GTop === 'undefined') {
      errmsg = _('Please install "gir1.2-gtop-2.0" package.');
    }
    return new ErrorApplet.ErrorImportApplet(orientation, errmsg);
  } else {
    return new MyApplet(metadata, orientation);
  }
}
