const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

const HELP_TEXT = `For long-term battery health, keep a lithium-ion battery between 20% and 80% during daily use, and store it at around 50% if setting it aside for an extended period.

Daily Use: 20%–80%

• Avoid staying at 100%: High voltage stresses the battery and speeds up chemical wear, especially if left plugged in overnight.
• Avoid deep drains: Dropping near 0% regularly increases internal resistance and adds stress.
• Use charge limits: Many devices let you cap maximum charge around 80%–85% (such as through Apple Support charge limits or Samsung Galaxy battery protection) to reduce wear while still leaving daily buffer.

Long-Term Storage: ~50%

• Middle ground reduces stress: Holding a battery near 50% keeps voltage balanced and minimizes chemical degradation while sitting unused.

Please visit us at <a href="https://xlets.ca">www.xlets.ca</a>`;

class BatterySaverApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._metadata = metadata;
        this._orientation = orientation;
        this.set_applet_icon_symbolic_name("battery-good-symbolic");
        this.set_applet_tooltip("Battery Saviour Charge Thresholds");

        this.detectedLaptop = this._detectLaptop();

        // Bind settings (adds 'Configure...' automatically to right-click menu)
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("brand", "brand", null);
        this.settings.bind("min-charge", "minCharge", null);
        this.settings.bind("max-charge", "maxCharge", null);
        this.settings.bind("icon-size", "iconSize", this._onAppearanceChanged.bind(this));
        this.settings.bind("opacity", "appletOpacity", this._onAppearanceChanged.bind(this));
        this.settings.bind("popup-text-color", "popupTextColor", this._onAppearanceChanged.bind(this));
        this.settings.bind("popup-background-color", "popupBackgroundColor", this._onAppearanceChanged.bind(this));
        this.settings.bind("apply-button-text-color", "applyButtonTextColor", this._onAppearanceChanged.bind(this));
        this.settings.bind("apply-button-background-color", "applyButtonBackgroundColor", this._onAppearanceChanged.bind(this));

        this._updateConfigurationLabel();

        // Add 'Help' at the top of the right-click context menu
        let helpItem = new PopupMenu.PopupMenuItem("Why Battery Saviour?");
        helpItem.connect("activate", () => this._showHelp());
        this._applet_context_menu.addMenuItem(helpItem, 0);

        // Build left-click popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildPopupUI();
        this.menu.connect("open-state-changed", (menu, isOpen) => {
            if (isOpen) {
                this._applyAppearance();
                this._keepMenuAbovePanel();
                Mainloop.idle_add(() => {
                    if (this.menu && this.menu.isOpen) {
                        this._keepMenuAbovePanel();
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        });
        this._applyAppearance();
    }

    _readFileTrimmed(path) {
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            return "";
        }

        try {
            const [ok, contents] = GLib.file_get_contents(path);
            if (!ok || !contents) {
                return "";
            }
            const decoded = ByteArray.toString(contents)
                .replace(/\u0000/g, "")
                .trim();
            if (/^(to be filled by o\.e\.m\.|default string|not specified|none|unknown|system manufacturer|system product name)$/i.test(decoded)) {
                return "";
            }
            return decoded;
        } catch (e) {
            global.logError(`Battery Saviour: unable to read ${path}: ${e}`);
            return "";
        }
    }

    _runSyncCommand(argv) {
        try {
            const [ok, stdout] = GLib.spawn_sync(
                null,
                argv,
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );
            if (ok && stdout) {
                return ByteArray.toString(stdout).trim();
            }
        } catch (e) {
            // Ignore command failure and fall back to other probes
        }
        return "";
    }

    _brandFromIdentity(identity) {
        const normalizedIdentity = String(identity || "").toLowerCase();

        if (/think[\s_-]*pad|thinkbook/.test(normalizedIdentity))
            return "thinkpad";
        if (/lenovo|ideapad|legion|yoga|loq/.test(normalizedIdentity))
            return "lenovo";
        if (/asus|asustek|zenbook|vivobook|rog\b|tuf\b/.test(normalizedIdentity))
            return "asus";
        if (/dell|latitude|xps\b|inspiron|precision|vostro|alienware/.test(normalizedIdentity))
            return "dell";
        if (/hewlett|(^|[^a-z])hp([^a-z]|$)|elitebook|probook|pavilion|envy|spectre|omen|victus|zbook/.test(normalizedIdentity))
            return "hp";
        if (/acer|aspire|predator|nitro|swift|travelmate/.test(normalizedIdentity))
            return "acer";
        if (/msi|micro-star|katana|stealth|raider|cyborg|prestige|modern/.test(normalizedIdentity))
            return "msi";

        return "";
    }

    _detectBrandFromDrivers() {
        const driverChecks = [
            { brand: "thinkpad", paths: ["/sys/bus/platform/drivers/thinkpad_acpi", "/sys/devices/platform/thinkpad_acpi"] },
            { brand: "lenovo", paths: ["/sys/bus/platform/drivers/ideapad_acpi", "/sys/bus/platform/drivers/legion_laptop"] },
            { brand: "asus", paths: ["/sys/bus/platform/drivers/asus-nb-wmi", "/sys/bus/platform/drivers/asus_laptop"] },
            { brand: "dell", paths: ["/sys/bus/platform/drivers/dell-laptop", "/sys/bus/platform/drivers/dell_smm_hwmon"] },
            { brand: "hp", paths: ["/sys/bus/platform/drivers/hp-wmi"] },
            { brand: "acer", paths: ["/sys/bus/platform/drivers/acer-wmi", "/sys/bus/wmi/drivers/acer-wmi-battery"] },
            { brand: "msi", paths: ["/sys/bus/platform/drivers/msi-laptop", "/sys/bus/platform/drivers/msi-ec"] }
        ];

        for (let entry of driverChecks) {
            for (let p of entry.paths) {
                if (GLib.file_test(p, GLib.FileTest.EXISTS)) {
                    return entry.brand;
                }
            }
        }
        return "";
    }

    _readDmiField(field) {
        const bases = ["/sys/class/dmi/id", "/sys/devices/virtual/dmi/id"];
        for (let base of bases) {
            const val = this._readFileTrimmed(`${base}/${field}`);
            if (val) {
                return val;
            }
        }
        return "";
    }

    _detectLaptop() {
        let vendor = this._readDmiField("sys_vendor")
            || this._readDmiField("board_vendor")
            || this._readDmiField("chassis_vendor");
        let model = this._readDmiField("product_name")
            || this._readDmiField("product_version")
            || this._readDmiField("board_name");
        let family = this._readDmiField("product_family");
        const modalias = this._readDmiField("modalias");

        if (!vendor || !model) {
            const hostInfo = this._runSyncCommand(["hostnamectl"]);
            if (hostInfo) {
                const vendorMatch = hostInfo.match(/Hardware Vendor:\s*(.+)/i);
                const modelMatch = hostInfo.match(/Hardware Model:\s*(.+)/i);
                if (!vendor && vendorMatch && vendorMatch[1]) {
                    vendor = vendorMatch[1].trim();
                }
                if (!model && modelMatch && modelMatch[1]) {
                    model = modelMatch[1].trim();
                }
            }
        }

        const description = [vendor, family, model, modalias].filter(Boolean).join(" ");
        let brand = this._brandFromIdentity(description);
        if (!brand) {
            brand = this._detectBrandFromDrivers();
        }

        return {
            vendor: vendor || (brand ? this._formatBrandName(brand) : "Unknown manufacturer"),
            model: model || "",
            family: family,
            brand: brand
        };
    }

    _detectedSummaryText() {
        const brandName = this.detectedLaptop.brand
            ? this._formatBrandName(this.detectedLaptop.brand)
            : "Unknown";
        const hardwareParts = [];
        if (this.detectedLaptop.vendor && this.detectedLaptop.vendor !== "Unknown manufacturer") {
            hardwareParts.push(this.detectedLaptop.vendor);
        }
        if (this.detectedLaptop.family && hardwareParts.join(" ").toLowerCase().indexOf(this.detectedLaptop.family.toLowerCase()) === -1) {
            hardwareParts.push(this.detectedLaptop.family);
        }
        if (this.detectedLaptop.model && hardwareParts.join(" ").toLowerCase().indexOf(this.detectedLaptop.model.toLowerCase()) === -1) {
            hardwareParts.push(this.detectedLaptop.model);
        }
        const hardwareDetail = hardwareParts.join(" ");
        return hardwareDetail && hardwareDetail.toLowerCase() !== brandName.toLowerCase()
            ? `${brandName} (${hardwareDetail})`
            : brandName;
    }

    _getCandidateSchemaPaths() {
        const paths = [];
        if (this._metadata && this._metadata.path) {
            paths.push(`${this._metadata.path}/settings-schema.json`);
        }
        if (this._metadata && this._metadata.uuid) {
            paths.push(`${GLib.get_home_dir()}/.local/share/cinnamon/applets/${this._metadata.uuid}/settings-schema.json`);
        }
        return paths;
    }

    _updateConfigurationLabel() {
        const labelText = `Detected Manufacturer: ${this._detectedSummaryText()}`;
        const schemaPaths = this._getCandidateSchemaPaths();

        for (let schemaPath of schemaPaths) {
            if (!GLib.file_test(schemaPath, GLib.FileTest.EXISTS)) {
                continue;
            }
            try {
                const [ok, raw] = GLib.file_get_contents(schemaPath);
                if (!ok || !raw) {
                    continue;
                }
                const schemaObj = JSON.parse(ByteArray.toString(raw));
                if (schemaObj && schemaObj["detected-manufacturer"]) {
                    if (schemaObj["detected-manufacturer"].description !== labelText) {
                        schemaObj["detected-manufacturer"].description = labelText;
                        GLib.file_set_contents(schemaPath, JSON.stringify(schemaObj, null, 4));
                    }
                    break;
                }
            } catch (e) {
                global.logError(`Battery Saviour: unable to update settings-schema.json: ${e}`);
            }
        }
    }

    _showHelp() {
        try {
            Util.spawn([
                "zenity",
                "--info",
                "--title=Battery Health Guide",
                "--width=480",
                "--text=" + HELP_TEXT
            ]);
        } catch (e) {
            try {
                Util.spawn(["notify-send", "-t", "15000", "Battery Health Guide", HELP_TEXT]);
            } catch (err) {
                global.logError("BatterySaviour Help error: " + err);
            }
        }
    }

    _buildPopupUI() {
        this.menu.removeAll();

        // Max Charge Label & Slider
        this.maxLabel = new PopupMenu.PopupMenuItem(
            `Max Charge: ${this.maxCharge}%`,
            { reactive: false }
        );
        this.menu.addMenuItem(this.maxLabel);

        this.maxSlider = new PopupMenu.PopupSliderMenuItem(this.maxCharge / 100);
        this._makeSliderCompact(this.maxSlider);
        this.maxSlider.connect("value-changed", (slider, value) => {
            let pct = Math.round(value * 100);
            if (pct < this.minCharge) {
                pct = this.minCharge;
                slider.setValue(pct / 100);
            }
            this.maxCharge = pct;
            this.maxLabel.label.set_text(`Max Charge: ${this.maxCharge}%`);
        });
        this.menu.addMenuItem(this.maxSlider);

        // Min Charge Label & Slider
        this.minLabel = new PopupMenu.PopupMenuItem(
            `Min Charge: ${this.minCharge}%`,
            { reactive: false }
        );
        this.menu.addMenuItem(this.minLabel);

        this.minSlider = new PopupMenu.PopupSliderMenuItem(this.minCharge / 100);
        this._makeSliderCompact(this.minSlider);
        this.minSlider.connect("value-changed", (slider, value) => {
            let pct = Math.round(value * 100);
            if (pct > this.maxCharge) {
                pct = this.maxCharge;
                slider.setValue(pct / 100);
            }
            this.minCharge = pct;
            this.minLabel.label.set_text(`Min Charge: ${this.minCharge}%`);
        });
        this.menu.addMenuItem(this.minSlider);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Apply Thresholds button inside a non-reactive menu item
        this.applyButtonItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.applyButton = new St.Button({
            label: "Apply Thresholds",
            reactive: true,
            can_focus: true
        });
        this.applyButton.connect("clicked", () => {
            this.menu.close(false);
            this._applyThresholds();
        });

        this.applyButtonBox = new St.BoxLayout({ vertical: false });
        this.applyButtonBox.add(this.applyButton, { expand: true, x_fill: false, x_align: St.Align.MIDDLE });

        if (typeof this.applyButtonItem.addActor === "function") {
            this.applyButtonItem.addActor(this.applyButtonBox, { expand: true, span: -1, align: St.Align.MIDDLE });
        } else if (typeof this.applyButtonItem.add_child === "function") {
            this.applyButtonItem.add_child(this.applyButtonBox);
        } else if (this.applyButtonItem.actor) {
            this.applyButtonItem.actor.add_child(this.applyButtonBox);
        }

        this.menu.addMenuItem(this.applyButtonItem);
    }

    _keepMenuAbovePanel() {
        if (!this.menu || !this.menu.actor || !this.menu.isOpen) {
            return;
        }

        let panelHeight = 0;
        let panelPosition = St.Side.BOTTOM;
        if (this.panel) {
            if (typeof this.panel.height === "number") {
                panelHeight = this.panel.height;
            } else if (this.panel.actor) {
                panelHeight = this.panel.actor.height || 0;
            }
            if (typeof this.panel.panelPosition !== "undefined") {
                panelPosition = this.panel.panelPosition;
            }
        }
        if (panelHeight <= 0) {
            panelHeight = 40;
        }

        let monitor = Main.layoutManager.findMonitorForActor(this.actor) || Main.layoutManager.primaryMonitor;
        if (!monitor) {
            return;
        }

        let [, menuHeight] = this.menu.actor.get_preferred_height(-1);
        let actualHeight = Math.max(menuHeight || 0, this.menu.actor.height || 0);
        if (actualHeight <= 0) {
            return;
        }

        if (panelPosition === St.Side.BOTTOM || this._orientation === St.Side.BOTTOM) {
            let maxBottomY = monitor.y + monitor.height - panelHeight - 6;
            if (this.menu.actor.y + actualHeight > maxBottomY) {
                this.menu.actor.set_position(this.menu.actor.x, Math.max(monitor.y + 6, maxBottomY - actualHeight));
            }
        } else if (panelPosition === St.Side.TOP || this._orientation === St.Side.TOP) {
            let minTopY = monitor.y + panelHeight + 6;
            if (this.menu.actor.y < minTopY) {
                this.menu.actor.set_position(this.menu.actor.x, minTopY);
            }
        }
    }

    _formatBrandName(brand) {
        const names = {
            auto: "Automatic",
            lenovo: "Lenovo",
            thinkpad: "ThinkPad",
            dell: "Dell",
            asus: "ASUS",
            hp: "HP",
            acer: "Acer",
            msi: "MSI"
        };
        return names[brand] || brand;
    }

    _activeBrand() {
        const selectedBrand = this._selectedBrand();
        return selectedBrand === "auto" ? this.detectedLaptop.brand : selectedBrand;
    }

    _selectedBrand() {
        return this._normalizeBrand(this.settings.getValue("brand"));
    }

    _normalizeBrand(brand) {
        const normalizedBrand = String(brand || "").toLowerCase().replace(/[^a-z]/g, "");

        if (!normalizedBrand || normalizedBrand === "auto" || normalizedBrand === "automaticdetected")
            return "auto";
        if (normalizedBrand.indexOf("thinkpad") !== -1)
            return "thinkpad";
        if (normalizedBrand.indexOf("lenovo") !== -1)
            return "lenovo";
        if (normalizedBrand.indexOf("asus") !== -1)
            return "asus";
        if (normalizedBrand.indexOf("dell") !== -1)
            return "dell";
        if (normalizedBrand === "hp" || normalizedBrand.indexOf("hewlettpackard") !== -1)
            return "hp";
        if (normalizedBrand.indexOf("acer") !== -1)
            return "acer";
        if (normalizedBrand.indexOf("msi") !== -1 || normalizedBrand.indexOf("microstar") !== -1)
            return "msi";

        return normalizedBrand;
    }

    _detectedBrand() {
        const identity = [
            this.detectedLaptop.vendor,
            this.detectedLaptop.family,
            this.detectedLaptop.model
        ].join(" ");
        const identityBrand = this._brandFromIdentity(identity);
        if (identityBrand)
            return identityBrand;

        const configuredBrand = this._normalizeBrand(this.detectedLaptop.brand);
        return ["lenovo", "thinkpad", "asus", "dell", "hp", "acer", "msi"].indexOf(configuredBrand) !== -1
            ? configuredBrand
            : "";
    }

    _isBrandMismatch() {
        const selectedBrand = this._selectedBrand();
        if (!selectedBrand || selectedBrand === "auto")
            return false;

        const detectedBrand = this._detectedBrand();
        if (!detectedBrand)
            return true;

        const isLenovoBrand = brand => brand === "lenovo" || brand === "thinkpad";
        return selectedBrand !== detectedBrand &&
            !(isLenovoBrand(selectedBrand) && isLenovoBrand(detectedBrand));
    }

    _colorToRgba(color, fallbackHex, alpha) {
        const validColor = this._validCssColor(color, fallbackHex);
        const a = Math.max(0, Math.min(1, alpha)).toFixed(2);

        const rgbMatch = validColor.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
        if (rgbMatch) {
            return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${a})`;
        }

        const hex = validColor.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    _applyAppearance() {
        if (!this.menu)
            return;

        const scalePercent = Number(this.iconSize) || 100;
        const popupScale = scalePercent / 100;
        const opacityPercent = typeof this.appletOpacity === "number" ? this.appletOpacity : Number(this.appletOpacity);
        const safeOpacity = isNaN(opacityPercent) ? 100 : Math.max(0, Math.min(100, opacityPercent));
        const alpha = safeOpacity / 100.0;
        const clutterAlpha = Math.round(alpha * 255);

        const textColor = this._validCssColor(this.popupTextColor, "#ffffff");
        const rgbaBackground = this._colorToRgba(this.popupBackgroundColor, "#2e3436", alpha);
        const btnTextColor = this._validCssColor(this.applyButtonTextColor, "#ffffff");
        const btnBgColor = this._validCssColor(this.applyButtonBackgroundColor, "#333333");

        const popupWidth = Math.round(280 * popupScale);
        const sliderWidth = Math.round(180 * popupScale);
        const padV = Math.max(4, Math.round(10 * popupScale));
        const padH = Math.max(6, Math.round(14 * popupScale));
        const fontSize = Math.max(7, Math.round(10 * popupScale));
        const btnPadV = Math.max(3, Math.round(6 * popupScale));
        const btnPadH = Math.max(8, Math.round(16 * popupScale));
        const btnRadius = Math.max(2, Math.round(4 * popupScale));

        if (this.menu.actor) {
            this.menu.actor.style_class = "";
            this.menu.actor.style = "background-color: transparent; border: none; box-shadow: none;";
            if (typeof this.menu.actor.set_opacity === "function") {
                this.menu.actor.set_opacity(clutterAlpha);
            }
        }

        if (this.menu._boxPointer) {
            this.menu._boxPointer.style_class = "";
            this.menu._boxPointer.style = "-arrow-background-color: transparent; -arrow-border-color: transparent; background-color: transparent;";
            if (this.menu._boxPointer.bin) {
                this.menu._boxPointer.bin.style_class = "";
                this.menu._boxPointer.bin.style = "background-color: transparent;";
            }
        }

        let menuBox = this.menu.box || this.menu;
        if (menuBox) {
            menuBox.style_class = "";
            menuBox.style = `background-color: ${rgbaBackground}; color: ${textColor}; padding: ${padV}px ${padH}px; border-radius: 6px; width: ${popupWidth}px; min-width: ${popupWidth}px;`;
        }

        [this.maxLabel, this.minLabel].forEach(item => {
            if (!item) return;
            let target = item.actor ? item.actor : item;
            target.style_class = "";
            target.style = `background-color: transparent; color: ${textColor}; padding: 2px 6px; font-weight: normal; font-size: ${fontSize}pt;`;
            if (item.label) {
                item.label.set_style(`color: ${textColor}; font-weight: normal; font-size: ${fontSize}pt;`);
            }
        });

        [this.maxSlider, this.minSlider].forEach(item => {
            if (!item) return;
            let target = item.actor ? item.actor : item;
            target.style_class = "";
            target.style = "background-color: transparent; padding: 2px 6px; min-height: 18px;";
            if (item._slider) {
                const sliderHeight = Math.max(10, Math.round(16 * popupScale));
                const trackHeight = Math.max(2, Math.round(4 * popupScale));
                const handleRadius = Math.max(4, Math.round(6 * popupScale));
                item._slider.set_style(
                    `width: ${sliderWidth}px; min-width: ${sliderWidth}px; max-width: ${sliderWidth}px; height: ${sliderHeight}px; min-height: ${sliderHeight}px; -slider-height: ${trackHeight}px; -slider-handle-radius: ${handleRadius}px; -slider-border-width: 1px;`
                );
                item._slider.queue_repaint();
            }
        });

        if (this.applyButtonItem) {
            let itemTarget = this.applyButtonItem.actor ? this.applyButtonItem.actor : this.applyButtonItem;
            itemTarget.style_class = "";
            itemTarget.style = "background-color: transparent; padding: 4px 0px 2px 0px;";
        }

        if (this.applyButtonBox) {
            this.applyButtonBox.set_style(`width: ${popupWidth - (padH * 2)}px;`);
        }

        if (this.applyButton) {
            this.applyButton.style_class = "";
            this.applyButton.set_style(
                `background-color: ${btnBgColor}; color: ${btnTextColor}; padding: ${btnPadV}px ${btnPadH}px; border-radius: ${btnRadius}px; text-align: center; font-weight: normal; font-size: ${fontSize}pt;`
            );
        }
    }

    _validCssColor(color, fallback) {
        if (typeof color !== "string")
            return fallback;

        const value = color.trim();
        const isHex = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value);
        const isRgb = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value);
        return isHex || isRgb ? value : fallback;
    }

    _makeSliderCompact(slider) {
        slider.actor.set_style("background-color: transparent; padding: 2px 6px; min-height: 18px;");
        slider._slider.set_style(
            "width: 180px; min-width: 180px; max-width: 180px; height: 16px; min-height: 16px; -slider-height: 4px; -slider-handle-radius: 6px; -slider-border-width: 1px;"
        );
        slider._children[0].expand = false;
        slider._children[0].align = St.Align.MIDDLE;
    }

    _onAppearanceChanged() {
        this._applyAppearance();
    }

    _confirmMismatchDialog(detectedModel, selectedBrandName) {
        let dialog = new ModalDialog.ModalDialog();

        let contentBox = new St.BoxLayout({
            vertical: true,
            style: "padding: 16px; spacing: 12px; max-width: 420px;"
        });

        let titleLabel = new St.Label({
            text: "Manufacturer Mismatch Warning",
            style: "font-weight: bold; font-size: 13pt;"
        });

        let bodyLabel = new St.Label({
            text: this._detectedBrand()
                ? `Your selected manufacturer (${selectedBrandName}) does not match your detected system (${detectedModel}).\n\nApplying controls for a different manufacturer may fail or behave unexpectedly. Do you want to continue?`
                : `Your laptop manufacturer could not be detected (${detectedModel}). The selected controls (${selectedBrandName}) may not match your laptop and could fail or behave unexpectedly. Do you want to continue?`
        });
        bodyLabel.clutter_text.line_wrap = true;

        contentBox.add_child(titleLabel);
        contentBox.add_child(bodyLabel);
        dialog.contentLayout.add_child(contentBox);

        dialog.setButtons([
            {
                label: "No",
                key: Clutter.KEY_Escape,
                action: () => {
                    dialog.close();
                }
            },
            {
                label: "Continue",
                action: () => {
                    dialog.close();
                    this._applyThresholdsNow();
                }
            }
        ]);
        dialog.open();
    }

    _applyThresholds() {
        if (this._isBrandMismatch()) {
            const detectedModel = [
                this.detectedLaptop.vendor,
                this.detectedLaptop.family,
                this.detectedLaptop.model
            ].filter(Boolean).join(" ");
            const selectedBrandName = this._formatBrandName(this._selectedBrand());
            this._confirmMismatchDialog(detectedModel, selectedBrandName);
            return;
        }
        this._applyThresholdsNow();
    }

    _applyThresholdsNow() {
        const min = this.minCharge;
        const max = this.maxCharge;
        const brand = this._activeBrand();
        const brandLabel = this._formatBrandName(brand);
        let cmd = "";

        switch (brand) {
            case "thinkpad":
                cmd = `if [ -f /sys/class/power_supply/BAT0/charge_control_start_threshold ] && [ -f /sys/class/power_supply/BAT0/charge_control_end_threshold ]; then echo 0 > /sys/class/power_supply/BAT0/charge_control_start_threshold && echo ${max} > /sys/class/power_supply/BAT0/charge_control_end_threshold && echo ${min} > /sys/class/power_supply/BAT0/charge_control_start_threshold; else echo "ThinkPad battery controls not found" >&2; exit 1; fi`;
                break;
            case "lenovo":
                let mode = max < 80 ? 1 : 0;
                cmd = `found=0; for f in /sys/bus/platform/drivers/ideapad_acpi/*/conservation_mode; do if [ -f "$f" ]; then echo ${mode} > "$f" && found=1; fi; done; [ "$found" -eq 1 ] || { echo "Lenovo conservation_mode not found" >&2; exit 1; }`;
                break;
            case "asus":
                cmd = `found=0; for b in /sys/class/power_supply/BAT*; do if [ -f "$b/charge_control_end_threshold" ]; then echo ${max} > "$b/charge_control_end_threshold" && found=1; fi; done; [ "$found" -eq 1 ] || { echo "ASUS charge_control_end_threshold not found" >&2; exit 1; }`;
                break;
            case "dell":
                cmd = `if command -v cctk >/dev/null 2>&1; then cctk --PrimaryBattChargeCfg=Custom:${min}-${max}; else found=0; for b in /sys/class/power_supply/BAT*; do if [ -f "$b/charge_control_start_threshold" ] && [ -f "$b/charge_control_end_threshold" ]; then echo 0 > "$b/charge_control_start_threshold" && echo ${max} > "$b/charge_control_end_threshold" && echo ${min} > "$b/charge_control_start_threshold" && found=1; fi; done; [ "$found" -eq 1 ] || { echo "Dell battery controls not found" >&2; exit 1; }; fi`;
                break;
            case "hp":
                cmd = `found=0; for b in /sys/class/power_supply/BAT*; do if [ -f "$b/charge_control_end_threshold" ]; then echo ${max} > "$b/charge_control_end_threshold" && found=1; fi; done; [ "$found" -eq 1 ] || { echo "HP charge_control_end_threshold not found" >&2; exit 1; }`;
                break;
            case "acer":
                let acerMode = max <= 80 ? 1 : 0;
                cmd = `found=0; for f in /sys/bus/wmi/drivers/acer-wmi-battery/*/health_mode /sys/bus/platform/drivers/acer-wmi/*/health_mode; do if [ -f "$f" ]; then echo ${acerMode} > "$f" && found=1; fi; done; [ "$found" -eq 1 ] || { echo "Acer health_mode not found" >&2; exit 1; }`;
                break;
            case "msi":
                cmd = `found=0; for b in /sys/class/power_supply/BAT*; do if [ -f "$b/charge_control_start_threshold" ] && [ -f "$b/charge_control_end_threshold" ]; then echo 0 > "$b/charge_control_start_threshold" && echo ${max} > "$b/charge_control_end_threshold" && echo ${min} > "$b/charge_control_start_threshold" && found=1; fi; done; [ "$found" -eq 1 ] || { echo "MSI battery controls not found" >&2; exit 1; }`;
                break;
        }

        if (!cmd) {
            Main.notifyError("Battery Saviour", "Laptop brand could not be detected. Select a brand manually in the applet settings.");
            return;
        }

        try {
            let proc = Gio.Subprocess.new(
                ["pkexec", "sh", "-c", cmd],
                Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, (source, res) => {
                try {
                    let [, , stderr] = source.communicate_utf8_finish(res);
                    if (source.get_successful()) {
                        Main.notify("Battery Saviour", `Applied ${min}% - ${max}% for ${brandLabel}`);
                    } else {
                        let detail = (stderr || "").trim();
                        if (detail.indexOf("dismissed") !== -1 || detail.indexOf("Not authorized") !== -1) {
                            Main.notifyError("Battery Saviour", "Authentication cancelled or failed.");
                        } else {
                            Main.notifyError("Battery Saviour", detail || `Failed to apply thresholds for ${brandLabel}.`);
                        }
                    }
                } catch (err) {
                    Main.notifyError("Battery Saviour", `Error: ${err.message}`);
                }
            });
        } catch (e) {
            Main.notifyError("Battery Saviour", `Failed to launch authentication: ${e.message}`);
        }
    }

    on_applet_clicked() {
        this.detectedLaptop = this._detectLaptop();
        this._updateConfigurationLabel();
        this._applyAppearance();
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new BatterySaverApplet(metadata, orientation, panelHeight, instanceId);
}
