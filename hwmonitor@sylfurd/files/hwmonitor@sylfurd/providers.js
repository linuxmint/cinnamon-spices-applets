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
