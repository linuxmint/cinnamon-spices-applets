const Gio = imports.gi.Gio;
const St = imports.gi.St;

//
// Initialize GTop
//

let GTop;
try {
    GTop = imports.gi.GTop;
} catch (e) {
    let icon = new St.Icon({ icon_name: 'utilities-system-monitor',
                           icon_type: St.IconType.FULLCOLOR,
                           icon_size: 24 });
    Main.criticalNotify(_("Dependency missing"), _("Please install the GTop package\n" +
      "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
      "\tFedora: libgtop2-devel\n" +
      "\tArch: libgtop\n" +_(
			"to use the applet %s")).format(UUID), icon);
    gtopFailed = true;
}

// Class responsible for getting CPU data
class CpuDataProvider {
	constructor() {
        this.gtop = new GTop.glibtop_cpu();
        this.current = 0;
        this.last = 0;
        this.usage = 0;
        this.last_total = 0;
        this.last_delta = 0;
        this.name = _("CPU");
        this.type = "CPU";
    }

    getData() {
        GTop.glibtop_get_cpu(this.gtop);

        this.current = this.gtop.idle;

        let delta = this.gtop.total - this.last_total;
        //global.log("Moniteur: delta " + delta );
        if (delta < -50000) {
            delta = this.last_delta;
        }
        if (delta > 0) {
            this.usage = (this.current - this.last) / delta;
            this.last = this.current;
            this.last_total = this.gtop.total;
            this.last_delta = delta;
        }

        return 1 - this.usage;
    }
}

// Class responsible for getting memory data
class MemDataProvider {
    constructor () {
        this.gtopMem = new GTop.glibtop_mem();
        this.name = _("MEM");
        this.type = "MEM";
    }

    getData() {
        GTop.glibtop_get_mem(this.gtopMem);

        return 1 - (this.gtopMem.buffer + this.gtopMem.cached + this.gtopMem.free) / this.gtopMem.total;
    }
}

class NetDataProvider {
    // Code is pretty much a copy of the code written by
    // Josef Michálek (Aka Orcus) <0rcus.cz@gmail.com>
    // Credit goes to him for the NetDataProvider
    // called NetData in sysmonitor@orcus
    constructor(frequency, type_in, linlog) {
        if (type_in) {
            this.name = _("NETIN");
            this.type = "NETIN";
        }
        else {
            this.name = _("NETOUT");
            this.type = "NETOUT";
        }
        this.frequency = frequency;
        this.type_in = type_in;
        this.linlog = linlog;
        this.max_down = 0;
        this.max_up = 0;

        this.gtop = new GTop.glibtop_netload();
        try {
            // Get network devices from gtop
            let nl = new GTop.glibtop_netlist();
            this.devices = GTop.glibtop.get_netlist(nl);
        }
        catch(e) {
            // Get network devices from filesystem : /sys/class/net
            this.devices = [];
            let d = Gio.File.new_for_path("/sys/class/net");
            let en = d.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            while ((info = en.next_file(null)))
                this.devices.push(info.get_name())
        }
        // Don't measure loopback interface
        this.devices = this.devices.filter(v => v !== "lo"); 
        try {
            //Workaround, because string match() function throws an error for some reason if called after GTop.glibtop.get_netlist(). After the error is thrown, everything works fine.
            //If the match() would not be called here, the error would be thrown somewhere in Cinnamon applet init code and applet init would fail.
            //Error message: Could not locate glibtop_init_s: ‘glibtop_init_s’: /usr/lib64/libgtop-2.0.so.10: undefined symbol: glibtop_init_s
            //No idea why this error happens, but this workaround works.            
            "".match(/./);    
        }
        catch (e) {
        }
        
        // Retrieve initial net load data
        [this.down_last, this.up_last] = this.getNetLoad();
    }
    
    getData() {
        try {
            let [down, up] = this.getNetLoad();
            let down_delta = (down - this.down_last) / this.frequency;
            let up_delta = (up - this.up_last) / this.frequency;
            if (down_delta>this.max_down){
                this.max_down = down_delta;
                //global.log("DOWN: " + down_delta);
            }
            if (up_delta>this.max_up){
                this.max_up = up_delta;
                //global.log("UP  : " + up_delta);
            }
            this.down_last = down;
            this.up_last = up;
            // this.text_1 = Math.round(down_delta/1024) + _(" KB/s");
            // this.text_2 = Math.round(up_delta/1024) + _(" KB/s");
            if (this.type_in) {
                if (this.linlog=="lin")
                    return this.getLinearValue(down_delta, this.max_down);
                else
                    return this.getLogValue(down_delta, this.max_down);
            }
            else {
                if (this.linlog=="lin")
                    return this.getLinearValue(up_delta, this.max_up);
                else
                    return this.getLogValue(up_delta, this.max_up);
            }
        }
        catch (e) {
            global.logError("Exception in getData():" + e.message);
        }
    }

    getNetLoad() {
        try {
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
        catch (e) {
            global.logError("Exception in getNetLoad():" + e.message);
        }
    }

    getLinearValue(value, max) {
        if (max<=1 || value<=0)
            return 0;

        return value/max;
    }

    getLogValue(value, max) {
        if (max<1 || value<=0)
            return 0;

        return Math.log10(value + 1)/Math.log10(max + 1);
    }
};
