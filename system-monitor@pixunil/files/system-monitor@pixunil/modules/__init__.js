const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const messageTray = Main.messageTray;

const uuid = imports.applet.uuid;
const iconName = imports.applet.iconName;

const _ = imports.applet._;
const bind = imports.applet.bind;
const dashToCamelCase = imports.applet.dashToCamelCase;

const SettingsProvider = imports.applet.applet.SettingsProvider;

// prefixes for byte sizes (kilo, mega, giga, …)
const PREFIX = " KMGTEZY";

let GTop = null;

const ModulePartPrototype = {
    init: function(module){
        this.module = module;
    },

    format: function(format, value = 0, ext = undefined){
        if(format === "number")
            return this.formatNumber(value);

        if(format === "bytes")
            return this.formatBytes(value);

        if(format === "rate")
            return this.formatRate(value, ext);

        if(format === "percent")
            return this.formatPercent(value, ext);

        if(format === "thermal")
            return this.formatThermal(value);

        if(format === "rpm")
            return this.formatRPM(value);

        return value;
    },

    formatNumber: function(number){
        return number.toFixed(2);
    },

    formatBytes: function(bytes){
        let [value, unit] = this.determinatePrefix(bytes, this.settings.byteUnit === "binary");
        // use a capital "B" for bytes
        unit += "B";

        return value.toFixed(1) + " " + unit;
    },

    formatRate: function(bytes, dir){
        // the value must be multiplicated by eight when using bits, as it is in bytes per default
        if(this.settings.rateUnit.endsWith("bit"))
            bytes *= 8;

        let [value, unit] = this.determinatePrefix(bytes, this.settings.rateUnit.startsWith("binary"));

        // use a capital "B" for bytes, "bit" for bits
        if(this.settings.rateUnit.endsWith("byte"))
            unit += "B";
        else
            unit += "bit";
        // lastly, this is a rate unit, so append per second
        unit += "/s";

        // use unicode arrow up and arrow down for indication of the direction of stream
        let arrow;
        if(dir)
            arrow = "▲";
        else
            arrow = "▼";

        return value.toFixed(1) + " " + unit + " " + arrow;
    },

    determinatePrefix: function(value, binary){
        // there is no need to calculate the prefix for invalid or zero values
        if(value <= 0)
            return [value, ""];

        // for binary prefix, the factor is 2 ** 10 (1024), decimal is 1000
        let sizeMultiplicator;
        if(binary)
            sizeMultiplicator = 1024;
        else
            sizeMultiplicator = 1000;

        // use logarithm to determinate the exponent
        let exponent = Math.log(value) / Math.log(sizeMultiplicator);
        exponent = Math.floor(exponent);

        // value is too small for a prefix
        if(exponent === 0)
            return [value, ""];

        // choose the prefix
        let prefix = PREFIX[exponent];
        // show the letter "i" to indicate a binary prefix
        if(binary)
            prefix += "i";
        // shrink the value according to the prefix
        value /= Math.pow(sizeMultiplicator, exponent);

        return [value, prefix];
    },

    formatPercent: function(part, total = 1){
        let percentage = 100 * part / total;
        return percentage.toFixed(1) + "%";
    },

    formatThermal: function(celsius = 0){
        let number = this.settings.thermalUnit? celsius : celsius * 1.8 + 32;
        let unit;
        // use unicode to represent the unit, it combines both degree symbol and character
        if(this.settings.thermalUnit === "celsius")
            unit = "℃";
        else
            unit = "℉";

        return number.toFixed(1) + unit;
    },

    formatRPM: function(number){
        return number.toFixed(0) + " RPM";
    },

    // shortcuts
    get name(){
        return this.module.name;
    },

    get settings(){
        return this.module.settings;
    },

    get modules(){
        return this.module.modules;
    },

    get time(){
        return this.module.container.time;
    },

    get raw(){
        return this.module.dataProvider.raw;
    },

    get data(){
        return this.module.dataProvider.data;
    },

    get history(){
        return this.module.dataProvider.history;
    },

    get count(){
        return this.module.dataProvider.count;
    },

    get dev(){
        return this.module.dataProvider.dev;
    },

    get colorRefs(){
        return this.module.dataProvider.colorRefs;
    }
};

function ModulePart(superClass){
    var proto = Object.create(superClass.prototype);

    for(let property in ModulePartPrototype)
        Object.defineProperty(proto, property, Object.getOwnPropertyDescriptor(ModulePartPrototype, property));

    return proto;
}

function ModuleSettings(){
    this.init.apply(this, arguments);
}

