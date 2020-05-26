//#!/usr/bin/gjs
const GTop = imports.gi.GTop; //psst this is really the one used
const NMClient = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
const Gio = imports.gi.Gio;
const UUID = "multicore-sys-monitor@ccadeptic23";
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const spaces = 12;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function lSpaced(word, n_max = spaces) {
	var ret = "";
	for (let i=0; i<n_max - word.length; i++)
		ret += " ";
	ret = ret + word;
	return ret;
}

function MultiCpuDataProvider() {
  this._init();
}
MultiCpuDataProvider.prototype = {

  _init: function() {
    this.isEnabled = true;
    this.gtop = new GTop.glibtop_cpu();
    this.cpucount = 0;

    this.current = 0;
    this.last = 0;
    this.usage = 0;
    this.last_total = 0;

    this.cpulist_total = [];
    this.cpulist_nice = [];
    this.cpulist_idle = [];
    this.cpulist_iowait = [];

    this.cpulist_sys = [];
    this.cpulist_user = [];

    this.cpulist_usage = [];

    this.getData(); //initialize the values from the first readding
  },
  getData: function() {
    GTop.glibtop_get_cpu(this.gtop);
    //Now that we have the first cpu reading we can get the number of cpu/core's (obviously shouldnt change)
    //This counts the cpu's that have a nonzero value for xcpu_total
    //I know its kind of a hack but it seems to work and i couldnt find a better way at this time
    //loop also initializes my lists
    if (this.cpucount <= 0) {
      for (var i = 0; i < this.gtop.xcpu_total.length; i++) {
        //there should be some activity for a cpu in use on a system. If so count it.
        if (this.gtop.xcpu_total[i] > 0) {
          this.cpulist_total[this.cpucount] = 0;
          this.cpulist_nice[this.cpucount] = 0;
          this.cpulist_idle[this.cpucount] = 0;
          this.cpulist_iowait[this.cpucount] = 0;

          this.cpulist_sys[this.cpucount] = 0;
          this.cpulist_user[this.cpucount] = 0;

          this.cpulist_usage[this.cpucount] = 0;
          this.cpucount++;
        }
      }
    }

    // calculate ticks since last call
    for (var i = 0; i < this.cpucount; i++) {
      var dtotal = this.gtop.xcpu_total[i] - this.cpulist_total[i];
      var dnice = this.gtop.xcpu_nice[i] - this.cpulist_nice[i];
      var didle = this.gtop.xcpu_idle[i] - this.cpulist_idle[i];
      var diowait = this.gtop.xcpu_iowait[i] - this.cpulist_iowait[i];

      var dsys = this.gtop.xcpu_sys[i] - this.cpulist_sys[i];
      var duser = this.gtop.xcpu_user[i] - this.cpulist_user[i];

      // and save the new values
      this.cpulist_total[i] = this.gtop.xcpu_total[i];
      this.cpulist_nice[i] = this.gtop.xcpu_nice[i];
      this.cpulist_idle[i] = this.gtop.xcpu_idle[i];
      this.cpulist_iowait[i] = this.gtop.xcpu_iowait[i];

      this.cpulist_sys[i] = this.gtop.xcpu_sys[i];
      this.cpulist_user[i] = this.gtop.xcpu_user[i];

      //Same way from gnome system monitor
      this.cpulist_usage[i] = (duser + dnice + dsys) / dtotal;
    }

    return this.cpulist_usage;
  },
  getCPUCount: function() {
    return this.cpucount;
  },
  //Name to be displayed for this data provider
  getName: function() {
    return _("CPU");
  },

  getTooltipString: function() {
    if (!this.isEnabled)
      return "";
    var tooltipstr = _("------------- CPU ------------") + "\n";
    //tooltipstr += _("CPU") + ": ";
    for (var i = 0; i < this.cpucount; i++) {
      let percentage = Math.round(100 * this.cpulist_usage[i], 2).toString();
      let title = (_('Core') + ' ' + i).toString();
      tooltipstr += lSpaced(title) + ':' + lSpaced(percentage, spaces/2) + " %\n";
    }
    return tooltipstr;
  }
};

