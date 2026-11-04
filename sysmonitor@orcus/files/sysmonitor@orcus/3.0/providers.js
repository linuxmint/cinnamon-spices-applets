const Gio = imports.gi.Gio;

const SYSFS_NET_PATH = "/sys/class/net";
const MS_PER_SECOND = 1000;
const AppletDir = imports.ui.appletManager.applets['sysmonitor@orcus'];
const GTop = AppletDir.__init__.GTop;
const _ = AppletDir.__init__._;

function CpuData() {
    this._init();
}

CpuData.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_cpu();
        this.idle_last = 0;
        this.nice_last = 0;
        this.sys_last = 0;
        this.iowait_last = 0;
        this.total_last = 0;
        this.text_decimals = 0;
    },
    
    getDim: function() {
        return 4;
    },
    
    getData: function() {
        GTop.glibtop_get_cpu(this.gtop);
        let delta = (this.gtop.total - this.total_last);
        let idle = 0;
        let nice = 0;
        let sys = 0;
        let iowait = 0;
        if (delta > 0) {
	        idle = (this.gtop.idle - this.idle_last) / delta;
	        nice = (this.gtop.nice - this.nice_last) / delta;
	        sys = (this.gtop.sys - this.sys_last) / delta;
	        iowait = (this.gtop.iowait - this.iowait_last) / delta;
        }
        this.idle_last = this.gtop.idle;
        this.nice_last = this.gtop.nice;
        this.sys_last = this.gtop.sys;
        this.iowait_last = this.gtop.iowait;
        this.total_last = this.gtop.total;
        let used = 1-idle-nice-sys-iowait;
        this.text = (100 * used).toFixed(this.text_decimals) + " %";
        return [used, nice, sys, iowait];
    },
    
    getText: function() {
        return [_("CPU:"), this.text];
    },

    setTextDecimals: function(decimals) {
        this.text_decimals = Math.max(0, decimals);
    }
};

function MemData() {
    this._init();
}

MemData.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_mem();
    },
    
    getDim: function() {
        return 2;
    },
    
    getData: function() {
        GTop.glibtop_get_mem(this.gtop);
        let used = this.gtop.used / this.gtop.total;
        let cached = (this.gtop.buffer + this.gtop.cached) / this.gtop.total;
        this.text = Math.round((this.gtop.used - this.gtop.cached - this.gtop.buffer) / (1024 * 1024))
            + " / " + Math.round(this.gtop.total / (1024 * 1024)) + _(" MB");
        return [used-cached, cached];
    },
    
    getText: function() {
        return [_("Memory:"), this.text];
    }
};

function SwapData() {
    this._init();
}

SwapData.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_swap();
    },
    
    getDim: function() {
        return 1;
    },
    
    getData: function() {
        GTop.glibtop_get_swap(this.gtop);
        let used = this.gtop.total > 0 ? (this.gtop.used / this.gtop.total) : 0;
        this.text = Math.round(this.gtop.used / (1024 * 1024))
            + " / " + Math.round(this.gtop.total / (1024 * 1024)) + _(" MB");
        return [used];
    },
    
    getText: function() {
        return [_("Swap:"), this.text];
    }
};

function NetData() {
    this._init();
}

NetData.prototype = {
    _init: function () {
        this.gtop = new GTop.glibtop_netload();
        this.rescan_interval = 0; //seconds, 0 = never rescan. Set by the applet from the "Rescan interval" setting
        this.last_scan = Date.now();
        this.scanDevices();
        [this.down_last, this.up_last] = this.getNetLoad();
    },

    //Builds this.devices from the interfaces that exist right now. Called once at startup and, if
    //enabled, periodically afterwards so interfaces added later (USB NICs, Docker bridges, VPNs)
    //are picked up. Interfaces that disappear are handled separately in getNetLoad().
    scanDevices: function () {
        try {
            let nl = new GTop.glibtop_netlist();
            this.devices = GTop.glibtop.get_netlist(nl);
        }
        catch(e) {
            this.devices = [];
            let d = Gio.File.new_for_path(SYSFS_NET_PATH);
            let en = d.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            while ((info = en.next_file(null)))
                this.devices.push(info.get_name())
        }
        this.devices = this.devices.filter(v => v !== "lo"); //don't measure loopback interface
        try {
            //Workaround, because string match() function throws an error for some reason if called after GTop.glibtop.get_netlist(). After the error is thrown, everything works fine.
            //If the match() would not be called here, the error would be thrown somewhere in Cinnamon applet init code and applet init would fail.
            //Error message: Could not locate glibtop_init_s: ‘glibtop_init_s’: /usr/lib64/libgtop-2.0.so.10: undefined symbol: glibtop_init_s
            //No idea why this error happens, but this workaround works.
            "".match(/./);  
        }
        catch (e) {
        }
        
    },
    
    getDim: function() {
        return 2;
    },
    
    getData: function() {
        if (this.rescan_interval > 0 && Date.now() - this.last_scan >= this.rescan_interval * MS_PER_SECOND) {
            this.scanDevices();
            this.last_scan = Date.now();
        }
        let prev_present = this.present_devices;
        let [down, up] = this.getNetLoad();
        let down_delta = (down - this.down_last) * 1000 / this.refresh_rate;
        let up_delta = (up - this.up_last) * 1000 / this.refresh_rate;
        //The totals are summed over all devices. If a device appeared or vanished since the last tick,
        //the sum jumps by that device's whole counter, which would show up as a bogus spike (or a
        //negative value). Report zero for this tick and re-baseline below instead.
        if (this.present_devices !== prev_present) {
            down_delta = 0;
            up_delta = 0;
        }
        this.down_last = down;
        this.up_last = up;
        this.text = Math.round(down_delta/1024) + " / " + Math.round(up_delta/1024) + _(" KB/s");
        return [down_delta, up_delta];
    },
    
    getText: function() {
        return [_("Network D/U:"), this.text];
    },

    getNetLoad: function() {
        let down = 0;
        let up = 0;
        let present = [];
        for (let i = 0; i < this.devices.length; ++i)
        {
            //Skip interfaces that have been removed since they were discovered (deleted Docker bridge,
            //unplugged USB NIC, ...). Querying libgtop for a missing interface fails and logs several
            //warnings per call, which floods ~/.xsession-errors at every refresh.
            let exists = true;
            try {
                Gio.File.new_for_path(SYSFS_NET_PATH + "/" + this.devices[i]).query_info("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            }
            catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                    throw e;
                exists = false;
            }
            if (!exists)
                continue;
            present.push(this.devices[i]);
            GTop.glibtop.get_netload(this.gtop, this.devices[i]);
            down += this.gtop.bytes_in;
            up += this.gtop.bytes_out;
        }
        this.present_devices = present.join(" "); //used by getData() to detect a changed device set
        return [down, up];
    }
};

function LoadAvgData() {
    return this._init();
}

LoadAvgData.prototype = {
    _init: function() {
        this.gtop = new GTop.glibtop_loadavg();
    },
    
    getDim: function() {
        return 1;
    },
    
    getData: function() {
        GTop.glibtop_get_loadavg(this.gtop);
        let load = this.gtop.loadavg[0];
        this.text = this.gtop.loadavg[0]
            + ", " + this.gtop.loadavg[1]
            + ", " + this.gtop.loadavg[2];
        return [load];
    },
    
    getText: function() {
        return [_("Load average:"), this.text];
    }
};