ModuleSettings.prototype = {
    __proto__: SettingsProvider.prototype,

    init: function(module, appletSettings, instanceId){
        this.name = module.import.name;
        // some settings of the applet settings object will be used,
        // for that reason the module settings object has it as prototype
        module.settings = {
            __proto__: appletSettings
        };

        SettingsProvider.prototype.init.call(this, module.settings, instanceId);

        let keys = ["enabled"];

        if(module.import.additionalSettingKeys)
            keys = keys.concat(module.import.additionalSettingKeys);

        if(module.import.HistoryGraph)
            keys.push("appearance", "panel-graph", "panel-width");

        if(module.import.PanelLabel)
            keys.push("panel-label");

        if(module.import.colorSettingKeys)
            keys = keys.concat(module.import.colorSettingKeys.map(key => "color-" + key));

        this.bindProperties(keys, bind(module.onSettingsChanged, module));
    },

    bindProperty: function(key, callback){
        let keyCamelCase = dashToCamelCase(key);
        // prepend the module name and a dash
        key = this.name + "-" + key;

        Settings.AppletSettings.prototype.bindProperty.call(this, Settings.BindingDirection.IN, key, keyCamelCase, callback);
    }
};

function Module(){
    this.init.apply(this, arguments);
}

Module.prototype = {
    init: function(imports, container, sensorLines, instanceId){
        this.import = imports;
        this.display = imports.display;

        if(imports.settingsName){
            // the swap module shares its settings with memory, for this reason only a simple reference is needed
            this.settings = container.modules[imports.settingsName].settings;
            // as changed values will only be reported to the owning module, connect to them
            let settingsProvider = container.modules[imports.settingsName].settingsProvider;
            settingsProvider.connect("settings-changed", bind(this.onSettingsChanged, this));
        } else {
            if(imports.colorSettingKeys)
                this.colorSettingKeys = imports.colorSettingKeys;

            // for all other modules an own settings object and provider is created
            this.settingsProvider = new ModuleSettings(this, container.settings, instanceId);
        }

        this.container = container;
        this.modules = container.modules;

        this.dataProvider = new imports.DataProvider(this, sensorLines);

        if(this.dataProvider.unavailable)
            this.unavailable = true;
        else {
            this.menuItem = new imports.MenuItem(this);
            this.tooltip = this.menuItem.makeTooltip();

            // only if one of panel label or graph is available, create a panel widget
            if(imports.PanelLabel || imports.BarGraph)
                this.panelWidget = new PanelWidget(this);
        }

        this.onSettingsChanged();
    },

    buildMenuGraph: function(applet, index){
        if(!this.import.HistoryGraph)
            return null;

        this.graphMenuItem = new GraphMenuItem(applet, this.import.historyGraphDisplay, index);
        return new this.import.HistoryGraph(applet.canvas, this);
    },

    get min(){
        return this.dataProvider.min || 0;
    },

    get max(){
        return this.dataProvider.max || 1;
    },

    update: function(){
        if(this.settings.enabled){
            if(this.menuItem)
                this.menuItem.update();

            if(this.panelWidget)
                this.panelWidget.update();
        }
    },

    onSettingsChanged: function(){
        if(this.dataProvider.unavailable && this.settings.enabled)
            this.settings.enabled = false;

        this.color = {};

        if(this.colorSettingKeys){
            this.colorSettingKeys.forEach(function(key){
                let color = this.settings["color" + key[0].toUpperCase() + key.substr(1)];
                // get the values of red, green and blue
                color = color.match(/(\d+).+?(\d+).+?(\d+)/);
                // remove the match index
                color.shift();
                // make the color parts to be integers in the range 0 to 1
                color = color.map(colorPart => parseInt(colorPart) / 255);

                this.color[key] = color;
            }, this);
        }

        if(this.dataProvider.onSettingsChanged)
            this.dataProvider.onSettingsChanged();

        if(this.menuItem)
            this.menuItem.onSettingsChanged();
        if(this.panelWidget)
            this.panelWidget.onSettingsChanged();
        if(this.graphMenuItem)
            this.graphMenuItem.onSettingsChanged(this.settings.enabled);
    },

    finalize: function(){
        if(this.settingsProvider)
            this.settingsProvider.finalize();
    }
};

function BaseDataProvider(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.BaseDataProvider");
}

