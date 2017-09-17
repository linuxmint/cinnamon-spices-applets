const GTop = imports.gi.GTop;
const NMClient = imports.gi.NMClient;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = 'multicore-sys-monitor@ccadeptic23';
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale')

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const findDeviceById = function(deviceIdToFind, collection) {
  return collection.findIndex(device => device.id === deviceIdToFind);
};

const formatBytes = (bytes, decimals)=>{
  if (bytes === 0) {
    return '0 Byte';
  }
  let k = 1000;
  let dm = decimals + 1 || 3;
  let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toPrecision(dm) + ' ' + sizes[i];
};

const indent = '    ';
const rate = _('/s');
const spaces = 12;

function MultiCpuDataProvider() {
  this._init();
}
MultiCpuDataProvider.prototype = {

  _init: function() {
    this.isEnabled = true;
    this.gtop = new GTop.glibtop_cpu();
    this.CPUCount = 0;

    this.current = 0;
    this.last = 0;
    this.usage = 0;
    this.last_total = 0;

    this.CPUListTotal = [];
    this.CPUListNice = [];
    this.CPUListIdle = [];
    this.cpulist_iowait = [];

    this.CPUListSys = [];
    this.CPUListUser = [];

    this.CPUListUsage = [];

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
          this.CPUListIdle[this.CPUCount] = 0;
          this.cpulist_iowait[this.CPUCount] = 0;

          this.CPUListSys[this.CPUCount] = 0;
          this.CPUListUser[this.CPUCount] = 0;

          this.CPUListUsage[this.CPUCount] = 0;
          this.CPUCount++;
        }
      }
    }

    // calculate ticks since last call
    for (let i = 0; i < this.CPUCount; i++) {
      let dtotal = this.gtop.xcpu_total[i] - this.CPUListTotal[i];
      let dnice = this.gtop.xcpu_nice[i] - this.CPUListNice[i];

      let dsys = this.gtop.xcpu_sys[i] - this.CPUListSys[i];
      let duser = this.gtop.xcpu_user[i] - this.CPUListUser[i];

      // and save the new values
      this.CPUListTotal[i] = this.gtop.xcpu_total[i];
      this.CPUListNice[i] = this.gtop.xcpu_nice[i];
      this.CPUListIdle[i] = this.gtop.xcpu_idle[i];
      this.cpulist_iowait[i] = this.gtop.xcpu_iowait[i];

      this.CPUListSys[i] = this.gtop.xcpu_sys[i];
      this.CPUListUser[i] = this.gtop.xcpu_user[i];

      //Same way from gnome system monitor
      this.CPUListUsage[i] = (duser + dnice + dsys) / dtotal;
    }

    return this.CPUListUsage;
  },
  getCPUCount: function() {
    return this.CPUCount;
  },

  getName: function() {
    return _('CPU');
  },

  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('------- CPU -------') + '\n';
    for (let i = 0; i < this.CPUCount; i++) {
      let percentage = Math.round(100 * this.CPUListUsage[i], 2);
      let spacer = (percentage < 10 ? '     ' : '   ');
      toolTipString += (_('Core') + ' ' + i + ':').padEnd(12) + percentage + '%\n';;
    }
    return toolTipString;
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

    let unavailableForUse = (this.gtopMem.used - this.gtopMem.buffer - this.gtopMem.cached) / this.gtopMem.total;
    let cached = this.gtopMem.cached / this.gtopMem.total;
    let buffer = this.gtopMem.buffer / this.gtopMem.total;
    let free = this.gtopMem.free / this.gtopMem.total;

    this.memInfo = [unavailableForUse, cached, buffer, free]; //should add up to 1

    return this.memInfo;
  },
  getName: function() {
    return _('MEM');
  },
  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('------- Memory -------') + '\n';
    let attributes = [_('Used:'), _('Cached:'), _('Buffer:'), _('Free:')];
    for (let i = 0; i < attributes.length; i++) {
      toolTipString += attributes[i] + '\t' + Math.round(100 * this.memInfo[i]) + '%\n';
    }
    return toolTipString;
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
    this.swapInfo = [this.gtopSwap.used / this.gtopSwap.total];
    // Check if swap is actually present
    if (isNaN(this.swapInfo)) {
      return [0];
    }
    return this.swapInfo;
  },
  getName: function() {
    return _('SWAP');
  },
  getTooltipString: function() {
    if (!this.isEnabled || !this.swapInfo[0]) {
      return '';
    }
    let toolTipString = _('------- Swap -------') + '\n';
    toolTipString += _('Swap') + ':\t' + (Math.round(10000 * this.swapInfo[0]) / 100) + '%\n';
    return toolTipString;
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
    this.lastUpdatedTime = Date.now();
    this.currentReadings = this.getNetDevices(true);
  },
  getData: function() {
    const newReadings = this.getNetDevices();
    let readingNetRatesList = [];

    const newUpdateTime = Date.now();
    const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;
    this.lastUpdatedTime = newUpdateTime;

    for (let i = 0, len = newReadings.length; i < len; i++) {
      const refCurrentReading = findDeviceById(newReadings[i].id, this.currentReadings);
      if (refCurrentReading === -1) {
        continue;
      }
      const currentReading = this.currentReadings[refCurrentReading];
      newReadings[i].tooltipDown = Math.round(((newReadings[i].down - currentReading.down) / secondsSinceLastUpdate));
      newReadings[i].tooltipUp = Math.round(((newReadings[i].up - currentReading.up) / secondsSinceLastUpdate));
      readingNetRatesList.push(newReadings[i].tooltipDown / 1024, newReadings[i].tooltipUp / 1024)
    }

    this.currentReadings = newReadings;
    return readingNetRatesList;
  },
  getName: function() {
    return _('NET');
  },
  setDisabledInterfaces: function(disabledDevicesList) {
    this.disabledDevices = disabledDevicesList;
  },
  getNetDevices: function(init = false) {
    let nmClient = NMClient.Client.new();
    let devices = nmClient.get_devices();
    let removedDeviceIndexes = [];
    if (!devices) {
      nmClient = undefined;
      devices = GTop.glibtop_get_netlist(new GTop.glibtop_netlist());
    }
    for (let i = 0, len = devices.length; i < len; i++) {
      if (nmClient) {
        devices[i] = devices[i].get_iface();
      }
      GTop.glibtop_get_netload(this.gtop, devices[i]);
      devices[i] = {
        id: devices[i],
        up: init ? 0 : this.gtop.bytes_in,
        down: init ? 0 : this.gtop.bytes_out
      };
      if (this.disabledDevices.indexOf(devices[i]) > -1) {
        removedDeviceIndexes.push(i);
      }
    }
    for (let i = 0, len = removedDeviceIndexes.length; i < len; i++) {
      devices[removedDeviceIndexes[i]] = undefined;
      devices.splice(removedDeviceIndexes[i], 1);
    }
    return devices;
  },
  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    this.getData();
    let toolTipString = _('------- Networks -------') + '\n';
    for (let i = 0, len = this.currentReadings.length; i < len; i++) {
      let down = formatBytes(this.currentReadings[i].tooltipUp, 2);
      let up = formatBytes(this.currentReadings[i].tooltipDown, 2);
      toolTipString += this.currentReadings[i].id.padEnd(22) + '\n';
      toolTipString += indent + _('Down:') + '' + down.padStart(spaces) + rate + '\n';
      toolTipString += indent  + _('Up:') + '   ' + up.padStart(spaces) + rate + '\n';
    }
    return toolTipString;
  }
};

