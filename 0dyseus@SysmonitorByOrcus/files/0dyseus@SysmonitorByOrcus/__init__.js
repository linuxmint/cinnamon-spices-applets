const AppletUUID = "0dyseus@SysmonitorByOrcus";
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

let GTop,
    NMClient;

try {
    GTop = imports.gi.GTop;
} catch (aErr) {
    GTop = null;
}

try {
    NMClient = imports.gi.NMClient;
} catch (aErr) {
    NMClient = null;
}

Gettext.bindtextdomain(AppletUUID, GLib.get_home_dir() + "/.local/share/locale");

function _(aStr) {
    let customTrans = Gettext.dgettext(AppletUUID, aStr);

    if (customTrans !== aStr && aStr !== "")
        return customTrans;

    return Gettext.gettext(aStr);
}

function Graph(aArea, aProvider, aColors, aBackground, aBorder) {
    this._init(aArea, aProvider, aColors, aBackground, aBorder);
}

Graph.prototype = {
    _init: function(aArea, aProvider, aColors, aBackground, aBorder) {
        this.area = aArea;
        this.provider = aProvider;
        this.colors = aColors;
        this.background = aBackground;
        this.border = aBorder;
        this.smooth = false;
        let datasize = this.area.get_width() - 2;
        this.data = new Array(datasize);
        this.dim = this.provider.getDim();
        this.autoScale = false;
        this.scale = 1;

        let i = 0,
            iLen = this.data.length;
        for (; i < iLen; ++i) {
            this.data[i] = new Array(this.dim);
            for (let j = 0; j < this.data[i].length; ++j)
                this.data[i][j] = 0;
        }
    },

    refresh: function() {
        let d = this.provider.getData();
        this.data.push(d);
        this.data.shift();
        this.area.queue_repaint();

        if (this.autoScale) {
            let maxVal = this.minScale;
            let i = 0,
                iLen = this.data.length;
            for (; i < iLen; ++i) {
                let sum = this.dataSum(i, this.dim - 1);
                if (sum > maxVal)
                    maxVal = sum;
            }
            this.scale = 1.0 / maxVal;
        }
    },

    dataSum: function(aIndex, aDepth) {
        let sum = 0;
        for (let j = 0; j <= aDepth; ++j)
            sum += this.data[aIndex][j];
        return sum;
    },

    paint: function() {
        let cr = this.area.get_context();
        let [width, height] = this.area.get_size();
        //background
        if (this.background !== null) {
            cr.setSourceRGBA(this.background[0], this.background[1], this.background[2],
                this.background[3]);
            cr.setLineWidth(1);
            cr.rectangle(0.5, 0.5, width - 1, height - 1);
            cr.fill();
        }
        //data
        if (this.smooth) {
            for (let j = this.dim - 1; j >= 0; --j) {
                cr.translate(0, 0);
                cr.moveTo(1.5, height);
                this.setColor(cr, j);
                let i = 0,
                    iLen = this.data.length;
                for (; i < iLen; ++i)
                    cr.lineTo(i + 1.5, height - Math.round((height - 1) *
                        this.scale * this.dataSum(i, j)));
                cr.lineTo(width - 1.5, height);
                cr.lineTo(1.5, height);
                cr.fillPreserve();
                cr.stroke();
            }
        } else {
            let i = 0,
                iLen = this.data.length;
            for (; i < iLen; ++i) {
                for (let j = this.dim - 1; j >= 0; --j) {
                    this.setColor(cr, j);
                    cr.moveTo(i + 1.5, height - 1);
                    cr.relLineTo(0, -Math.round((height - 2) * this.scale * this.dataSum(i, j)));
                    cr.stroke();
                }
            }
        }
        //border
        if (this.border !== null) {
            cr.setSourceRGBA(this.border[0], this.border[1], this.border[2], this.border[3]);
            cr.rectangle(0.5, 0.5, width - 1, height - 1);
            cr.stroke();
        }
    },

    setColor: function(aCtx, aIndex) {
        let c = this.colors[aIndex % this.colors.length];
        aCtx.setSourceRGBA(c[0], c[1], c[2], c[3]);
    },

    setAutoScale: function(aMinScale) {
        if (aMinScale > 0) {
            this.autoScale = true;
            this.minScale = aMinScale;
        } else {
            this.autoScale = false;
        }
    }
};

function CpuDataProvider() {
    this._init();
}

CpuDataProvider.prototype = {
    hasError: false,

    _init: function() {
        try {
            this.gtop = new GTop.glibtop_cpu();
            this.idle_last = 0;
            this.nice_last = 0;
            this.sys_last = 0;
            this.iowait_last = 0;
            this.total_last = 0;
        } catch (aErr) {
            this.hasError = true;
            global.logError(aErr);
        }
    },

    getDim: function() {
        return 3;
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
        let used = 1 - idle - nice - sys - iowait;
        this.text = [_("CPU:") + " ", Math.round(100 * used) + " %"];
        return [used, nice, sys, iowait];
    },

    getText: function() {
        return this.text;
    }
};