function MemDataProvider() {
  this._init();
}
MemDataProvider.prototype = {

  _init: function() {
    this.isEnabled = true;
    this.gtopMem = new GTop.glibtop_mem();
    this.memusage = 0;
    this.memInfo = [0, 0, 0, 0];
  },

  getData: function() {
    GTop.glibtop_get_mem(this.gtopMem);
    ///*Old way to calc*/this.memusage = 1 - (this.gtopMem.buffer + this.gtopMem.cached + this.gtopMem.free) / this.gtopMem.total;
    //note: used + free= total
    //note: used = shared + buffer + cached + user + locked
    //note: available = (free + buffer + cached)
    //note: not available for usage = total - (free+buffer+cached) = used - buffer - cached;

    var unAvailableForUse = (this.gtopMem.used - this.gtopMem.buffer - this.gtopMem.cached) / this.gtopMem.total;
    var cached = this.gtopMem.cached / this.gtopMem.total;
    var buffer = this.gtopMem.buffer / this.gtopMem.total;
    var free = this.gtopMem.free / this.gtopMem.total;

    this.memInfo = [unAvailableForUse, cached, buffer, free]; //should add up to 1

    //return [this.memusage];
    return this.memInfo;
  },

  //Name to be displayed for this data provider
  getName: function() {
    return _("MEM");
  },

  getTooltipString: function() {
    if (!this.isEnabled)
      return "";
    var tooltipstr = _("----------- Memory -----------") + "\n";
    tooltipstr += lSpaced(_("Usedup:"), spaces+1) + lSpaced(Math.round(100 * this.memInfo[0]).toString(), spaces/2) + " %\n";
    tooltipstr += lSpaced(_("Cached:"), spaces+1) + lSpaced(Math.round(100 * this.memInfo[1]).toString(), spaces/2) + " %\n";
    tooltipstr += lSpaced(_("Buffer:"), spaces+1) + lSpaced(Math.round(100 * this.memInfo[2]).toString(), spaces/2) + " %\n";
    tooltipstr += lSpaced(_("Free:"),   spaces+1) + lSpaced(Math.round(100 * this.memInfo[3]).toString(), spaces/2) + " %\n";
    return tooltipstr;
  }
};

function SwapDataProvider() {
  this._init();
}
SwapDataProvider.prototype = {

  _init: function() {
    this.isEnabled = true;
    this.gtopSwap = new GTop.glibtop_swap();
    this.swapusage = 0;
    this.swapInfo = [0];
  },
  getData: function() {
    GTop.glibtop_get_swap(this.gtopSwap);
    var used = this.gtopSwap.used / this.gtopSwap.total;
    var free = this.gtopSwap.free / this.gtopSwap.total;

    this.swapInfo = [used];

    return this.swapInfo;
  },

  getName: function() {
    return _("SWAP");
  }, //Name to be displayed for this data provider
  getTooltipString: function() {
    if (!this.isEnabled)
      return "";
    var tooltipstr = _("------------ Swap ------------") + "\n";
    tooltipstr += lSpaced(_("Swap")) + ":" + lSpaced((Math.round(10000 * this.swapInfo[0]) / 100).toString(), spaces/2) + " %\n";
    return tooltipstr;
  }
};

function NetDataProvider() {
  this._init();
}
NetDataProvider.prototype = {
  _init: function() {
    this.isEnabled = true;

    this.gtop = new GTop.glibtop_netload();
    this.disabledDevices = [];

    this.currentReadingRates = [];

    var devices = this.getNetDevices();
    for (var dname in devices) {
      this.currentReadingRates[dname] = {
        down: 0,
        up: 0
      };
    }

    var d = new Date();
    this.lastupdatetime = d.getTime();

    this.currentReadings = this.getNetLoad();
  },
  getData: function() {
    var d = new Date();
    var newUpdateTime = d.getTime();
    var newReadings = this.getNetLoad();
    var readingNetRatesList = [];
    this.currentReadingRates = []; //reset so old devs dont appear in datastruct
    var secSinceLastUpdate = (newUpdateTime - this.lastupdatetime) / 1000;

    for (var dname in newReadings) {
      if (dname in this.currentReadings) {
        var currdevKBDownPerSec = Math.round(((newReadings[dname]["down"] - this.currentReadings[dname]["down"]) /
          secSinceLastUpdate) / 1024);
        var currdevKBUpPerSec = Math.round(((newReadings[dname]["up"] - this.currentReadings[dname]["up"]) /
          secSinceLastUpdate) / 1024);

        this.currentReadingRates[dname] = {
          down: currdevKBDownPerSec,
          up: currdevKBUpPerSec
        };

        readingNetRatesList.push(currdevKBDownPerSec);
        readingNetRatesList.push(currdevKBUpPerSec);
      } else {
        global.logError("new device: " + dname);
      }
    }

    this.currentReadings = newReadings;
    this.lastupdatetime = newUpdateTime;

    return readingNetRatesList;

  },
  getName: function() {
    return _("NET");
  },
  getNetLoad: function() {
    let down = 0;
    let up = 0;
    var readings = [];
    var devices = this.getNetDevices();
    for (var dname in devices) {
      GTop.glibtop.get_netload(this.gtop, dname);
      readings[dname] = {
        down: this.gtop.bytes_in,
        up: this.gtop.bytes_out
      };
    }

    return readings;

  },
  setDisabledInterfaces: function(disableddeviceslist) {
    this.disabledDevices = disableddeviceslist;
  },
  getNetDevices: function() {
    var nmclient = NMClient.Client.new();

    var devs = nmclient.get_devices();
    var devices = [];
    if (devs) //fix for when Network Manager is not being used thanks "volmonk"
    {
      for (var i = 0; i < devs.length; i++) {
        var dname = devs[i].get_iface();
        if (this.disabledDevices.indexOf(dname) == -1)
          devices[dname] = dname; //.push(dname);
      }
    }
    devices.sort(); //sort these really quick for displaying
    return devices;
  },
  getTooltipString: function() {
    if (!this.isEnabled)
      return "";

    var tooltipstr = _("---------- Networks ----------") + "\n";
    for (var dname in this.currentReadingRates) {
      tooltipstr += dname + "\n"
      + lSpaced(_("Down:"), spaces+1) + lSpaced(this.currentReadingRates[dname]["down"].toString(), spaces/2) + " " + _("(KiB/s)") + "\n" 
      + lSpaced(_("Up:"),   spaces+1) + lSpaced(this.currentReadingRates[dname]["up"].toString(),   spaces/2) + " " + _("(KiB/s)") + "\n";
    }
    return tooltipstr;
  }
};

