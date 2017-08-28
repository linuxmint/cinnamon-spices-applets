const uuid = "system-monitor@pixunil";
const applet = imports.ui.appletManager.applets[uuid];

const _ = applet._;
const Graph = applet.graph;
const Modules = applet.modules;

const name = "cpu";
const display = _("CPU");
const additionalSettingKeys = ["split", "warning", "warning-time", "warning-mode", "warning-value"];
const colorSettingKeys = ["core1", "core2", "core3", "core4"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    notificationFormat: "percent",

    count: 0,

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_cpu;
            this.count = Modules.GTop.glibtop_get_sysinfo().ncpu;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            total: [],
            user: [],
            system: []
        };

        this.data = {
            usage: [],
            user: [],
            system: []
        };

        this.history = {
            usage: [],
            user: [],
            system: []
        };

        Modules.GTop.glibtop_get_cpu(this.gtop);

        for(let i = 0; i < this.count; ++i){
            this.history.usage.push([]);
            this.history.user.push([]);
            this.history.system.push([]);
            this.saveRaw("total", i, this.gtop.xcpu_total[i]);
            this.saveRaw("user", i, this.gtop.xcpu_user[i]);
            this.saveRaw("system", i, this.gtop.xcpu_sys[i]);
        }
    },

    saveRaw: function(type, core, value){
        this.raw[type][core] = value;
    },

    saveData: function(type, core, value, raw){
        this.data[type][core] = value;

        if(raw)
            this.saveRaw(type, core, raw);

        this.updateHistory(this.history[type][core], value);
    },

    getHistory: function(type, core){
        return this.history[type][core];
    },

    getData: function(){
        Modules.GTop.glibtop_get_cpu(this.gtop);

        var dtotal, duser, dsystem, r = 0;
        for(var i = 0; i < this.count; ++i){
            dtotal = this.gtop.xcpu_total[i] - this.raw.total[i];
            duser = this.gtop.xcpu_user[i] - this.raw.user[i];
            dsystem = this.gtop.xcpu_sys[i] - this.raw.system[i];

            this.saveRaw("total", i, this.gtop.xcpu_total[i]);
            this.saveData("user", i, duser / dtotal, this.gtop.xcpu_user[i]);
            this.saveData("system", i, dsystem / dtotal, this.gtop.xcpu_sys[i]);
            this.saveData("usage", i, (duser + dsystem) / dtotal);

            if(this.settings.cpuWarning){
                if(this.settings.cpuWarningMode === "avg")
                    r += this.data.usage[i];
                else
                    this.checkWarning(this.data.usage[i], _("CPU core %d usage was over %s for %fsec").format(i + 1), i);
            }
        }

        if(this.settings.cpuWarning && this.settings.cpuWarningMode === "avg")
            this.checkWarning(r / this.count, _("CPU usage was over %s for %fsec"));
    },

    onSettingsChanged: function(){
        if(this.settings.cpuWarning){
            if(this.settings.cpuWarningMode)
                this.notifications = this.settings.cpuWarningTime;
            else {
                this.notifications = [];
                for(var i = 0; i < this.count; ++i)
                    this.notifications.push(this.settings.cpuWarningTime);
            }
            this.settings.cpuWarningValue /= 100;
        }
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    init: function(module){
        this.labelWidths = [];
        this.margin = 260 - module.dataProvider.count * 60;

        for(let i = 0; i < module.dataProvider.count; ++i)
            this.labelWidths.push(60);

        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        this.addRow(_("User"));
        this.addRow(_("System"));
    },

    update: function(){
        for(let i = 0; i < this.count; ++i){
            this.setText(0, i, "percent", this.data.usage[i]);
            this.setText(1, i, "percent", this.data.user[i]);
            this.setText(2, i, "percent", this.data.system[i]);
        }
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.PanelLabelPrototype,

    main: {
        core: /^(?:core|c)(\d+)$/i,
        average: /^(?:average|avg|all|a)$/i
    },

    defaultSub: "usage",
    sub: {
        user: /^(?:user|usr|u)$/i,
        system: /^(?:system|sys|s)$/i
    },

    core: function(core, sub){
        core = parseInt(core) - 1;

        if(0 > core || core > this.count)
            return null;

        return this.formatPercent(this.data[sub][core]);
    },

    average: function(sub){
        let value = 0;
        for(let i = 0; i < this.count; ++i)
            value += this.data[sub][i] / this.count;

        return this.formatPercent(value);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(this.count);

        for(let i = 0; i < this.count; ++i){
            this.next("core" + (i % 4 + 1));
            this.bar(this.data.user[i]);

            this.setAlpha(.75);
            this.bar(this.data.system[i]);
        }
    }
};

const historyGraphDisplay = _("CPU History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.count, this.history.user[0].length);

        if(this.settings.appearance === "stack"){
            for(let i = this.count; i--; ){
                this.next("core" + (i % 4 + 1));

                if(this.settings.split === "user-system"){
                    this.line(this.history.user[i]);
                    this.setAlpha(.75);
                    this.line(this.history.system[i]);
                } else
                    this.line(this.history.usage[i]);
            }
        } else {
            for(let i = 0; i < this.count; ++i){
                this.next("core" + (i % 4 + 1));

                if(this.settings.split === "user-system"){
                    this.line(this.history.user[i], true);
                    this.setAlpha(.75);
                    this.line(this.history.system[i]);
                } else
                    this.line(this.history.usage[i]);
            }
        }
    }
};
