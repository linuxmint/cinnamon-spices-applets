const Cinnamon = imports.gi.Cinnamon;

const _ = imports.applet._;
const Graph = imports.applet.graph;
const Modules = imports.applet.modules;

const name = "network";
const display = _("Network");
const colorSettingKeys = ["up", "down"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    max: 1,
    maxIndex: 0,

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_netload;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            up: 0,
            down: 0
        };

        this.data = {
            up: 0,
            down: 0
        };

        this.history = {
            up: [],
            down: []
        };

        this.dev = [];
        let r = Cinnamon.get_file_contents_utf8_sync("/proc/net/dev").split("\n"), s;

        for(var i = 2, l = r.length; i < l; ++i){
            s = r[i].match(/^\s*(\w+)/);
            if(s !== null){
                s = s[1];
                if(s === "lo") continue;
                this.dev.push(s);
            }
        }
    },

    getData: function(delta){
        let up = 0, down = 0;

        for(var i = 0, l = this.dev.length; i < l; ++i){
            Modules.GTop.glibtop_get_netload(this.gtop, this.dev[i]);
            up += this.gtop.bytes_out;
            down += this.gtop.bytes_in;
        }

        if(delta > 0 && this.raw.up > -1 && this.raw.down > -1){
            this.saveData("up", this.raw.up? (up - this.raw.up) / delta : 0);
            this.saveData("down", this.raw.down? (down - this.raw.down) / delta : 0);

            this.updateMinMax();
        }

        this.saveRaw("up", up);
        this.saveRaw("down", down);
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [130, 130],

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.addRow(_("Total"));
    },

    update: function(){
        this.setText(0, this.settings.order === "up-down"? 0 : 1, "rate", this.data.up, true);
        this.setText(0, this.settings.order === "down-up"? 0 : 1, "rate", this.data.down, false);

        this.setText(1, this.settings.order === "up-down"? 0 : 1, "bytes", this.raw.up);
        this.setText(1, this.settings.order === "down-up"? 0 : 1, "bytes", this.raw.down);
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.PanelLabelPrototype,

    main: {
        up: /^(?:up|u)$/i,
        down: /^(?:down|d)$/i
    },

    formats: ["rate", "total"],

    up: function(format){
        if(format === "rate")
            return this.formatRate(this.data.up);

        return this.formatBytes(this.raw.up);
    },

    down: function(format){
        if(format === "rate")
            return this.formatRate(this.data.down);

        return this.formatBytes(this.raw.down);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(2);

        this.next("up");
        this.bar(this.data.up / this.module.max);

        this.next("down");
        this.bar(this.data.down / this.module.max);
    }
};

const historyGraphDisplay = _("Network History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(2, this.history.up.length, this.module.max);

        this.next("up");
        this.line(this.history.up);

        this.next("down");
        this.line(this.history.down);
    }
};