function DiskDataProvider() {
  this._init();
}
DiskDataProvider.prototype = {

  _init: function() {
    this.isEnabled = true;
    this.disabledDevices = [];
    this.gtopFSusage = new GTop.glibtop_fsusage();

    var d = new Date();
    this.lastupdatetime = d.getTime();
    this.currentReadings = this.getDiskRW();

    this.currentReadingRates = [];
    var mountedDisks = this.getDiskDevices();
    for (var dname in mountedDisks)
      this.currentReadingRates[dname] = {
        read: 0,
        write: 0
      };
  },

  getData: function() {
    if (!this.isEnabled)
      return [];

    var d = new Date();
    var newUpdateTime = d.getTime();
    var newReadings = this.getDiskRW();

    var readingRatesList = [];
    this.currentReadingRates = []; //reset so old devs dont appear in datastruct
    var secSinceLastUpdate = (newUpdateTime - this.lastupdatetime) / 1000.0;

    for (var dname in newReadings) {
      var currdevRead = 0;
      var currdevWrite = 0;
      if (dname in this.currentReadings) //if we have old values (not just plugged in)
      {
        currdevRead = this.currentReadings[dname]["read"];
        currdevWrite = this.currentReadings[dname]["write"];
        var currdevMBReadPerSec = Math.round(((newReadings[dname]["read"] - currdevRead) / 1048576 /
          secSinceLastUpdate));
        var currdevMBWritePerSec = Math.round(((newReadings[dname]["write"] - currdevWrite) / 1048576 /
          secSinceLastUpdate));

        readingRatesList.push(currdevMBReadPerSec);
        readingRatesList.push(currdevMBWritePerSec);

        this.currentReadingRates[dname] = {
          read: currdevMBReadPerSec,
          write: currdevMBWritePerSec
        };
      } else {
        //new device was just plugged in
        //global.logError("new device: "+dname);
      }
    }

    this.currentReadings = newReadings;
    this.lastupdatetime = newUpdateTime;

    return readingRatesList;
  },

  getName: function() {
    return _("DISK");
  },

  getDiskRW: function() {
    var mountedDisks = this.getDiskDevices();
    var readings = [];

    for (var dname in mountedDisks) {
      GTop.glibtop.get_fsusage(this.gtopFSusage, mountedDisks[dname]);
      var r = this.gtopFSusage.read * this.gtopFSusage.block_size; //amt read in bytes
      var w = this.gtopFSusage.write * this.gtopFSusage.block_size; //amt written in bytes
      readings[dname] = {
        read: r,
        write: w
      };
    }

    return readings;
  },
  setDisabledDevices: function(disableddeviceslist) {
    this.disabledDevices = disableddeviceslist;
  },
  getTooltipString: function() {
    if (!this.isEnabled)
      return "";

    var tooltipstr = _("------------ Disks -----------") + "\n";
    for (var dname in this.currentReadingRates) {
      tooltipstr += dname + "\n"
      + lSpaced(_("Read:"),  spaces+1) + lSpaced(this.currentReadingRates[dname]["read"].toString(), spaces/2)  + " " + _("(MiB/s)") + "\n"
      + lSpaced(_("Write:"), spaces+1) + lSpaced(this.currentReadingRates[dname]["write"].toString(), spaces/2) + " " + _("(MiB/s)") + "\n";
    }
    return tooltipstr;
  },
  getDiskDevices: function() {
    //Annoying to get list of disks that are not net attached or cd/dvd's
    //There must be a simpler way
    //and libgtop's methods for this have been disabled for some reason.
    var volumeMonitor = Gio.VolumeMonitor.get();
    var vols = volumeMonitor.get_volumes();
    var volDirs = {};
    volDirs["/"] = "/"; //always here

    for (var i = 0; i < vols.length; i++) {
      var isDisk = true;
      var dname = vols[i].get_name();
      var mnt = vols[i].get_mount();

      if (mnt != null) {
        var drv = mnt.get_drive();
        if (drv != null)
          isDisk = !drv.is_media_removable();
        var mntroot = mnt.get_root();
        if (isDisk && this.disabledDevices.indexOf(dname) == -1) //device is enabled, and is a disk
          volDirs[dname] = mntroot.get_path();
      }

    }

    return volDirs;
  }

};
