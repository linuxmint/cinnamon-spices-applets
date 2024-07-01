const Gio = imports.gi.Gio;
const GIRepository = imports.gi.GIRepository;

let _, tryFn, GTop;
if (typeof require !== 'undefined') {
  let utils = require('./utils');
  _ = utils._;
  tryFn = utils.tryFn;
} else {
  const AppletDir = imports.ui.appletManager.applets['multicore-sys-monitor@ccadeptic23'];
  _ = AppletDir.utils._;
  tryFn = AppletDir.utils.tryFn;
}

let CONNECTED_STATE, NMClient_new;
const NM = imports.gi.NM;
CONNECTED_STATE = NM.DeviceState.ACTIVATED;
NMClient_new = NM.Client.new;

tryFn(function() {
  GTop = imports.gi.GTop;
});

const spaces = 12;

const formatBytes = (bytes, decimals=2)=>{
  if (bytes < 1) {
    return '0'.padStart(spaces/2 - 1) + '.00'.padEnd(spaces/2 - 1) + 'B'.padStart(3, ' ') + rate;
  }
  let k = 1000;
  let dm = decimals + 1 || 3;
  let sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.min(Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))), 8);
  let value;
  if (isNaN(i)) {
    i = 0;
    value = "0";
  } else {
    value = (bytes / Math.pow(k, i)).toPrecision(dm).toString();
  }
  let parts = value.split('.');
  let dec_part = (parts.length === 2) ? '.' + parts[1].toString().padEnd(2, '0') : '.00';
  return parts[0].padStart(spaces/2 - 1) + dec_part.padEnd(spaces/2 - 1) + sizes[i].padStart(3, ' ') + rate;
};

const indent = '    ';
const rate = _('/s');

function MultiCpuDataProvider() {
  this._init();
}
MultiCpuDataProvider.prototype = {

  _init: function() {
    this.name = _('CPU');
    this.isEnabled = true;
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

    this.getData(); //initialize the values from the first readding
  },
  getData: function() {
    GTop.glibtop_get_cpu(this.gtop);

    if (this.CPUCount <= 0) {
      for (let i = 0; i < this.gtop.xcpu_total.length; i++) {
        // there should be some activity for a cpu in use on a system. If so count it.
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

    // Copy gtop arrays, for some reason accessing them causes a continuous memory leak.
    let xcpu_total = this.gtop.xcpu_total.slice();
    let xcpu_nice = this.gtop.xcpu_nice.slice();
    let xcpu_sys = this.gtop.xcpu_sys.slice()
    let xcpu_user = this.gtop.xcpu_user.slice()
    // calculate ticks since last call
    for (let i = 0; i < this.CPUCount; i++) {
      let dtotal = xcpu_total[i] - this.CPUListTotal[i];
      let dnice = xcpu_nice[i] - this.CPUListNice[i];

      let dsys = xcpu_sys[i] - this.CPUListSys[i];
      let duser = xcpu_user[i] - this.CPUListUser[i];

      //Same way from gnome system monitor
      this.currentReadings[i] = (duser + dnice + dsys) / dtotal;
    }
    this.CPUListTotal = xcpu_total;
    this.CPUListNice = xcpu_nice;
    this.CPUListSys = xcpu_sys;
    this.CPUListUser = xcpu_user;
  },
  getCPUCount: function() {
    return this.CPUCount;
  },

  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('------------- CPU ------------') + '\n';
    for (let i = 0; i < this.CPUCount; i++) {
      let percentage = Math.round(100 * this.currentReadings[i], 2);
      toolTipString += (_('Core') + ' ' + i).padStart(spaces, ' ') + ':\t' + percentage.toString().padStart(2, ' ') + ' %\n';;
    }
    return toolTipString;
  }
};

function MemDataProvider() {
  this._init();
}
MemDataProvider.prototype = {

  _init: function() {
    this.name = _('MEM');
    this.isEnabled = true;
    this.gtopMem = new GTop.glibtop_mem();
    this.memusage = 0;
    this.currentReadings = [0, 0, 0, 0];
  },
  getData: function() {
    GTop.glibtop_get_mem(this.gtopMem);

    let unavailableForUse = (this.gtopMem.used - this.gtopMem.buffer - this.gtopMem.cached) / this.gtopMem.total;
    let cached = this.gtopMem.cached / this.gtopMem.total;
    let buffer = this.gtopMem.buffer / this.gtopMem.total;
    let free = this.gtopMem.free / this.gtopMem.total;

    this.currentReadings = [unavailableForUse, cached, buffer, free]; //should add up to 1
  },
  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('----------- Memory -----------') + '\n';
    let attributes = [_('Used:'), _('Cached:'), _('Buffer:'), _('Free:')];
    for (let i = 0; i < attributes.length; i++) {
      toolTipString += (attributes[i]).split(':')[0].padStart(spaces, ' ') + ':\t' + Math.round(100 * this.currentReadings[i]).toString().padStart(2, ' ') + ' %\n';
    }
    return toolTipString;
  }
};