BaseDataProvider.prototype = {
    init: function(module){
        this.module = module;
        this.settings = module.settings;
    },

    format: ModulePartPrototype.format,
    formatPercent: ModulePartPrototype.formatPercent,
    formatThermal: ModulePartPrototype.formatThermal,
    formatRPM: ModulePartPrototype.formatRPM,

    saveRaw: function(name, value){
        this.raw[name] = value;
    },

    saveData: function(name, value){
        this.data[name] = value;

        this.updateHistory(this.history[name], value);
    },

    updateHistory: function(history, value){
        if(!history)
            return;

        history.push(value);

        while(history.length > this.settings.graphSteps + 2)
            history.shift();

        if(this.min !== undefined && (!this.min || this.min > value)){
            this.min = value;
            this.minIndex = history.length;
        }

        if(this.max !== undefined && (!this.max || this.max < value)){
            this.max = value;
            this.maxIndex = history.length;
        }
    },

    updateMinMax: function(){
        if(this.min !== undefined && --this.minIndex <= 0){
            this.min = null;
            this.minIndex = 0;
            for(let i in this.history){
                for(let j = 0, l = this.history[i].length; j < l; ++j){
                    let value = this.history[i][j];
                    if(this.min === null || this.min > value){
                        this.min = value;
                        this.minIndex = j;
                    }
                }
            }
        }

        if(this.max !== undefined && --this.maxIndex <= 0){
            this.max = 1;
            this.maxIndex = 0;
            for(let i in this.history){
                for(let j = 0, l = this.history[i].length; j < l; ++j){
                    let value = this.history[i][j];
                    if(this.max < value){
                        this.max = value;
                        this.maxIndex = j;
                    }
                }
            }
        }
    },

    checkWarning: function(value, body, index){
        if(value >= this.settings.warningValue){
            var notify = false;
            if(index !== undefined)
                notify = --this.notifications[index] === 0;
            else
                notify = --this.notifications === 0;

            if(notify){
                let value = this.format(this.notificationFormat, this.settings.warningValue);
                this.notify(_("Warning"), body.format(value, this.settings.warningTime * this.settings.interval / 1000));
            }
        } else {
            if(index !== undefined)
                this.notifications[index] = this.settings.warningTime;
            else
                this.notifications = this.settings.warningTime;
        }
    },

    notify: function(summary, body){
        let source = new MessageTray.SystemNotificationSource();
        messageTray.add(source);

        let icon = new St.Icon({icon_name: iconName, icon_type: St.IconType.FULLCOLOR, icon_size: 24});

        let notification = new MessageTray.Notification(source, summary, body, {icon: icon});
        notification.setTransient(true);
        source.notify(notification);
    }
};

function SensorDataProvider(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.SensorDataProvider");
}

SensorDataProvider.prototype = {
    __proto__: BaseDataProvider.prototype,

    min: null,
    max: null,

    init: function(module, sensorLines){
        BaseDataProvider.prototype.init.apply(this, arguments);

        this.data = [];
        this.history = [[]];

        this.sensors = [];
        this.sensorNames = [];

        let inAdapter = false;

        if(!sensorLines){
            this.unavailable = true;
            return;
        }

        for(let i = 0, l = sensorLines.length; i < l; ++i){
            let line = sensorLines[i];

            if(line.substr(0, 8) === "Adapter:"){
                if(line.match(/virtual/i))
                    inAdapter = false;
                else
                    inAdapter = true;
            }

            if(inAdapter && line.match(this.dataMatcher))
                this.parseSensorLine(line, i);
        }

        if(!this.sensors.length)
            this.unavailable = true;
    },

    getData: function(result){
        let mode = this.settings.mode;

        let value = null;
        for(let i = 0, l = this.sensors.length; i < l; ++i){
            // get the line containing the next sensor data value
            let data = result[this.sensors[i]];
            // get the number (first capture group)
            data = parseFloat(data.match(this.dataMatcher)[1]);
            this.saveData(i + 1, data);

            if(mode === "min" && value > data || value === null)
                value = data;
            else if(mode === "avg")
                value += data;
            else if(mode === "max" && value < data)
                value = data;
        }

        if(mode === "avg")
            value /= this.sensors.length;

        this.saveData(0, value);

        this.updateMinMax();
    }
};

function BaseMenuItem(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.BaseMenuItem");
}

