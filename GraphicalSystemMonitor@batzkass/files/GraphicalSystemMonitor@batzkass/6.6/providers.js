const Gio = imports.gi.Gio;


var init = require('./init');
const _ = init._;
const GTop = init.GTop;

class Provider {
    constructor(refresh_rate){
        this.refresh_rate = refresh_rate
        this.text = "";
        this.short_text = "";
    }

    _set_prop(prop, value, callback = true) {
        // set value
        this[prop] = value
        // eventually call a callback
        if (callback && typeof this['on_set_'+prop] == 'function') {
            this['on_set_'+prop]();
        }
    }
    
    getText() {
        return [this.full_title, this.text];
    }

    getShortText() {
        return [this.short_title, this.short_text];
    }
}

class CpuData extends Provider {
    constructor(refresh_rate) {
        super(refresh_rate)
        this.gtop = new GTop.glibtop_cpu();
        this.idle_last = 0;
        this.nice_last = 0;
        this.sys_last = 0;
        this.iowait_last = 0;
        this.total_last = 0;
        this.full_title = _("CPU:");
        this.short_title = _("CPU");
        this.unity = _("%");
    }
    
    getDim() {
        return 4;
    }
    
    getData() {
        GTop.glibtop_get_cpu(this.gtop);
        var delta = (this.gtop.total - this.total_last);
        var idle = 0;
        var nice = 0;
        var sys = 0;
        var iowait = 0;
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
        var used = 1-idle-nice-sys-iowait;
        this.text = (100 * used).toFixed();
        this.short_text = this.text + this.unity
        this.text += ' '+this.unity
        // map below to avoid -0 sometimes
        return [used, nice, sys, iowait].map(v=>Math.max(0,v));
    }
}

class MemData extends Provider {
    constructor(refresh_rate) {
        super(refresh_rate)
        this.gtop = new GTop.glibtop_mem();
        this.full_title = _("Memory:");
        this.short_title = _("MEM");
        this.unity = _("GiB");
    }
    
    getDim() {
        return 2;
    }
    
    getData() {
        GTop.glibtop_get_mem(this.gtop);
        var used = this.gtop.used / this.gtop.total;
        var cached = (this.gtop.buffer + this.gtop.cached) / this.gtop.total;
        var val = (this.gtop.used - this.gtop.cached - this.gtop.buffer) / (1024 * 1024 * 1024)
        this.text = val.toFixed(1)+ " / " + (this.gtop.total / (1024 * 1024 * 1024)).toFixed(1) + ' ' + this.unity;
        this.short_text = Math.round(100*val/this.gtop.total*(1024 * 1024 * 1024))+'%'
        return [used-cached, cached];
    }
}

class SwapData extends Provider {
    constructor(refresh_rate) {
        super(refresh_rate)
        this.gtop = new GTop.glibtop_swap();
        this.full_title = _("Swap:");
        this.short_title = _("SW");
        this.unity = _("GiB");
    }
    
    getDim() {
        return 1;
    }
    
    getData() {
        GTop.glibtop_get_swap(this.gtop);
        var used = this.gtop.total > 0 ? (this.gtop.used / this.gtop.total) : 0;
        var val = this.gtop.used / (1024 * 1024 * 1024)
        this.text = val.toFixed(1) + " / " + (this.gtop.total / (1024 * 1024 * 1024)).toFixed(1) + ' ' + this.unity;
        this.short_text = Math.round(val/this.gtop.total*(1024 * 1024 * 1024)*100)+'%'
        return [used];
    }
}

class NetData extends Provider {
    constructor(refresh_rate) {
        super(refresh_rate)
        this.gtop = new GTop.glibtop_netload();
        this.full_title = _("Network:");
        this.short_title = _("NET");
        this.unity = _("KiB/s");
        this.high_unity = _("MiB/s")
        try {
            var nl = new GTop.glibtop_netlist();
            this.devices = GTop.glibtop.get_netlist(nl);
        }
        catch(e) {
            this.devices = [];
            var d = Gio.File.new_for_path("/sys/class/net");
            var en = d.enumerate_children_async("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            var info;
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
    }

    getDim() {
        return 2;
    }
    
    getData() {
        var [down, up] = this.getNetLoad();
        var down_delta = (down - this.down_last) * 1000 / this.refresh_rate;
        var up_delta = (up - this.up_last) * 1000 / this.refresh_rate;
        this.down_last = down;
        this.up_last = up;
        var d_down = Math.round(down_delta/1024)
        var d_up = Math.round(up_delta/1024)
        var unity = this.unity
        if (d_down+d_up>=1024) {
            unity = this.high_unity
            d_down = Math.round(d_down/1024)
            d_up = Math.round(d_up/1024)
        }
        this.text = "↓" + d_down + " / ↑" + d_up + ' ' + unity;
        this.short_text = "↓" + d_down + " ↑" + d_up + ' ' + unity;
        return [down_delta, up_delta];
    }

    getNetLoad() {
        var down = 0;
        var up = 0;
        for (var i = 0; i < this.devices.length; ++i)
        {
            GTop.glibtop.get_netload(this.gtop, this.devices[i]);
            down += this.gtop.bytes_in;
            up += this.gtop.bytes_out;
        }
        return [down, up];
    }
}

class LoadAvgData extends Provider {
    constructor(refresh_rate) {
        super(refresh_rate)
        this.gtop = new GTop.glibtop_loadavg();
        this.full_title = _("Load average:");
        this.short_title = _("LOAD");
    }

    getDim() {
        return 1;
    }
    
    getData() {
        GTop.glibtop_get_loadavg(this.gtop);
        var load = this.gtop.loadavg;
        // load = load.map(l=>l.toFixed(1))
        this.text = load[0].toFixed(2)
            + " | " + load[1].toFixed(2)
            + " | " + load[2].toFixed(2);
        this.short_text = load[0].toFixed(1)
            + "|" + load[1].toFixed(1)
            + "|" + load[2].toFixed(1);
        return [load[0]];
    }
    
    getText() {
        return [_("Load average:"), this.text];
    }
}