function SwapDataProvider() {
  this._init();
}
SwapDataProvider.prototype = {

  _init: function() {
    this.name = _('SWAP');
    this.isEnabled = true;
    this.gtopSwap = new GTop.glibtop_swap();
    this.swapusage = true;
    this.currentReadings = [0];
  },
  getData: function() {
    GTop.glibtop_get_swap(this.gtopSwap);
    this.swapusage = parseInt(this.gtopSwap.total) !== 0;
    this.currentReadings[0] = this.gtopSwap.used / this.gtopSwap.total;
    // Check if swap is actually present
    if (isNaN(this.currentReadings)) {
      this.currentReadings = [0];
    }
  },
  getTooltipString: function() {
    //if (!this.isEnabled || !this.currentReadings[0]) { //Replaced by:
    if (!this.isEnabled || !this.swapusage) {
      return '';
    }
    let toolTipString = _('------------ Swap ------------') + '\n';
    toolTipString += _('Swap').padStart(spaces, ' ') + ':\t' + (Math.round(10000 * this.currentReadings[0]) / 100).toString().padStart(2, ' ') + ' %\n';
    return toolTipString;
  }
};

function NetDataProvider() {
  this._init();
}
NetDataProvider.prototype = {
  _init: function() {
    this.name = _('NET');
    this.isEnabled = true;
    this.gtop = new GTop.glibtop_netload();
    this.nmClient = NMClient_new(null);
    this.signals = [
      this.nmClient.connect('device-added', () => this.getNetDevices()),
      this.nmClient.connect('device-removed', () => this.getNetDevices())
    ];
    this.disabledDevices = [];
    this.currentReadings = [];
    this.lastUpdatedTime = Date.now();
    this.getNetDevices(true);
    this.getNetActivity();
  },
  getData: function() {
    this.getNetActivity();

    const newUpdateTime = Date.now();
    const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;

    for (let i = 0, len = this.currentReadings.length; i < len; i++) {
      this.currentReadings[i].tooltipDown = Math.round(
        ((this.currentReadings[i].down - this.currentReadings[i].lastReading[0]) / secondsSinceLastUpdate)
      );
      this.currentReadings[i].tooltipUp = Math.round(
        ((this.currentReadings[i].up - this.currentReadings[i].lastReading[1]) / secondsSinceLastUpdate)
      );

      this.currentReadings[i].lastReading[0] = this.currentReadings[i].down;
      this.currentReadings[i].lastReading[1] = this.currentReadings[i].up;

      this.currentReadings[i].readingRatesList[0] = Math.round(this.currentReadings[i].tooltipDown / 1024);
      this.currentReadings[i].readingRatesList[1] = Math.round(this.currentReadings[i].tooltipUp / 1024);
    }

    this.lastUpdatedTime = newUpdateTime;

  },
  setDisabledInterfaces: function(disabledDevicesList) {
    this.disabledDevices = disabledDevicesList;
    this.getNetDevices();
  },
  getNetActivity: function() {
    for (let i = 0; i < this.currentReadings.length; i++) {
      GTop.glibtop_get_netload(this.gtop, this.currentReadings[i].id);
      this.currentReadings[i].up = this.gtop.bytes_out;
      this.currentReadings[i].down = this.gtop.bytes_in;
    }
  },
  getNetDevices: function(init = false) {
    this.currentReadings = [];

    let devices = GTop.glibtop_get_netlist(new GTop.glibtop_netlist());
    let altMethod = devices == null;
    if (altMethod) {
      devices = this.nmClient.get_devices();
    }
    for (let i = 0, len = devices.length; i < len; i++) {
      if (altMethod) {
        if (devices[i].state !== CONNECTED_STATE) {
          continue;
        }
        devices[i] = devices[i].get_iface();
      }
      if (this.disabledDevices.indexOf(devices[i]) === -1) {
        GTop.glibtop_get_netload(this.gtop, devices[i]);
        this.currentReadings.push({
          id: devices[i],
          up: init ? 0 : this.gtop.bytes_out,
          down: init ? 0 : this.gtop.bytes_in,
          tooltipUp: 0,
          tooltipDown: 0,
          lastReading: [0, 0],
          readingRatesList: []
        });
      }
    }
    devices = null;
  },
  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('---------- Networks ----------') + '\n';
    for (let i = 0, len = this.currentReadings.length; i < len; i++) {
      if (!this.currentReadings[i].tooltipDown) {
        this.currentReadings[i].tooltipDown = 0;
      }
      if (!this.currentReadings[i].tooltipUp) {
        this.currentReadings[i].tooltipUp = 0;
      }
      let down = formatBytes(this.currentReadings[i].tooltipDown, 2);
      let up = formatBytes(this.currentReadings[i].tooltipUp, 2);
      toolTipString += this.currentReadings[i].id.padEnd(22) + '\n';
      toolTipString += _('Down:').split(':')[0].padStart(spaces, ' ') + ':' + down.padStart(spaces + 2) + '\n';
      toolTipString += _('Up:').split(':')[0].padStart(spaces, ' ') + ':'  + up.padStart(spaces + 2) + '\n';
    }
    return toolTipString;
  },
  destroy: function() {
    for (let i = 0; i < this.signals.length; i++) {
      this.nmClient.disconnect(this.signals[i]);
    }
  }
};

