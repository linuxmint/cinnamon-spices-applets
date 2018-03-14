const uuid = "system-monitor@pixunil";
let _, Modules;
if (typeof require !== 'undefined') {
    _ = require('../init')._;
    Modules = require('../modules');
} else {
    const applet = imports.ui.appletManager.applets[uuid];
    _ = applet.init._;
    Modules = applet.modules;
}
global.log('------------------>', Object.keys(Modules))

const name = "loadavg";
const display = _("Load averages");

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.init.BaseDataProvider.prototype,

    init: function(){
        Modules.init.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.init.GTop.glibtop_loadavg;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = [];
    },

    getData: function(){
        Modules.init.GTop.glibtop_get_loadavg(this.gtop);

        this.data = this.gtop.loadavg;
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.init.BaseMenuItem.prototype,

    labelWidths: [90, 90, 80],

    update: function(){
        this.setText(0, 0, "number", this.data[0]);
        this.setText(0, 1, "number", this.data[1]);
        this.setText(0, 2, "number", this.data[2]);
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.init.PanelLabelPrototype,

    main: {
        load: /(?:load|l)([0-2])/i
    },

    load: function(load){
        load = parseInt(load);
        return this.formatNumber(this.data[load]);
    }
};
