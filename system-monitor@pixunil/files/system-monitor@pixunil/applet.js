const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Util = imports.misc.util;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Mainloop = imports.mainloop;

const uuid = "system-monitor@pixunil";
const applet = imports.ui.appletManager.applets[uuid];

const _ = applet._;
const bind = applet.bind;
const dashToCamelCase = applet.dashToCamelCase;
const iconName = applet.iconName;

const Graph = applet.graph;
const Modules = applet.modules;

try {
    Modules.GTop = imports.gi.GTop;
} catch(e){
    let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});
    Main.criticalNotify(_("Dependence missing"), _("Please install the GTop package\n" +
        "\tUbuntu / Mint: gir1.2-gtop-2.0\n" +
        "\tFedora: libgtop2-devel\n" +
        "\tArch: libgtop\n" +
        "to use the applet %s").format(uuid), icon);
}

const ModuleImports = {
    loadavg: applet.modules.loadavg,
    cpu: applet.modules.cpu,
    mem: applet.modules.mem,
    swap: applet.modules.swap,
    disk: applet.modules.disk,
    network: applet.modules.network,
    thermal: applet.modules.thermal,
    fan: applet.modules.fan
};

function SystemMonitorTooltip(){
    this._init.apply(this, arguments);
}

SystemMonitorTooltip.prototype = {
    __proto__: Tooltips.PanelItemTooltip.prototype,

    _init: function(applet, orientation){
        Tooltips.PanelItemTooltip.prototype._init.call(this, applet, "", orientation);

        this._tooltip = new St.BoxLayout({name: "Tooltip", vertical: true});
        this._tooltip.show_on_set_parent = false;
        Main.uiGroup.add_actor(this._tooltip);

        this._tooltip.get_text = function(){
            return true;
        };
    },

    addActor: function(actor){
        this._tooltip.add_actor(actor);
    }
};

function SettingsProvider(){
    this.init.apply(this, arguments);
}

SettingsProvider.prototype = {
    __proto__: Settings.AppletSettings.prototype,

    init: function(bindObject, instanceId){
        Settings.AppletSettings.prototype._init.call(this, bindObject, uuid, instanceId);
    },

    bindProperty: function(key, callback){
        let keyCamelCase = dashToCamelCase(key);
        this.bind(key, keyCamelCase, callback);
    },

    bindProperties: function(keys, callback){
        keys.forEach(key => this.bindProperty(key, callback));
    },

    bindModule: function(module){
        // some settings of the applet settings object will be used,
        // for that reason the module settings object has it as prototype
        module.settings = {
            __proto__: this.bindObject
        };

        let keys = ["enabled"];

        if(module.import.additionalSettingKeys)
            keys = keys.concat(module.import.additionalSettingKeys);

        if(module.import.HistoryGraph)
            keys.push("appearance", "panel-graph", "panel-size");

        if(module.import.PanelLabel)
            keys.push("panel-label");

        if(module.import.colorSettingKeys)
            keys = keys.concat(module.import.colorSettingKeys.map(key => "color-" + key));

        let callback = bind(module.onSettingsChanged, module);

        keys.forEach(key => {
            let keyCamelCase = dashToCamelCase(key);
            // prepend the module name and a dash
            key = module.import.name + "-" + key;
            this.bindWithObject(module.settings, key, keyCamelCase, callback);
        });
    }
};

function SystemMonitorApplet(){
    this.init.apply(this, arguments);
}

SystemMonitorApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    sensorPath: "",

    init: function(orientation, panelHeight, instanceId){
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight);

        this._applet_tooltip = new SystemMonitorTooltip(this, orientation);
        this._applet_tooltip.addActor(new St.Label({text: _("System Monitor")}));
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_icon_symbolic_name(iconName);

        this.modules = {};

        this.settings = {};
        this.settingsProvider = new SettingsProvider(this.settings, instanceId);

        // applet settings keys
        this.settingsProvider.bindProperties([
            "show-icon", "interval", "byte-unit", "rate-unit", "thermal-unit", "order",
            "graph-size", "graph-steps", "graph-overview", "graph-connection"
        ], bind(this.onSettingsChanged, this));
        this.settingsProvider.bindProperty("graph-type", bind(this.onGraphTypeChanged, this));

        // a little wrapper object to access values
        this.container = {
            vertical: orientation == St.Side.LEFT || orientation == St.Side.RIGHT,
            modules: this.modules,
            settingsProvider: this.settingsProvider,
            time: GLib.get_monotonic_time() / 1e6
        };

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.canvas = new St.DrawingArea({height: this.settings.graphSize});
        this.canvas.connect("repaint", bind(this.draw, this));
        this.canvasHolder = new PopupMenu.PopupBaseMenuItem({activate: false, sensitive: false});
        this.canvasHolder.actor.connect("scroll-event", bind(this.onScroll, this));
        this.canvasHolder.addActor(this.canvas, {span: -1, expand: true});

        this.graphs = [null];

        this.graphSubMenu = new PopupMenu.PopupSubMenuMenuItem("");
        this.graphSubMenu.actor.connect("scroll-event", bind(this.onScroll, this));
        // ignore the width of the text content, avoids big menu
        this.graphSubMenu.getColumnWidths = () => [0];

        this.graphMenuItems = [
            new Modules.GraphMenuItem(this, _("Overview"), 0)
        ];

        this.graphSubMenu.menu.addMenuItem(this.graphMenuItems[0]);

        let result = GLib.spawn_command_line_sync("which sensors");
        let sensorLines;

        // if the command is not found, set the result to null, sensor modules will fail then
        if(!result[0] || result[3] !== 0)
            sensorLines = null;
        else {
            // get the first line
            this.sensorPath = result[1].toString().split("\n", 1)[0];
            sensorLines = GLib.spawn_command_line_sync(this.sensorPath)[1].toString().split("\n");
        }

        let index = 1;
        for(let module in ModuleImports){
            // create the module
            this.modules[module] = new Modules.Module(ModuleImports[module], this.container, sensorLines);
            module = this.modules[module];

            if(module.unavailable)
                continue;

            // add data displaying widgets
            this.menu.addMenuItem(module.menuItem);
            this._applet_tooltip.addActor(module.tooltip);

            // build the menu graph and graph menu item
            let graph = module.buildMenuGraph(this, index);

            if(graph){
                this.graphs.push(graph);
                this.graphMenuItems.push(module.graphMenuItem);
                this.graphSubMenu.menu.addMenuItem(module.graphMenuItem);
                index++;
            }

            if(module.panelWidget)
                this.actor.add(module.panelWidget.box);
        }

        // after all modules are ready, create the overview graphs
        this.graphs[0] = [
            new Graph.PieOverview(this.canvas, this.modules, this.settings),
            new Graph.ArcOverview(this.canvas, this.modules, this.settings)
        ];

        this.menu.addMenuItem(this.canvasHolder);
        this.menu.addMenuItem(this.graphSubMenu);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem);
        this.menu.addAction(_("System Monitor"), function(){
            let appSys = Cinnamon.AppSystem.get_default();
            let gsmApp = appSys.lookup_app("gnome-system-monitor.desktop");
            gsmApp.activate();
        });

        this.paintTimeline = new Clutter.Timeline({duration: 100, repeat_count: -1});
        this.paintTimeline.connect("new-frame", bind(this.paint, this));
        this.paintTimeline.start();

        this.getData(sensorLines);
        this.onSettingsChanged();
        this.onGraphTypeChanged();
    },

    getDataLoop: function(){
        // if a sensor module is active, first request the results of the sensor output
        if(this.modules.thermal.settings.enabled || this.modules.fan.settings.enabled)
            Util.spawn_async(this.sensorPath, bind(this.getData, this));
        // if none is active, skip the request
        else
            this.getData();
    },

    getData: function(result){
        if(typeof result == "string")
            result = result.split("\n");

        // calculate the time (in seconds) since the last update and save the time
        let time = GLib.get_monotonic_time() / 1e6;
        let delta = time - this.container.time;
        this.container.time = time;

        // try to calculate the balance, so that the timeout between the updates is more to the setting value
        let timeBalance = (delta * 1e3 - this.settings.interval) / 2;

        // generate data
        for(let module in this.modules){
            // skip disabled modules
            if(!this.modules[module].settings.enabled)
                continue;

            let dataProvider = this.modules[module].dataProvider;

            // if it is a sensor module, pass the output of the sensor command to it
            if(dataProvider instanceof Modules.SensorDataProvider)
                dataProvider.getData(result);
            // for all other modules, pass the difference of the time since last data generating (used only by disk and network, but for other it is no harm)
            else
                dataProvider.getData(delta);
        }

        // data generated, now update the text
        this.updateText();

        // queue the next data request
        let interval = Math.max(Math.ceil(this.settings.interval - timeBalance), 0);
        this.timeout = Mainloop.timeout_add(interval, bind(this.getDataLoop, this));

        // refresh independently of the drawing timeline the Overview graph
        if(this.settings.graphType === 0)
            this.canvas.queue_repaint();
    },

    paint: function(timeline, time, once){
        // do not repaint Overview graph (it is handled by getData), but when the graphType is updated
        if(this.menu.isOpen && (this.settings.graphType !== 0 || once))
            this.canvas.queue_repaint();

        for(let module in this.modules){
            let panelWidget = this.modules[module].panelWidget;

            if(panelWidget)
                panelWidget.paint();
        }
    },

    draw: function(){
        let graph;

        if(this.settings.graphType === 0)
            graph = this.graphs[0][this.settings.graphOverview];
        else
            graph = this.graphs[this.settings.graphType];

        graph.draw();
        graph.ctx.$dispose();
    },

    updateText: function(){
        for(let module in this.modules)
            this.modules[module].update();
    },

    on_applet_clicked: function(){
        this.menu.toggle();
        if(this.menu.isOpen) this.updateText();
    },

    on_orientation_changed: function(orientation) {
        let vertical = orientation == St.Side.LEFT || orientation == St.Side.RIGHT;
        this.container.vertical = vertical;

        for(let module in this.modules){
            let panelWidget = this.modules[module].panelWidget;

            if(panelWidget)
                panelWidget.onSettingsChanged();
        }
    },

    on_applet_removed_from_panel: function(){
        Mainloop.source_remove(this.timeout);
        this.paintTimeline.run_dispose();
        this.settingsProvider.finalize();
    },

    onSettingsChanged: function(){
        this.canvas.set_height(this.settings.graphSize);

        // use the private property _applet_icon_box for showing / hiding the icon
        this._applet_icon_box.visible = this.settings.showIcon;

        this.updateText();
    },

    onGraphTypeChanged: function(){
        this.graphMenuItems.forEach(function(item){
            item.setShowDot(false);
        });

        // if selected graph type is none, hide both graph and chooser
        let show = this.settings.graphType !== -1;
        this.graphSubMenu.actor.visible = show;
        this.canvasHolder.actor.visible = show;

        if(show){
            let graphMenuItem = this.graphMenuItems[this.settings.graphType];

            // if the graph type is invalid (like setting it from settings, but the module is disabled), set it to "Overview"
            if(!graphMenuItem || !graphMenuItem.actor.visible){
                this.settings.graphType = 0;
                return;
            }

            this.graphSubMenu.label.text = graphMenuItem.display;
            graphMenuItem.setShowDot(true);
            // redraw the graph independent on the graph draw timeline
            this.paint(this.paintTimeline, 0, true);
        }
    },

    onScroll: function(actor, event){
        let direction = event.get_scroll_direction();
        let graphType = this.settings.graphType;

        if(direction === Clutter.ScrollDirection.DOWN && graphType < this.graphs.length - 1){
            // scrolling down, so increment the graphType pointer until a active item is hit
            do {
                if(++graphType === this.graphs.length)
                    return;
            } while(!this.graphMenuItems[graphType].actor.visible);
        } else if(direction === Clutter.ScrollDirection.UP && graphType > 0){
            // scrolling up, so decrement the graphType pointer until a active item is hit
            do {
                graphType--;
            } while(!this.graphMenuItems[graphType].actor.visible);
        }

        this.settings.graphType = graphType;

        this.onGraphTypeChanged();
    },

    launchReadme: function(){
        Util.spawnCommandLine("xdg-open https://github.com/pixunil/cinnamon-applet-system-monitor/blob/master/README.md#settings");
    }
};

function main(metadata, orientation, panelHeight, instanceId){
    return new SystemMonitorApplet(orientation, panelHeight, instanceId);
}
