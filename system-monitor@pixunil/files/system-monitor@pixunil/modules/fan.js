const _ = imports.applet._;
const Graph = imports.applet.graph;
const Modules = imports.applet.modules;

const name = "fan";
const display = _("Fan");
const additionalSettingKeys = ["mode", "warning", "warning-time", "warning-value"];
const colorSettingKeys = ["fan"];

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.SensorDataProvider.prototype,

    notificationFormat: "rpm",

    dataMatcher: /(\d+) RPM/,

    parseSensorLine: function(line, lineNumber){
        // extract the name (the chars before the first colon), but remove "fan speed"
        let name = line.match(/^(.+?)(?:fan speed)?:/i)[1];

        this.sensors.push(lineNumber);
        this.sensorNames.push(name);
        this.history.push([]);
    },

    getData: function(result){
        Modules.SensorDataProvider.prototype.getData.call(this, result);

        if(this.settings.fanWarning)
            this.checkWarning(this.data[0], _("Fan rotation was over %s for %fsec"));
    },

    onSettingsChanged: function(){
        if(this.settings.fanWarning)
            this.notifications = this.settings.fanWarningTime;
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [80],
    margin: 180,

    init: function(module){
        Modules.BaseSubMenuMenuItem.prototype.init.call(this, module);

        for(let i = 0, l = module.dataProvider.sensorNames.length; i < l; ++i)
            this.addRow(module.dataProvider.sensorNames[i]);

        delete module.dataProvider.sensorNames;
    },

    update: function(){
        for(let i = 0, l = this.data.length; i < l; ++i)
            this.setText(i, 0, "rpm", this.data[i]);
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.PanelLabelPrototype,

    main: {
        value: /^(?:value|v|min|max|m|average|avg|a)$/i,
        sensor: /^(?:sensor|s)(\d+)$/i
    },

    value: function(){
        return this.formatRPM(this.data[0]);
    },

    sensor: function(sensor){
        sensor = parseInt(sensor);
        return this.formatRPM(this.data[sensor]);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}

BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(1);

        this.next("fan");
        this.bar((this.data[0] - this.module.min) / (this.module.max - this.module.min));
    }
};

const historyGraphDisplay = _("Fan History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}

HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(this.history.length, this.history[0].length, this.module.max, this.module.min);

        this.section = 0;

        // first draw the sensors
        for(let i = 1, l = this.history.length; i < l; ++i){
            this.next("fan");
            this.setAlpha((l - i / 4) / l);

            this.line(this.history[i], i, l);
        }

        // then the min / average / max data
        this.next("fan");
        this.section = 0;
        this.ctx.setDash([5, 5], 0);
        this.line(this.history[0], 0, this.history.length);
    }
};
