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

const name = "swap";
const settingsName = "mem";
const display = _("Swap");

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.init.BaseDataProvider.prototype,

    init: function(){
        Modules.init.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.init.GTop.glibtop_swap;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = {
            total: 1,
            used: 0
        };

        this.history = {
            used: []
        };
    },

    getData: function(){
        Modules.init.GTop.glibtop_get_swap(this.gtop);

        this.saveData("total", this.gtop.total);
        this.saveData("used", this.gtop.used);
    },

    // will handled by Memory
    onSettingsChanged: function(){}
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.init.BaseMenuItem.prototype,

    labelWidths: [100, 100, 60],

    update: function(){
        this.setText(0, 0, "bytes", this.data.used);
        this.setText(0, 1, "bytes", this.data.total);
        this.setText(0, 2, "percent", this.data.used, this.data.total);
    }
};
