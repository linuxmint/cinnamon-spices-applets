const Gio = imports.gi.Gio;
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
        try {
            let nl = new GTop.glibtop_netlist();
            this.devices = GTop.glibtop.get_netlist(nl);
        }
        catch(e) {
            this.devices = [];
            let d = Gio.File.new_for_path("/sys/class/net");
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
        
        [this.down_last, this.up_last] = this.getNetLoad();
    },
    
    getDim: function() {
        return 2;
    },
    
    getData: function() {
        let [down, up] = this.getNetLoad();
        let down_delta = (down - this.down_last) * 1000 / this.refresh_rate;
        let up_delta = (up - this.up_last) * 1000 / this.refresh_rate;
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
        for (let i = 0; i < this.devices.length; ++i)
        {
            GTop.glibtop.get_netload(this.gtop, this.devices[i]);
            down += this.gtop.bytes_in;
            up += this.gtop.bytes_out;
        }
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