BaseMenuItem.prototype = {
    __proto__: ModulePart(PopupMenu.PopupMenuItem),

    init: function(module){
        PopupMenu.PopupMenuItem.prototype._init.call(this, module.display, {reactive: false});

        this.module = module;
        this.containers = [];

        let box = this.makeBox();
        this.addActor(box);
    },

    makeBox: function(labelWidths, margin, tooltip){
        if(labelWidths === undefined)
            labelWidths = this.labelWidths;

        if(margin === undefined)
            margin = this.margin || 0;

        let box = new St.BoxLayout;
        let container = [];

        if(tooltip)
            box.add_actor(new St.Label({text: this.module.display, width: 85, margin_right: margin, style: "text-align: left"}));
        else
            box.margin_left = margin;

        for(let i = 0, l = labelWidths.length; i < l; ++i){
            let label = new St.Label({width: labelWidths[i], style: "text-align: right"});
            box.add_actor(label);
            container.push(label);
        }

        if(tooltip)
            this.tooltip = container;
        else
            this.containers.push(container);

        return box;
    },

    makeTooltip: function(){
        let labelWidths = this.labelWidths.map(labelWidth => labelWidth * .75);
        let margin = (this.margin || 0) * .75;

        this.tooltipBox = this.makeBox(labelWidths, margin, true);
        return this.tooltipBox;
    },

    setText: function(container, label, format, value, ext){
        value = this.format(format, value, ext);

        if(container === 0)
            this.tooltip[label].text = value;

        this.containers[container][label].text = value;
    },

    onSettingsChanged: function(){
        this.actor.visible = this.settings.enabled;
        this.tooltipBox.visible = this.settings.enabled;
    }
};

function BaseSubMenuMenuItem(){
    throw new TypeError("Trying to instantiate abstract class [" + uuid + "] modules.BaseSubMenuMenuItem");
}

BaseSubMenuMenuItem.prototype = {
    __proto__: ModulePart(PopupMenu.PopupSubMenuMenuItem),

    init: function(module){
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, module.display);

        this.module = module;
        this.containers = [];

        let children = this.actor.get_children();
        let expander = null;
        // in cinnamon 2.8, there is a last children, the expander
        if(children.length === 2){
            expander = children[children.length - 1];
            this.removeActor(expander);
        }

        let box = this.makeBox();
        this.addActor(box);

        if(expander)
            this.addActor(expander);
    },

    makeBox: BaseMenuItem.prototype.makeBox,
    makeTooltip: BaseMenuItem.prototype.makeTooltip,

    addRow: function(label, labels, margin){
        if(labels === undefined)
            labels = this.labels;

        if(margin === undefined)
            margin = this.margin;

        let menuItem = new PopupMenu.PopupMenuItem(label, {reactive: false});
        this.menu.addMenuItem(menuItem);
        let box = this.makeBox(labels, margin);
        menuItem.addActor(box);
    },

    setText: BaseMenuItem.prototype.setText,
    onSettingsChanged: BaseMenuItem.prototype.onSettingsChanged
};

function GraphMenuItem(){
    this.init.apply(this, arguments);
}

GraphMenuItem.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    init: function(applet, display, index){
        PopupMenu.PopupMenuItem.prototype._init.call(this, display);

        this.display = display;
        this.index = index;
        this.settings = applet.settings;
        this.onGraphTypeChanged = bind(applet.onGraphTypeChanged, applet);
    },

    // overwriting instead of connecting to supress menu from closing
    activate: function(){
        this.settings.graphType = this.index;
        this.onGraphTypeChanged();
    },

    // ignore the width of the text content, avoids big menu
    getColumnWidths: function(){
        return [0];
    },

    onSettingsChanged: function(active){
        this.actor.visible = active;

        // if the module was deactivated, but the menu graph is active, set it to "Overview"
        if(!active && this.settings.graphType === this.index){
            this.settings.graphType = 0;
            this.onGraphTypeChanged();
        }
    }
};

function PanelWidget(){
    this.init.apply(this, arguments);
}