function MemDataProvider() {
    this._init();
}

MemDataProvider.prototype = {
    hasError: false,

    _init: function() {
        try {
            this.gtop = new GTop.glibtop_mem();
        } catch (aErr) {
            this.hasError = true;
            global.logError(aErr);
        }
    },

    getDim: function() {
        return 2;
    },

    getData: function() {
        GTop.glibtop_get_mem(this.gtop);
        let used = this.gtop.used / this.gtop.total;
        let cached = (this.gtop.buffer + this.gtop.cached) / this.gtop.total;
        this.text = [_("Memory:") + " ", Math.round((this.gtop.used - this.gtop.cached - this.gtop.buffer) /
            // TO TRANSLATORS: Don't know if this would need translation.
            // MB = Megabytes.
            (1024 * 1024)) + " / " + Math.round(this.gtop.total / (1024 * 1024)) + " " + _("MB")];
        return [used - cached, cached];
    },

    getText: function() {
        return this.text;
    }
};

function SwapDataProvider() {
    this._init();
}

SwapDataProvider.prototype = {
    hasError: false,

    _init: function() {
        try {
            this.gtop = new GTop.glibtop_swap();
        } catch (aErr) {
            this.hasError = true;
            global.logError(aErr);
        }
    },

    getDim: function() {
        return 1;
    },

    getData: function() {
        GTop.glibtop_get_swap(this.gtop);
        let used = this.gtop.used / this.gtop.total;
        this.text = [_("Swap:") + " ", Math.round(this.gtop.used / (1024 * 1024)) + " / " +
            // TO TRANSLATORS: Don't know if this would need translation.
            // MB = Megabytes.
            Math.round(this.gtop.total / (1024 * 1024)) + " " + _("MB")
        ];
        return [used];
    },

    getText: function() {
        return this.text;
    }
};

function NetDataProvider() {
    this._init();
}

NetDataProvider.prototype = {
    hasError: false,

    _init: function() {
        this.devices = [];

        try {
            this.gtop = new GTop.glibtop_netload();

            try {
                this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist());
            } catch (aErr) {
                if (!NMClient) {
                    this.hasError = true;
                    return;
                }

                let dev = NMClient.Client.new().get_devices();
                for (let i = 0; i < dev.length; ++i)
                    this.devices.push(dev[i].get_iface());
            } finally {
                if (this.devices && this.devices.length > 1)
                    [this.down_last, this.up_last] = this.getNetLoad();
            }
        } catch (aErr) {
            this.hasError = true;
            global.logError(aErr);
        }
    },

    getDim: function() {
        return 2;
    },

    getData: function() {
        let [down, up] = this.getNetLoad();
        let down_delta = (down - this.down_last) * 1000 / this.refreshRate;
        let up_delta = (up - this.up_last) * 1000 / this.refreshRate;
        this.down_last = down;
        this.up_last = up;
        // TO TRANSLATORS:
        // D = Download
        // U = Upload
        this.text = [_("Network D/U:") + " ", Math.round(down_delta / 1024) + " / " +
            // TO TRANSLATORS: Don't know if this would need translation.
            // KB/s = Kilobytes per second.
            Math.round(up_delta / 1024) + " " + _("KB/s")
        ];
        return [down_delta, up_delta];
    },

    getText: function() {
        return this.text;
    },

    getNetLoad: function() {
        let down = 0;
        let up = 0;
        let i = 0,
            iLen = this.devices.length;
        for (; i < iLen; ++i) {
            GTop.glibtop.get_netload(this.gtop, this.devices[i]);
            down += this.gtop.bytes_in;
            up += this.gtop.bytes_out;
        }
        return [down, up];
    }
};

function LoadAvgDataProvider() {
    return this._init();
}

LoadAvgDataProvider.prototype = {
    hasError: false,

    _init: function() {
        try {
            this.gtop = new GTop.glibtop_loadavg();
        } catch (aErr) {
            this.hasError = true;
            global.logError(aErr);
        }
    },

    getDim: function() {
        return 1;
    },

    getData: function() {
        GTop.glibtop_get_loadavg(this.gtop);
        let load = this.gtop.loadavg[0];
        this.text = [_("Load average:") + " ", this.gtop.loadavg[0] + ", " + this.gtop.loadavg[1] +
            ", " + this.gtop.loadavg[2]
        ];
        return [load];
    },

    getText: function() {
        return this.text;
    }
};
