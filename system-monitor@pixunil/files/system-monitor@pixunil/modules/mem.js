const _ = imports.applet._;
const Graph = imports.applet.graph;
const Modules = imports.applet.modules;

const name = "mem";
const display = _("Memory");
const additionalSettingKeys = ["panel-mode"];
const colorSettingKeys = ["mem", "swap"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_mem;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = {
            total: 1,
            used: 0,
            cached: 0,
            buffer: 0
        };

        this.history = {
            used: [],
            cached: [],
            buffer: []
        };
    },

    getData: function(){
        Modules.GTop.glibtop_get_mem(this.gtop);

        this.saveData("total", this.gtop.total);
        this.saveData("used", this.gtop.used - this.gtop.cached - this.gtop.buffer);
        this.saveData("cached", this.gtop.cached);
        this.saveData("buffer", this.gtop.buffer);
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [100, 100, 60],

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.addRow(_("cached"));
        this.addRow(_("buffered"));
    },

    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);


        this.setText(1, 0, "bytes", this.data.cached);
        this.setText(1, 2, "percent", this.data.cached, this.data.total);

        this.setText(2, 0, "bytes", this.data.buffer);
        this.setText(2, 2, "percent", this.data.buffer, this.data.total);
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.PanelLabelPrototype,

    main: {
        mem: /^(?:memory|mem|m)/i,
        swap: /^(?:swap|s)$/i
    },

    defaultSub: "used",
    sub: {
        used: /^(?:used|usedup|u)$/i,
        cached: /^(?:cached|c)$/i,
        buffer: /^(?:buffer|b)$/i,
        total: /^(?:total|t)$/i
    },

    formats: ["percent", "size"],

    mem: function(sub, format){
        if(format === "percent")
            return this.formatPercent(this.data[sub], this.data.total);

        return this.formatBytes(this.data[sub]);
    },

    swap: function(sub, format){
        if(format === "percent")
            return this.formatPercent(this.modules.swap.dataProvider.data[sub], this.modules.swap.dataProvider.data.total);

        return this.formatBytes(this.modules.swap.dataProvider.data[sub]);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    mode: "mem-swap",

    draw: function(){
        if(this.settings.memPanelMode === "mem")
            this.begin(1);
        else
            this.begin(2);

        this.next("mem");
        this.bar(this.data.used / this.data.total);

        this.setAlpha(.75);
        this.bar(this.data.cached / this.data.total);

        this.setAlpha(.5);
        this.bar(this.data.buffer / this.data.total);

        if(this.mode === "mem-swap"){
            this.next("swap");
            this.bar(this.modules.swap.dataProvider.data.used / this.modules.swap.dataProvider.data.total);
        }
    }
};

const historyGraphDisplay = _("Memory and Swap History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    mode: "mem-swap",

    draw: function(){
        let num = 1;

        if(this.mode === "mem-swap")
            num = 2;

        this.begin(num, this.history.used.length, this.data.total);

        this.next("mem");
        this.line(this.history.used);

        this.setAlpha(.75);
        this.line(this.history.cached);

        this.setAlpha(.5);
        this.line(this.history.buffer);

        if(this.mode === "mem-swap"){
            this.max = this.modules.swap.dataProvider.data.total;

            this.next("swap");
            this.line(this.modules.swap.dataProvider.history.used);
        }
    }
};
