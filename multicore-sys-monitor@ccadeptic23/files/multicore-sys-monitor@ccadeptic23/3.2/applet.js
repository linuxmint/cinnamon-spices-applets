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
var ImportErrorMsg = "";
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
//const Cairo = imports.cairo;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const NMClient = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;

const UUID = "multicore-sys-monitor@ccadeptic23";

var SpawnProcess = null; //defined in main (my library)
var ErrorApplet = null; //defined in main (my library)
var ConfigSettings = null; //defined in main (my library)
var Graphs = null; //defined in main (my library)
var DataProviders = null; //defined in main (my library)

try {
  const GTop = imports.gi.GTop; //psst this is really only to see if we can
} catch (err) {
  ImportError = true;
  global.logError(err);
  ImportErrorMsg = err.toString();
}

// Translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
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
    this.configfilepath = this.metadata.path; //apparently this is predefined which is nice to know

    this.configSettings = new ConfigSettings(this.configfilepath);

    this._initContextMenu();

    if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
      this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
    } else {
      this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
    }

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
    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, ()=>{
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
    let preferences_menu_item = new Applet.MenuItem(_("Preferences"), Gtk.STOCK_EDIT, Lang.bind(this, this.launchPreferences));
    this._applet_context_menu.addMenuItem(preferences_menu_item);
    this.out_reader = null;
  },
  launchPreferences: function() {
    var currprefs = this.configSettings.getCurrentPreferencesString();
    print(this.configfilepath, ["prefs.js", currprefs])
    if (this.childProcessHandler == null) {
      this.childProcessHandler = new SpawnProcess.ProcessSpawnHandler(this.configfilepath, ["prefs.js", currprefs]);
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
    try {
      if (this.childProcessHandler != null) {
        var currentmsg = this.childProcessHandler.getCurrentMessage();

        if (currentmsg === "SAVE") {
          this.configSettings.saveSettings();
        } else if (currentmsg !== "SAVE" && currentmsg !== "") //currentmsg is "" when we have not had time to read anything yet
        {
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

      this.multiCpuProvider.isEnabled = this.configSettings.isCPUEnabled()
      this.memProvider.isEnabled = this.configSettings.isMEMEnabled();
      this.netProvider.isEnabled = this.configSettings.isNETEnabled();
      this.diskProvider.isEnabled = this.configSettings.isDiskEnabled();

      for (var i = 0; i < this.graphs.length; i++) {
        this.graphs[i].refreshData();
      }

      //global.logError(this.diskProvider.getData());

      this.graphArea.queue_repaint();

      //Set the Applet Tooltip
      var appletTooltipstr = "";
      appletTooltipstr += this.multiCpuProvider.getTooltipString();
      appletTooltipstr += this.memProvider.getTooltipString();
      appletTooltipstr += this.swapProvider.getTooltipString();
      appletTooltipstr += this.netProvider.getTooltipString();
      appletTooltipstr += this.diskProvider.getTooltipString();
      this.set_applet_tooltip(appletTooltipstr.trim());
    } catch (err) {
      global.logError(err);
    }
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
        this.multiCpuGraph.paint(area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getCPUWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getCPUColorList());

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getCPUWidth() + 1; //update xoffset for next translation
      }

      if (this.configSettings.isMEMEnabled()) {

        area.get_context().translate(xoffset, 0); //translate origin to the new location for the graph
        //paint the "swap" backdrop
        this.swapGraph.paint(area,
          false, //never use labels for the backdrop
          this.configSettings.getMEMWidth(),
          this.configSettings.getHeight(),
          [0, 0, 0, 0],
          [0, 0, 0, 0], //want a clear background so that it doesnt mess up the other one
          this.configSettings.getSwapColorList());

        //paint the memory piechart over it
        this.memGraph.paint(area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getMEMWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getMEMColorList());

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getMEMWidth() + 1; //update xoffset for next translation

      }
      if (this.configSettings.isNETEnabled()) {

        area.get_context().translate(xoffset, 0); //translate origin to the new location for the graph

        //paint the memory piechart over it
        this.netGraph.paint(area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getNETWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getNETColorList());

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getNETWidth() + 1; //update xoffset for next translation
      }
      if (this.configSettings.isDiskEnabled()) {

        area.get_context().translate(xoffset, 0); //translate origin to the new location for the graph

        //paint the memory piechart over it
        this.diskGraph.paint(area,
          this.configSettings.getLabelsOn(),
          this.configSettings.getDiskWidth(),
          this.configSettings.getHeight(),
          this.configSettings.getLabelColor(),
          this.configSettings.getBackgroundColor(),
          this.configSettings.getDiskColorList());

        area.get_context().translate(-1 * xoffset, 0); //return translation to origin
        xoffset += this.configSettings.getDiskWidth() + 1; //update xoffset for next translation
      }
      area.set_width(this.getAppletWidth());

    } catch (e) {
      global.logError("in onGraphRepaint: " + e.stack);
    }
  }
};

function main(metadata, orientation) {
  imports.searchPath.push(metadata.path);

  if (ImportError) {
    ErrorApplet = imports.ErrorApplet;
    var errmsg = ImportErrorMsg;
    var myErrorApplet = new ErrorApplet.ErrorImportApplet(orientation, errmsg);
    if (typeof GTop === 'undefined') { //we don't have the gtop package
      errmsg = _("Please install \"gir1.2-gtop-2.0\" package.");
      let _is_apturl_present = GLib.find_program_in_path("apturl");
      if (_is_apturl_present) {
        const Extension = imports.ui.extension;
        const PopupMenu = imports.ui.popupMenu;
        let restart_button = new PopupMenu.PopupMenuItem(_("Reload this applet"));
        restart_button.connect('activate', Lang.bind(this, function(event) {
          Extension.reloadExtension(UUID, Extension.Type.APPLET);
        }));
        myErrorApplet.menu.addMenuItem(restart_button);
        const Util = imports.misc.util;
        Util.spawnCommandLine("apturl apt://gir1.2-gtop-2.0");
      }
    }
    return myErrorApplet;
  } else {
    ConfigSettings = imports.ConfigSettings.ConfigSettings;
    SpawnProcess = imports.SpawnProcess;
    Graphs = imports.Graphs;
    DataProviders = imports.DataProviders;
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
  }
}