PanelWidget.prototype = {
    __proto__: ModulePartPrototype,

    init: function(module){
        this.module = module;

        this.box = new St.BoxLayout;

        if(module.import.PanelLabel){
            this.label = new St.Label({reactive: true, track_hover: true, style_class: "applet-label"});
            this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this.box.add(this.label, {y_align: St.Align.MIDDLE, y_fill: false});

            this.panelLabel = new module.import.PanelLabel(module);
        }

        if(module.import.BarGraph){
            this.canvas = new St.DrawingArea;
            this.canvas.connect("repaint", bind(this.draw, this));
            this.box.add(this.canvas);

            this.graphs = [
                new module.import.BarGraph(this.canvas, module),
                new module.import.HistoryGraph(this.canvas, module)
            ];

            // inform the history graph that a horizontal packing is now required
            this.graphs[1].packDir = "horizontal";
        }
    },

    update: function(){
        if(this.settings.panelLabel && this.label){
            let text = this.settings.panelLabel.replace(/[%$](\w+(?:\(\d+\))?)(?:\.(\w+))?(?:#(\w+))?/g, bind(this.panelLabelReplace, this));
            this.label.set_text(text);
            this.label.margin_left = text.length? 6 : 0;
        }
    },

    panelLabelReplace: function(match, main, sub, format){
        // remove parentheses
        main = main.replace(/[()]/g, "");

        for(let name in this.panelLabel.main){
            // run the regEx against the matched main part
            let result = main.match(this.panelLabel.main[name]);

            if(!result)
                continue;

            // remove the match entry
            result.shift();

            if(this.panelLabel.sub){
                // in the case nothing applies, use the standard value
                let subUsed = this.panelLabel.defaultSub;

                for(let name in this.panelLabel.sub){
                    // run the regEx against the matched sub part
                    let result = sub.match(this.panelLabel.sub[name]);

                    // when it success, use it
                    if(result){
                        subUsed = name;
                        break;
                    }
                }

                result.push(subUsed);
            }

            if(this.panelLabel.formats){
                // when the format is in the list, use it
                if(this.panelLabel.formats.indexOf(format) > -1)
                    result.push(format);
                // if nothing found, use the first item
                else
                    result.push(this.panelLabel.formats[0]);
            }

            // call the method with the groups of the main regEx, the sub and format
            let output = this.panelLabel[name].apply(this.panelLabel, result);

            if(output)
                return output;
        }

        return match;
    },

    draw: function(){
        let graph = this.settings.panelGraph;

        if(graph === -1)
            return;

        graph = this.graphs[graph];

        if(this.settings.panelMode !== undefined)
            graph.mode = this.settings.panelMode;

        graph.draw();
        graph.ctx.$dispose();
    },

    paint: function(){
        if(this.canvas)
            this.canvas.queue_repaint();
    },

    onSettingsChanged: function(){
        let showBox = false;

        if(this.label){
            let show = this.settings.enabled && this.settings.panelLabel !== "";
            this.label.visible = show;
            showBox = show;
        }

        if(this.canvas){
            this.canvas.width = this.settings.panelWidth;
            let show = this.settings.enabled && this.settings.panelGraph !== -1;
            this.canvas.visible = show;
            this.canvas.margin_left = show? 6 : 0;

            showBox = showBox || show;
        }

        this.box.visible = showBox;
    }
};

const PanelLabelPrototype = {
    __proto__: ModulePartPrototype,

    addSpaces: function(number, spaces = 3){
        // calculate written digits and remove those spaces
        if(number > 0)
            spaces -= Math.floor(Math.log(number) / Math.log(10)) + 1;

        // use \u2007 as replacement for each digit
        return " ".repeat(spaces);
    },

    formatNumber: function(number){
        return this.addSpaces(number) + number.toFixed(2);
    },

    formatBytes: function(bytes){
        let [value, unit] = this.determinatePrefix(bytes, this.settings.byteUnit === "binary");
        // if no prefix was used, use two spaces as replacement (not ideal)
        if(!unit)
            unit = "  ";

        // use a capital "B" for bytes
        unit += "B";

        return this.addSpaces(value, 4) + value.toFixed(1) + " " + unit;
    },

    formatRate: function(bytes, dir){
        // the value must be multiplicated by eight when using bits, as it is in bytes per default
        if(this.settings.rateUnit.endsWith("bit"))
            bytes *= 8;

        let [value, unit] = this.determinatePrefix(bytes, this.settings.rateUnit.startsWith("binary"));

        // if no prefix was used, use two spaces as replacement (not ideal)
        if(!unit)
            unit = "  ";

        // use a capital "B" for bytes, "bit" for bits
        if(this.settings.rateUnit.endsWith("byte"))
            unit += "B";
        else
            unit += "bit";
        // lastly, this is a rate unit, so append per second
        unit += "/s";

        return this.addSpaces(value, 4) + value.toFixed(1) + " " + unit;
    },

    formatPercent: function(part, total = 1){
        let percent = 100 * part / total;
        return this.addSpaces(percent) + percent.toFixed(2) + "%";
    },

    formatThermal: function(celsius = 0){
        let number = this.settings.thermalUnit? celsius : celsius * 1.8 + 32;
        let unit;
        // use unicode to represent the unit, it combines both degree symbol and character
        if(this.settings.thermalUnit === "celsius")
            unit = "℃";
        else
            unit = "℉";

        return this.addSpaces(number) + number.toFixed(1) + unit;
    },

    formatRPM: function(number){
        return this.addSpaces(number) + number.toFixed(0) + " RPM";
    }
};
