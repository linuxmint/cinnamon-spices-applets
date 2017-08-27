const Cinnamon = imports.gi.Cinnamon;

const Mainloop = imports.mainloop;

const uuid = "system-monitor@pixunil";
const applet = imports.ui.appletManager.applets[uuid];

const _ = applet._;
const Graph = applet.graph;
const bind = applet.bind;
const Modules = applet.modules;

const name = "disk";
const display = _("Disk");
const colorSettingKeys = ["write", "read"];

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
            this.gtop = new Modules.GTop.glibtop_fsusage;
        } catch(e){
            this.unavailable = true;
            return;
        }

        this.raw = {
            write: 0,
            read: 0
        };

        this.data = {
            write: 0,
            read: 0
        };

        this.history = {
            write: [],
            read: []
        };

        this.updateDevices();
    },

    updateDevices: function(){
        this.dev = [];

        let mountFile = Cinnamon.get_file_contents_utf8_sync("/etc/mtab").split("\n");
        for(let mountLine in mountFile){
            let mount = mountFile[mountLine].split(" ");

            if(mount[0].indexOf("/dev/") === 0){
                Modules.GTop.glibtop_get_fsusage(this.gtop, mount[1]);

                this.dev.push({
                    path: mount[1],
                    size: this.gtop.block_size,
                    free: this.gtop.bfree,
                    blocks: this.gtop.blocks
                });
            }
        }

        if(this.module.menuItem)
            this.module.menuItem.updateDevices();

        Mainloop.timeout_add(30000, bind(this.updateDevices, this));
    },

    getData: function(delta){
        let write = 0, read = 0;

        for(var i = 0; i < this.dev.length; ++i){
            Modules.GTop.glibtop_get_fsusage(this.gtop, this.dev[i].path);

            this.dev[i].size = this.gtop.block_size;
            this.dev[i].free = this.gtop.bfree;
            this.dev[i].blocks = this.gtop.blocks;

            write += this.gtop.write * this.dev[i].size;
            read += this.gtop.read * this.dev[i].size;
        }

        if(delta > 0 && this.raw.write && this.raw.read){
            this.saveData("write", (write - this.raw.write) / delta);
            this.saveData("read", (read - this.raw.read) / delta);

            this.updateMinMax();
        }

        this.saveRaw("write", write);
        this.saveRaw("read", read);
    }
};

function MenuItem(){
    this.init.apply(this, arguments);
}

MenuItem.prototype = {
    __proto__: Modules.BaseSubMenuMenuItem.prototype,

    labelWidths: [130, 130],

    init: function(){
        Modules.BaseSubMenuMenuItem.prototype.init.apply(this, arguments);

        this.updateDevices();
    },

    updateDevices: function(){
        this.containers.splice(1, this.containers.length - 1);
        this.menu.removeAll();

        for(let dev in this.dev)
            this.addRow(this.dev[dev].path, [100, 100, 60]);
    },

    update: function(){
        this.setText(0, this.settings.order === "up-down"? 0 : 1, "rate", this.data.write, true);
        this.setText(0, this.settings.order === "down-up"? 0 : 1, "rate", this.data.read, false);

        for(var i = 0; i < this.dev.length; ++i){
            let dev = this.dev[i];
            this.setText(i + 1, 0, "bytes", (dev.blocks - dev.free) * dev.size);
            this.setText(i + 1, 1, "bytes", dev.blocks * dev.size);
            this.setText(i + 1, 2, "percent", dev.blocks - dev.free, dev.blocks);
        }
    }
};

function PanelLabel(){
    this.init.apply(this, arguments);
}

PanelLabel.prototype = {
    __proto__: Modules.PanelLabelPrototype,

    main: {
        write: /^(?:write|w)$/i,
        read: /^(?:read|r)$/i
    },

    write: function(){
        return this.formatRate(this.data.write);
    },

    read: function(){
        return this.formatRate(this.data.read);
    }
};

function BarGraph(){
    this.init.apply(this, arguments);
}
BarGraph.prototype = {
    __proto__: Graph.Bar.prototype,

    draw: function(){
        this.begin(2);

        this.next("write");
        this.bar(this.data.write / this.module.max);

        this.next("read");
        this.bar(this.data.read / this.module.max);
    }
};

const historyGraphDisplay = _("Disk History");

function HistoryGraph(){
    this.init.apply(this, arguments);
}
HistoryGraph.prototype = {
    __proto__: Graph.History.prototype,

    draw: function(){
        this.begin(2, this.history.write.length, this.module.max);

        this.next("write");
        this.line(this.history.write);

        this.next("read");
        this.line(this.history.read);
    }
};
