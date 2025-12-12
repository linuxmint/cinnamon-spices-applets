const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gettext = imports.gettext;

const UUID = "combined-monitor@danipin";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const PROC_STAT = "/proc/stat";
const PROC_MEM = "/proc/meminfo";

class CombinedMonitorApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;

        // OPTIMIERUNG: Vereinfachte Pfad-Erkennung
        this.applet_path = (metadata && metadata.path) ? metadata.path : "";

        try {
            this.settings = new Settings.AppletSettings(this, this.metadata.uuid, instanceId);
        } catch (e) {
            global.logError("CombinedMonitor: could not create AppletSettings: " + e);
            this.settings = null;
        }

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // ... (Defaults unverändert)

        this.updateInterval = 1000;
        this.showCpu = true;
        this.cpuLabel = "CPU";
        this.cpuSymbol = "";
        this.cpuLow = 50;
        this.cpuMed = 75;
        this.cpuHigh = 85;
        this.cpuColorLow = "#ffffff";
        this.cpuColorMed = "#ffff00";
        this.cpuColorHigh = "#FFA500";
        this.cpuColorCritical = "#FF4500";

        this.showRam = true;
        this.ramLabel = "RAM";
        this.ramSymbol = "";
        this.ramLow = 50;
        this.ramMed = 75;
        this.ramHigh = 85;
        this.ramColorLow = "#ffffff";
        this.ramColorMed = "#ffff00";
        this.ramColorHigh = "#FFA500";
        this.ramColorCritical = "#FF4500";

        this.cpuColorsEnabled = true;
        this.ramColorsEnabled = true;
        this.swapColorsEnabled = true;

        this.showSwap = true;
        this.swapLabel = "SWAP";
        this.swapSymbol = "";
        this.swapLow = 30;
        this.swapMed = 60;
        this.swapHigh = 80;
        this.swapColorLow = "#ffffff";
        this.swapColorMed = "#ffff00";
        this.swapColorHigh = "#FFA500";
        this.swapColorCritical = "#FF4500";

        this.layoutVariant = 1;

        this.enableSeparator = true;
        this.separatorText = "|";
        this.separatorColor = "#ffffff";

        this.swapOnlyWhenUsed = false;
        this._lastSwapPercent = 0;

        this._prevTotal = 0;
        this._prevIdle = 0;
        this._timeoutId = 0;

        this._cpuActor = null;
        this._ramActor = null;
        this._swapActor = null;

        this._buildUI();
        this._bindSettings();
        this._start();
    }

    // -------------------------
    // Popup-Menü mit System-Links + Icon-Vorschau
    // -------------------------
    _buildPopupMenu() {
        try {
            this.menu.removeAll();

            // 1. Trennzeichen-Voreinstellungen
            const sepSection = new PopupMenu.PopupSubMenuMenuItem(_("Trennzeichen"));

            const _addSepItem = (label, value) => {
                const item = new PopupMenu.PopupMenuItem(label);
                item.connect('activate', () => {
                    this._setSeparatorFromPopup(value);
                });
                sepSection.menu.addMenuItem(item);
            };

            _addSepItem("| (Standard)", "|");
            _addSepItem("/ (Slash)", "/");
            _addSepItem("· (Punkt)", "·");
            _addSepItem("• (Bullet)", "•");
            _addSepItem(_("Leerzeichen"), " ");
            
            const noSepItem = new PopupMenu.PopupMenuItem(_("Kein Trennzeichen"));
            noSepItem.connect('activate', () => {
                this.enableSeparator = false;
                try {
                    if (this.settings && this.settings.setValue)
                        this.settings.setValue("enable-separator", false);
                } catch (e) {}
                this._applyOrderToBox();
            });
            sepSection.menu.addMenuItem(noSepItem);

            this.menu.addMenuItem(sepSection);

            // 2. Symbol-Voreinstellungen mit Icon-Vorschau
            const symbolSection = new PopupMenu.PopupSubMenuMenuItem(_("Symbole"));

            const _addSymbolItemWithIcon = (metric, label, iconPath, showIcon) => {
                const baseItem = new PopupMenu.PopupBaseMenuItem({ 
                    reactive: true
                });
                
                // Erstelle eine Box für Icon und Text, mit x_expand: true, um den Platz auszufüllen
                const box = new St.BoxLayout({ 
                    x_align: Clutter.ActorAlign.START, 
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true 
                });

                if (showIcon && iconPath) {
                    try {
                        // SVG als file:// URI laden
                        const fileURI = GLib.filename_to_uri(iconPath, null);
                        const gicon = Gio.icon_new_for_string(fileURI);

                        const previewIcon = new St.Icon({
                            gicon: gicon,
                            icon_size: 16,
                            style: 'padding-right: 8px;'
                        });
                        box.add_child(previewIcon);
                    } catch (e) {
                        global.logError("CombinedMonitor: Could not load icon preview: " + e);
                    }
                }

                const textLabel = new St.Label({
                    text: label,
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(textLabel);

                // KORREKTUR: Nutzung der Cinnamon API zur Vermeidung von GJS/Clutter-Fehlern
                baseItem.addActor(box);
                
                baseItem.connect('activate', () => {
                    this._setSymbolFromPopup(metric, iconPath || "");
                });

                symbolSection.menu.addMenuItem(baseItem);
            };


            // CPU-Symbole
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const cpuHeader = new PopupMenu.PopupMenuItem(_("CPU"), { reactive: false });
            cpuHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(cpuHeader);

            _addSymbolItemWithIcon('cpu', _("Icon-White"), this.applet_path + "/icons/cpu_white.svg", true);
            _addSymbolItemWithIcon('cpu', _("Icon-Dark"), this.applet_path + "/icons/cpu_dark.svg", true);
            _addSymbolItemWithIcon('cpu', _("Kein Symbol (Textlabel)"), "", false);

            // RAM-Symbole
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const ramHeader = new PopupMenu.PopupMenuItem(_("RAM"), { reactive: false });
            ramHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(ramHeader);

            _addSymbolItemWithIcon('ram', _("Icon-White"), this.applet_path + "/icons/ram_white.svg", true);
            _addSymbolItemWithIcon('ram', _("Icon-Dark"), this.applet_path + "/icons/ram_dark.svg", true);
            _addSymbolItemWithIcon('ram', _("Kein Symbol (Textlabel)"), "", false);

            // SWAP-Symbole
            symbolSection.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const swapHeader = new PopupMenu.PopupMenuItem(_("SWAP"), { reactive: false });
            swapHeader.actor.style = "font-weight: bold;";
            symbolSection.menu.addMenuItem(swapHeader);

            _addSymbolItemWithIcon('swap', _("Icon-White"), this.applet_path + "/icons/swap_white.svg", true);
            _addSymbolItemWithIcon('swap', _("Icon-Dark"), this.applet_path + "/icons/swap_dark.svg", true);
            _addSymbolItemWithIcon('swap', _("Kein Symbol (Textlabel)"), "", false);

            this.menu.addMenuItem(symbolSection);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // 3. Systemüberwachung
            const monitorItem = new PopupMenu.PopupIconMenuItem(
                _("Systemüberwachung"),
                "utilities-system-monitor",
                St.IconType.SYMBOLIC
            );
            monitorItem.connect('activate', () => {
                Util.spawnCommandLine("gnome-system-monitor");
            });
            this.menu.addMenuItem(monitorItem);

            // 4. Neustart Cinnamon
            const restartItem = new PopupMenu.PopupIconMenuItem(
                _("Cinnamon neustarten"),
                "view-refresh-symbolic",
                St.IconType.SYMBOLIC
            );
            restartItem.connect('activate', () => {
                global.reexec_self();
            });
            this.menu.addMenuItem(restartItem);

        } catch (e) {
            global.logError("CombinedMonitor: _buildPopupMenu failed: " + e);
        }
    }

    on_applet_added_to_panel() {
        try {
            this._buildPopupMenu();
        } catch (e) {
            global.logError("CombinedMonitor: failed to build popup on add: " + e);
        }
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    // Mausrad-Funktion zum Wechseln der Layout-Variante
    _onScrollEvent(actor, event) {
        const direction = event.get_scroll_direction();
        
        if (direction === Clutter.ScrollDirection.UP) {
            this.layoutVariant = (this.layoutVariant % 6) + 1;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            this.layoutVariant = this.layoutVariant - 1;
            if (this.layoutVariant < 1) this.layoutVariant = 6;
        }
        
        try {
            if (this.settings && this.settings.setValue) {
                this.settings.setValue("layout-variant", this.layoutVariant);
            }
        } catch (e) {}
        
        this._applyOrderToBox();
        
        return true;
    }

    // ============================================================
    // UI & Logic
    // ============================================================
    _buildUI() {
        // OPTIMIERUNG: Redundante Alignment-Einstellungen entfernt.

        this._box = new St.BoxLayout({ reactive: true });
        this.actor.add_child(this._box);

        this._cpuActor = this._makeMetricActor('cpu');
        this._ramActor = this._makeMetricActor('ram');
        this._swapActor = this._makeMetricActor('swap');

        try {
            this.actor.connect('scroll-event', this._onScrollEvent.bind(this));
        } catch (e) {
            global.logError("CombinedMonitor: Could not connect scroll event: " + e);
        }

        this._applyOrderToBox();
    }

    _makeMetricActor(metric) {
        const box = new St.BoxLayout({ reactive: false, style_class: 'combined-monitor-metric' });

        const icon = new St.Icon({ visible: true, icon_size: 16 });
        // OPTIMIERUNG: Entfernung von icon.get_theme_icon(), da funktionslos

        const valueLabel = new St.Label({ text: "", y_align: Clutter.ActorAlign.CENTER });

        box._cm_icon = icon;
        box._cm_valueLabel = valueLabel;

        box.add_child(icon);
        box.add_child(valueLabel);

        return box;
    }

    _bindSettings() {
        if (!this.settings) return;

        this.settings.bind("update-interval", "updateInterval", this._onIntervalChanged.bind(this));
        this.settings.bind("layout-variant", "layoutVariant", this._applyOrderToBox.bind(this));

        this.settings.bind("show-cpu", "showCpu", this._applyOrderToBox.bind(this));
        this.settings.bind("cpu-label-text", "cpuLabel", this._applyOrderToBox.bind(this));
        this.settings.bind("cpu-symbol", "cpuSymbol", this._onSymbolChanged.bind(this));
        this.settings.bind("show-ram", "showRam", this._applyOrderToBox.bind(this));
        this.settings.bind("ram-label-text", "ramLabel", this._applyOrderToBox.bind(this));
        this.settings.bind("ram-symbol", "ramSymbol", this._onSymbolChanged.bind(this));
        this.settings.bind("show-swap", "showSwap", this._applyOrderToBox.bind(this));
        this.settings.bind("swap-label-text", "swapLabel", this._applyOrderToBox.bind(this));
        this.settings.bind("swap-symbol", "swapSymbol", this._onSymbolChanged.bind(this));
        this.settings.bind("swap-only-when-used", "swapOnlyWhenUsed", this._applyOrderToBox.bind(this));

        this.settings.bind("enable-separator", "enableSeparator", this._applyOrderToBox.bind(this));
        this.settings.bind("separator-text", "separatorText", this._applyOrderToBox.bind(this));
        this.settings.bind("separator-color", "separatorColor", this._applyOrderToBox.bind(this));
        
        // Farben und Schwellwerte
        this.settings.bind("cpu-low", "cpuLow", null);
        this.settings.bind("cpu-med", "cpuMed", null);
        this.settings.bind("cpu-high", "cpuHigh", null);
        this.settings.bind("cpu-enable-colors", "cpuColorsEnabled", this._updateNow.bind(this));
        this.settings.bind("cpu-color-low", "cpuColorLow", this._updateNow.bind(this));
        this.settings.bind("cpu-color-med", "cpuColorMed", this._updateNow.bind(this));
        this.settings.bind("cpu-color-high", "cpuColorHigh", this._updateNow.bind(this));
        this.settings.bind("cpu-color-critical", "cpuColorCritical", this._updateNow.bind(this));

        this.settings.bind("ram-low", "ramLow", null);
        this.settings.bind("ram-med", "ramMed", null);
        this.settings.bind("ram-high", "ramHigh", null);
        this.settings.bind("ram-enable-colors", "ramColorsEnabled", this._updateNow.bind(this));
        this.settings.bind("ram-color-low", "ramColorLow", this._updateNow.bind(this));
        this.settings.bind("ram-color-med", "ramColorMed", this._updateNow.bind(this));
        this.settings.bind("ram-color-high", "ramColorHigh", this._updateNow.bind(this));
        this.settings.bind("ram-color-critical", "ramColorCritical", this._updateNow.bind(this));

        this.settings.bind("swap-low", "swapLow", null);
        this.settings.bind("swap-med", "swapMed", null);
        this.settings.bind("swap-high", "swapHigh", null);
        this.settings.bind("swap-enable-colors", "swapColorsEnabled", this._updateNow.bind(this));
        this.settings.bind("swap-color-low", "swapColorLow", this._updateNow.bind(this));
        this.settings.bind("swap-color-med", "swapColorMed", this._updateNow.bind(this));
        this.settings.bind("swap-color-high", "swapColorHigh", this._updateNow.bind(this));
        this.settings.bind("swap-color-critical", "swapColorCritical", this._updateNow.bind(this));
    }

    _onSymbolChanged() {
        try {
            if (this.settings && this.settings.getValue) {
                this.cpuSymbol = this.settings.getValue("cpu-symbol") || "";
                this.ramSymbol = this.settings.getValue("ram-symbol") || "";
                this.swapSymbol = this.settings.getValue("swap-symbol") || "";
            }
        } catch (e) {}
        this._updateNow();
    }
    
    // ... (Popup-Setter unverändert)
    _setSeparatorFromPopup(sep) {
        this.separatorText = sep;
        this.enableSeparator = true;
        try {
            if (this.settings && this.settings.setValue) {
                this.settings.setValue("separator-text", sep);
                this.settings.setValue("enable-separator", true);
            }
        } catch (e) {}
        this._applyOrderToBox();
    }

    _setSymbolFromPopup(metric, symbol) {
        if (metric === 'cpu') this.cpuSymbol = symbol;
        else if (metric === 'ram') this.ramSymbol = symbol;
        else if (metric === 'swap') this.swapSymbol = symbol;

        try {
            if (this.settings && this.settings.setValue) {
                if (metric === 'cpu') this.settings.setValue("cpu-symbol", symbol);
                else if (metric === 'ram') this.settings.setValue("ram-symbol", symbol);
                else if (metric === 'swap') this.settings.setValue("swap-symbol", symbol);
            }
        } catch (e) {}

        this._updateNow();
    }


    _isPathSymbol(symbol) {
        if (!symbol) return false;
        const s = String(symbol).toLowerCase();
        return (s.indexOf("/") !== -1) || s.endsWith(".png") || s.endsWith(".svg");
    }

    _applyIconToActorBox(box, symbol) {
        if (!box) return;
        const iconWidget = box._cm_icon;
        if (!iconWidget) return;

        if (!symbol) {
            try { iconWidget.visible = false; } catch (e) {}
            return;
        }

        if (this._isPathSymbol(symbol)) {
            let path = symbol;
            if (path.indexOf("/") === 0) {
                // absolute
            } else if (path.indexOf(":") !== -1 && (path.indexOf("file://") === 0 || path.indexOf(":/") > 0)) {
                // leave as-is
            } else if (this.applet_path) {
                path = this.applet_path + "/" + path.replace(/^\.\//, "");
            }

            try {
                // Konvertiere den Pfad in einen URI, falls er ein lokaler Pfad ist, um das Laden zu verbessern
                let gicon;
                if (path.indexOf("file://") !== 0) {
                    const fileURI = GLib.filename_to_uri(path, null);
                    gicon = Gio.icon_new_for_string(fileURI);
                } else {
                    gicon = Gio.icon_new_for_string(path);
                }
                
                iconWidget.gicon = gicon;
                iconWidget.icon_size = 16;
                iconWidget.visible = true;
            } catch (e) {
                global.logError(`CombinedMonitor: Fehler beim Laden des Icons: ${e}`);
                iconWidget.visible = false;
            }
        } else {
            if (symbol.length > 1) {
                try {
                    // Annahme: Symbol ist ein Theme-Name (z.B. "utilities-system-monitor")
                    iconWidget.gicon = Gio.icon_new_for_string(symbol);
                    iconWidget.icon_size = 16;
                    iconWidget.visible = true;
                    return;
                } catch (e) {
                    iconWidget.visible = false;
                }
            }
            iconWidget.visible = false;
        }
    }

    _applyOrderToBox() {
        // OPTIMIERUNG: Sauberere Entfernung aller Kinder
        try {
            this._box.get_children().forEach(k => this._box.remove_child(k));
        } catch (e) {
            // Failsafe, falls get_children fehlschlägt
            this._box.remove_all_children();
        }

        const visible = [];

        const layouts = {
            1: ["cpu", "ram", "swap"],
            2: ["cpu", "swap", "ram"],
            3: ["ram", "cpu", "swap"],
            4: ["ram", "swap", "cpu"],
            5: ["swap", "cpu", "ram"],
            6: ["swap", "ram", "cpu"],
        };

        const variant = Number(this.layoutVariant) || 1;
        const order = layouts[variant] || layouts[1];

        const showSwapEffective = this.showSwap && (!this.swapOnlyWhenUsed || (this._lastSwapPercent && this._lastSwapPercent > 0));

        for (let part of order) {
            if (part === "cpu" && this.showCpu && visible.indexOf("cpu") === -1)
                visible.push("cpu");
            if (part === "ram" && this.showRam && visible.indexOf("ram") === -1)
                visible.push("ram");
            if (part === "swap" && showSwapEffective && visible.indexOf("swap") === -1)
                visible.push("swap");
        }

        if (visible.length === 0) {
            if (this.showCpu) visible.push("cpu");
            if (this.showRam) visible.push("ram");
            if (showSwapEffective) visible.push("swap");
        }

        for (let i = 0; i < visible.length; i++) {
            const k = visible[i];
            if (k === "cpu") this._box.add_child(this._cpuActor);
            if (k === "ram") this._box.add_child(this._ramActor);
            if (k === "swap") this._box.add_child(this._swapActor);

            if (this.enableSeparator && i < visible.length - 1) {
                const sep = new St.Label({ 
                    text: this.separatorText || "|", 
                    y_align: Clutter.ActorAlign.CENTER 
                });
                sep.style = `padding-left:4px;padding-right:4px; color: ${this.separatorColor};`;
                this._box.add_child(sep);
            }
        }
    }

    _onIntervalChanged() {
        this._restartLoop();
    }

    _start() {
        this._restartLoop();
    }

    _restartLoop() {
        if (this._timeoutId) {
            try { GLib.source_remove(this._timeoutId); } catch (e) {}
            this._timeoutId = 0;
        }

        this._updateNow();

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.updateInterval, () => {
            this._updateNow();
            return true;
        });
    }

    _pickColor(value, low, med, high, cLow, cMed, cHigh, cCrit) {
        if (value <= low) return cLow;
        if (value <= med) return cMed;
        if (value <= high) return cHigh;
        return cCrit;
    }

    _updateMetric(metric, percent) {
        let box = null;
        let symbol = "";
        let colorsEnabled = true;
        let low = 0, med = 0, high = 0, cLow = "#fff", cMed = "#fff", cHigh = "#fff", cCrit = "#fff";

        if (metric === 'cpu') {
            box = this._cpuActor;
            symbol = this.cpuSymbol;
            colorsEnabled = this.cpuColorsEnabled;
            low = this.cpuLow; med = this.cpuMed; high = this.cpuHigh;
            cLow = this.cpuColorLow; cMed = this.cpuColorMed; cHigh = this.cpuColorHigh; cCrit = this.cpuColorCritical;
        } else if (metric === 'ram') {
            box = this._ramActor;
            symbol = this.ramSymbol;
            colorsEnabled = this.ramColorsEnabled;
            low = this.ramLow; med = this.ramMed; high = this.ramHigh;
            cLow = this.ramColorLow; cMed = this.ramColorMed; cHigh = this.ramColorHigh; cCrit = this.ramColorCritical;
        } else if (metric === 'swap') {
            box = this._swapActor;
            symbol = this.swapSymbol;
            colorsEnabled = this.swapColorsEnabled;
            low = this.swapLow; med = this.swapMed; high = this.swapHigh;
            cLow = this.swapColorLow; cMed = this.swapColorMed; cHigh = this.swapColorHigh; cCrit = this.swapColorCritical;
        }

        if (!box) return;

        try {
            this._applyIconToActorBox(box, symbol);
        } catch (e) {}

        const iconWidget = box._cm_icon;
        const valueLabel = box._cm_valueLabel;

        let leftText = "";
        if (!symbol) {
            leftText = (metric === 'cpu') ? this.cpuLabel : (metric === 'ram' ? this.ramLabel : this.swapLabel);
        } else if (this._isPathSymbol(symbol)) {
            leftText = "";
        } else {
            leftText = symbol;
        }

        const text = `${leftText} ${percent}%`.trim();
        try {
            valueLabel.set_text(text);
        } catch (e) {}

        const col = this._pickColor(percent, low, med, high, cLow, cMed, cHigh, cCrit);
        let style = "padding-left:4px;padding-right:4px;";
        if (colorsEnabled) style += ` color: ${col};`;
        try { valueLabel.style = style; } catch (e) {}
    }

    _updateNow() {
        const cpu = this._readCpu();
        const memswap = this._readMemSwap();

        this._lastSwapPercent = memswap.swapPercent;

        this._updateMetric('cpu', cpu);
        this._updateMetric('ram', memswap.memPercent);
        this._updateMetric('swap', memswap.swapPercent);

        if (this.swapOnlyWhenUsed)
            this._applyOrderToBox();
    }

    _readProcStatRaw() {
        try {
            const [ok, contents] = GLib.file_get_contents(PROC_STAT);
            if (!ok) return null;
            const text = imports.byteArray.toString(contents);
            return text.split("\n")[0].trim().split(/\s+/);
        } catch (e) {
            return null;
        }
    }

    _readCpu() {
        try {
            const parts = this._readProcStatRaw();
            if (!parts) return 0;
            const user = parseInt(parts[1]) || 0;
            const nice = parseInt(parts[2]) || 0;
            const sys = parseInt(parts[3]) || 0;
            const idle = parseInt(parts[4]) || 0;
            const total = user + nice + sys + idle;

            if (!this._prevTotal) {
                this._prevTotal = total;
                this._prevIdle = idle;
                return 0;
            }

            const dt = total - this._prevTotal;
            const di = idle - this._prevIdle;
            this._prevTotal = total;
            this._prevIdle = idle;
            if (dt <= 0) return 0;
            return Math.round((1 - di / dt) * 100);
        } catch (e) {
            return 0;
        }
    }

    _readMemSwap() {
        try {
            const [ok, contents] = GLib.file_get_contents(PROC_MEM);
            if (!ok) return { memPercent: 0, swapPercent: 0 };
            const text = imports.byteArray.toString(contents);
            const lines = text.split("\n");
            let memTotal = 0, memAvailable = 0, swapTotal = 0, swapFree = 0;

            for (let l of lines) {
                // OPTIMIERUNG: Nutzt split(/\s+/) statt dem langsameren RegEx /\D+/g
                const parts = l.trim().split(/\s+/);

                if (parts[0] === "MemTotal:") memTotal = parseInt(parts[1]) || memTotal;
                if (parts[0] === "MemAvailable:") memAvailable = parseInt(parts[1]) || memAvailable;
                if (parts[0] === "SwapTotal:") swapTotal = parseInt(parts[1]) || swapTotal;
                if (parts[0] === "SwapFree:") swapFree = parseInt(parts[1]) || swapFree;
            }

            const memPercent = memTotal ? Math.round(((memTotal - memAvailable) / memTotal) * 100) : 0;
            const swapPercent = swapTotal ? Math.round(((swapTotal - swapFree) / swapTotal) * 100) : 0;
            return { memPercent, swapPercent };
        } catch (e) {
            return { memPercent: 0, swapPercent: 0 };
        }
    }

    on_applet_removed_from_panel() {
        if (this._timeoutId) {
            try { GLib.source_remove(this._timeoutId); } catch (e) {}
            this._timeoutId = 0;
        }
        try {
            // Saubere Zerstörung der Menu-Elemente
            if (this.menuManager && this.menu) {
                this.menuManager.removeMenu(this.menu);
                this.menu = null;
            }
        } catch (e) {}
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new CombinedMonitorApplet(metadata, orientation, panelHeight, instanceId);
}