function DiskDataProvider() {
  this._init();
}
DiskDataProvider.prototype = {
  _init: function() {
    this.isEnabled = true;
    this.disabledDevices = [];
    this.gtopFSUsage = new GTop.glibtop_fsusage();
    this.lastUpdatedTime = Date.now();
    this.currentReadings = this.getDiskRW();
  },
  getData: function() {
    if (!this.isEnabled) {
      return [];
    }

    let newReadings = this.getDiskRW();
    let readingRatesList = [];

    let newUpdateTime = Date.now();
    let secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000.0;
    this.lastUpdatedTime = newUpdateTime;

    for (let i = 0, len = newReadings.length; i < len; i++) {
      const refCurrentReading = findDeviceById(newReadings[i].id, this.currentReadings);
      if (refCurrentReading === -1) {
        continue;
      }
      const currentReading = this.currentReadings[refCurrentReading];
      const newRead = newReadings[i].read - currentReading.read;
      const newWrite = newReadings[i].write - currentReading.write;
      newReadings[i].tooltipRead = Math.round((newRead / secondsSinceLastUpdate));
      newReadings[i].tooltipWrite = Math.round((newWrite / secondsSinceLastUpdate));
      // Push it to the array read by the graphs as kilobytes.
      readingRatesList.push(
        Math.round((newRead / 1048576 / secondsSinceLastUpdate)),
        Math.round((newWrite / 1048576 / secondsSinceLastUpdate))
      );
    }

    this.currentReadings = newReadings;
    return readingRatesList;
  },
  getName: function() {
    return _('DISK');
  },
  getDiskRW: function() {
    let mountedDisks = this.getDiskDevices();
    for (let i = 0; i < mountedDisks.length; i++) {
      GTop.glibtop_get_fsusage(this.gtopFSUsage, mountedDisks[i].path);
      mountedDisks[i].read = this.gtopFSUsage.read * this.gtopFSUsage.block_size;
      mountedDisks[i].write = this.gtopFSUsage.write * this.gtopFSUsage.block_size;
    }
    return mountedDisks;
  },
  setDisabledDevices: function(disabledDevicesList) {
    this.disabledDevices = disabledDevicesList;
  },
  getTooltipString: function() {
    if (!this.isEnabled) {
      return '';
    }
    let toolTipString = _('------- Disks -------') + '\n';
    for (let i = 0, len = this.currentReadings.length; i < len; i++) {
      let read = formatBytes(this.currentReadings[i].tooltipRead, 2);
      let write = formatBytes(this.currentReadings[i].tooltipWrite, 2);
      toolTipString += this.currentReadings[i].id.padEnd(22) + '\n';
      toolTipString += indent + _('Read:') + read.padStart(spaces) + rate + '\n';
      toolTipString += indent  + _('Write:') + write.padStart(spaces) + rate + '\n';
    }
    return toolTipString;
  },
  getDiskDevices: function() {
    let volumeMonitor = Gio.VolumeMonitor.get();
    let volumes = volumeMonitor.get_volumes();
    let mountedDisks = [{
      id: '/',
      path: '/',
      read: 0,
      write: 0
    }];

    for (let i = 0; i < volumes.length; i++) {
      let isDisk = true;
      let deviceName = volumes[i].get_name();
      let mount = volumes[i].get_mount();

      if (mount != null) {
        let drive = mount.get_drive();
        if (drive != null) {
          isDisk = !drive.is_media_removable();
        }
        let mountRoot = mount.get_root();
        // device is enabled, and is a disk
        if (isDisk && this.disabledDevices.indexOf(deviceName) === -1) {
          mountedDisks.push({
            id: deviceName,
            path: mountRoot.get_path(),
            read: 0,
            write: 0
          });
        }
      }
    }

    return mountedDisks;
  }
};
