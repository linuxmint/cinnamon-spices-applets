const uuid = "system-monitor@pixunil";
const applet = imports.ui.appletManager.applets[uuid];

const _ = applet._;
const Modules = applet.modules;

const name = "loadavg";
const display = _("Load averages");

function DataProvider(){
    this.init.apply(this, arguments);
}

DataProvider.prototype = {
    __proto__: Modules.BaseDataProvider.prototype,

    init: function(){
        Modules.BaseDataProvider.prototype.init.apply(this, arguments);

        try {
            this.gtop = new Modules.GTop.glibtop_loadavg;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.data = [];
    },

    getData: function(){
        Modules.GTop.glibtop_get_loadavg(this.gtop);

        this.data = this.gtop.loadavg;
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseMenuItem.prototype,

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
    __proto__: Modules.PanelLabelPrototype,

    main: {
        load: /(?:load|l)([0-2])/i
    },

    load: function(load){
        load = parseInt(load);
        return this.formatNumber(this.data[load]);
    }
};