function DiskDataProvider() {
  this._init();
}
DiskDataProvider.prototype = {
  _init: function() {
    this.name = _('DISK');
    this.isEnabled = true;
    this.disabledDevices = [];
    this.currentReadings = [];
    this.lastUpdatedTime = Date.now();
    this.gtopFSUsage = new GTop.glibtop_fsusage();
    this.volumeMonitor = Gio.VolumeMonitor.get();
    this.signals = [
      this.volumeMonitor.connect('drive-changed', () => this.getDiskDevices()),
      this.volumeMonitor.connect('drive-connected', () => this.getDiskDevices()),
      this.volumeMonitor.connect('drive-disconnected', () => this.getDiskDevices()),
      this.volumeMonitor.connect('mount-added', () => this.getDiskDevices()),
      this.volumeMonitor.connect('mount-changed', () => this.getDiskDevices()),
      this.volumeMonitor.connect('mount-removed', () => this.getDiskDevices()),
      this.volumeMonitor.connect('volume-added', () => this.getDiskDevices()),
      this.volumeMonitor.connect('volume-changed', () => this.getDiskDevices()),
      this.volumeMonitor.connect('volume-removed', () => this.getDiskDevices())
    ];
    this.mounts = this.volumeMonitor.get_mounts();
    this.getDiskDevices();
    this.getDiskRW();
  },
  getData: function() {
    if (!this.isEnabled) {
      return [];
    }

    this.getDiskRW();

    let newUpdateTime = Date.now();
    let secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000.0;
    this.lastUpdatedTime = newUpdateTime;

    for (let i = 0, len = this.currentReadings.length; i < len; i++) {
      const newRead = this.currentReadings[i].read - this.currentReadings[i].lastReading[0];
      const newWrite = this.currentReadings[i].write - this.currentReadings[i].lastReading[1];
      this.currentReadings[i].lastReading[0] = this.currentReadings[i].read;
      this.currentReadings[i].lastReading[1] = this.currentReadings[i].write;

      this.currentReadings[i].tooltipRead = Math.round((newRead / secondsSinceLastUpdate));
      this.currentReadings[i].tooltipWrite = Math.round((newWrite / secondsSinceLastUpdate));
      // Push it to the array read by the graphs as kilobytes.
      this.currentReadings[i].readingRatesList[0] = Math.round((newRead / 1048576 / secondsSinceLastUpdate));
      this.currentReadings[i].readingRatesList[1] = Math.round((newWrite / 1048576 / secondsSinceLastUpdate));
    }
  },
  getDiskRW: function() {
    for (let i = 0; i < this.currentReadings.length; i++) {
      GTop.glibtop_get_fsusage(this.gtopFSUsage, this.currentReadings[i].path);
      this.currentReadings[i].read = this.gtopFSUsage.read * this.gtopFSUsage.block_size;
      this.currentReadings[i].write = this.gtopFSUsage.write * this.gtopFSUsage.block_size;
    }
  },
  setDisabledDevices: function(disabledDevicesList) {
    this.disabledDevices = disabledDevicesList;
    this.getDiskDevices();
  },
  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('------------ Disks -----------') + '\n';
    for (let i = 0, len = this.currentReadings.length; i < len; i++) {
      if (!this.currentReadings[i]) {
        continue;
      }
      let read = formatBytes(this.currentReadings[i].tooltipRead, 2);
      let write = formatBytes(this.currentReadings[i].tooltipWrite, 2);
      toolTipString += this.currentReadings[i].id.padEnd(22) + '\n';
      toolTipString += _('Read:').split(':')[0].padStart(spaces, ' ') + ':' + read.padStart(spaces + 2) + '\n';
      toolTipString += _('Write:').split(':')[0].padStart(spaces, ' ') + ':' + write.padStart(spaces + 2) + '\n';
    }
    return toolTipString;
  },
  getDiskDevices: function() {
    this.currentReadings = [{
      id: '/',
      path: '/',
      read: 0,
      write: 0,
      lastReading: [0, 0],
      readingRatesList: []
    }];

    for (let i = 0; i < this.mounts.length; i++) {
      if (!this.mounts[i]) {
        continue;
      }
      let deviceName = this.mounts[i].get_name();
      let drive = this.mounts[i].get_drive();
      let isDisk =  drive && !drive.is_media_removable()
      let mountRoot = this.mounts[i].get_root();
      // device is enabled, and is a disk
      if (isDisk && this.disabledDevices.indexOf(deviceName) === -1) {
        this.currentReadings.push({
          id: deviceName,
          path: mountRoot.get_path(),
          read: 0,
          write: 0,
          lastReading: [0, 0],
          readingRatesList: []
        });
      }

    }
  },
  destroy: function() {
    for (let i = 0; i < this.signals.length; i++) {
      this.volumeMonitor.disconnect(this.signals[i]);
    }
  }
};
