const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Gettext = imports.gettext;

const Me = imports.ui.appletManager.applets['BudsLink-Companion@maniacx.github.com'];

const {BatterySetWidget} = Me.lib.batterySetWidget;
const {ToggleButtonsSet} = Me.lib.toggleButtonsSet;
const {OptionsBox} = Me.lib.optionsBox;
const {Tooltip} = Me.lib.tooltip;
const {LabelIndicators} = Me.lib.labelIndicators;

const _ = str => Gettext.dgettext('BudsLink-Companion@maniacx.github.com', str);

var PopupMenuWidgetBox = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_PopupMenuWidgetBox',
}, class PopupMenuWidgetBox extends St.BoxLayout {
    _init(settings, gIcon, path, alias, widgetInfo, colorInfo, headerButtons, dataHandler) {
        super._init({vertical: true, x_expand: true, style_class: 'bbm-popup-menu-box'});
        this._settings = settings;
        this._gIcon = gIcon;
        this._dataHandler = dataHandler;
        this._config = this._dataHandler.getConfig();
        this._showCollapseButton = headerButtons.collapse;
        this._showBtPairButton = headerButtons.btPair;
        this._showPinButton = headerButtons.pin;
        this._showSettingsButton = this._config.showSettingsButton && !widgetInfo.isUnlockSession;

        const showTooltips = true;
        if (showTooltips)
            this._tooltip = new Tooltip(this);

        const titleHbox = new St.BoxLayout({style_class: 'bbm-popup-titlebox', x_expand: true});
        this.add_child(titleHbox);

        const modelLabel = new St.Label({
            style_class: 'bbm-popup-title',
            y_align: Clutter.ActorAlign.CENTER,
        });
        modelLabel.text = alias;
        titleHbox.add_child(modelLabel);

        let headerButton;
        if (this._showCollapseButton || this._showBtPairButton ||
                this._showPinButton || this._showSettingsButton) {
            const spacer = new St.Bin({x_expand: true, style_class: 'bbm-popupmenu-expander'});
            titleHbox.add_child(spacer);

            headerButton = buttonName => {
                const icon = new St.Icon({style_class: 'bbm-header-icon'});
                const button = new St.Button({
                    style_class: 'button bbm-header-button',
                    can_focus: true,
                    child: icon,
                });
                button.icon = icon;
                button.accessible_name = buttonName;
                this._tooltip?.attach(button, buttonName);
                const bin = new St.Bin({
                    style_class: 'bbm-header-bin',
                    y_align: Clutter.ActorAlign.CENTER,
                    child: button,
                });
                button.bin = bin;
                return button;
            };
        }

        if (this._showPinButton) {
            this._pinButton = headerButton(_('Pin to panel'));
            titleHbox.add_child(this._pinButton.bin);
            this._path = path;
            const selectedPath = this._settings.getValue('default-selected-path');

            this._pinButton.connectObject('clicked', () => {
                widgetInfo.cbPinned(path);
            }, this);

            this.updatePinButton(selectedPath);
        }

        if (this._showSettingsButton) {
            this._settingsButton = headerButton(_('Device settings'));
            titleHbox.add_child(this._settingsButton.bin);
            this._settingsButton.icon.gicon = this._gIcon('bbm-settings-symbolic.svg');

            this._settingsButton.connectObject('clicked', () => {
                this._dataHandler.emitUIAction('settingsButtonClicked', 0);
            }, this);
        }

        if (this._showCollapseButton) {
            this.collapseButton = headerButton(_('Collapse submenu'));
            this.collapseButton.icon.icon_name = 'pan-up-symbolic';
            titleHbox.add_child(this.collapseButton.bin);
        }

        if (this._showBtPairButton) {
            this.btPairButton = headerButton(_('Disconnect'));
            titleHbox.add_child(this.btPairButton.bin);
        }

        const infoHbox = new St.BoxLayout({x_expand: true});
        this.add_child(infoHbox);

        this._modelIcon = new St.Icon({
            style_class: 'bbm-panel-icon',
            icon_size: 56,
            y_expand: true,
        });
        infoHbox.add_child(this._modelIcon);
        this._modelIcon.gicon = this._gIcon(`bbm-art-${this._config.albumArtIcon}.png`);
        this._batteryBox =  new St.BoxLayout({x_expand: true});
        infoHbox.add_child(this._batteryBox);
        const startBin = new St.Bin({style_class: 'bbm-panel-start-bin'});
        this._batteryBox.add_child(startBin);

        this._batterySetWidget = new BatterySetWidget(widgetInfo, this._dataHandler);
        this._batteryBox.add_child(this._batterySetWidget);

        const button1Enabled = this._config.toggle1Button1Icon && this._config.toggle1Button2Icon;
        const button2Enabled = this._config.toggle2Button1Icon && this._config.toggle2Button2Icon;

        if (button1Enabled) {
            this._menuSeparator1 = new St.Widget({
                style_class: 'bbm-menu-separator',
                x_expand: true,
            });
            this.add_child(this._menuSeparator1);

            this._set1ToggleButtons =
                new ToggleButtonsSet(this._gIcon, this._tooltip, false, this._dataHandler);
            this.add_child(this._set1ToggleButtons);

            this._set1ToggleButtons.bind_property('visible',
                this._menuSeparator1, 'visible',
                GObject.BindingFlags.SYNC_CREATE);

            const boxes = [
                this._config.optionsBox1,
                this._config.optionsBox2,
                this._config.optionsBox3,
                this._config.optionsBox4,
            ];

            const hasAnyOptions = boxes.some(arr => arr.length > 0);
            if (hasAnyOptions) {
                const optionBox = new OptionsBox(this._gIcon, colorInfo, this._dataHandler);
                this.add_child(optionBox);
                this._set1ToggleButtons.bind_property('visible',
                    optionBox, 'visible',
                    GObject.BindingFlags.SYNC_CREATE);
            }
        }

        if (button2Enabled) {
            this._menuSeparator2 = new St.Widget({
                style_class: 'bbm-menu-separator',
                x_expand: true,
            });

            this.add_child(this._menuSeparator2);

            this._set2ToggleButtons =
                new ToggleButtonsSet(this._gIcon, this._tooltip, true, this._dataHandler);

            this.add_child(this._set2ToggleButtons);

            this._set2ToggleButtons.bind_property('visible',
                this._menuSeparator2, 'visible',
                GObject.BindingFlags.SYNC_CREATE);
        }

        if (this._config.labelIndicatorEnabled > 0) {
            this._menuSeparator3 = new St.Widget({
                style_class: 'bbm-menu-separator',
                x_expand: true,
            });
            this.add_child(this._menuSeparator3);

            this._labelIndicator = new LabelIndicators(colorInfo, this._dataHandler);
            this.add_child(this._labelIndicator);

            this._labelIndicator.bind_property('visible',
                this._menuSeparator3, 'visible',
                GObject.BindingFlags.SYNC_CREATE);
        }

        this._updateVisibility();

        this._dataHandler.connectObject(
            'configuration-changed', () => {
                this._batterySetWidget.destroy();
                this._batterySetWidget = new BatterySetWidget(widgetInfo, this._dataHandler);
                this._batteryBox.add_child(this._batterySetWidget);
                const albumArtIcon = this._dataHandler.getConfig().albumArtIcon;
                this._modelIcon.gicon = this._gIcon(`bbm-art-${albumArtIcon}.png`);
            },
            'properties-changed', () => {
                if (button1Enabled || button2Enabled)
                    this._updateVisibility();
            },
            this
        );

        this.connectObject('destroy', () => {
            this._tooltip?.destroy();
            this._tooltip = null;
        }, this);
    }

    _updateVisibility() {
        const toggle1Visible = this._dataHandler.getProps().toggle1Visible;
        const toggle2Visible = this._dataHandler.getProps().toggle2Visible;

        if (toggle1Visible)
            this._set1ToggleButtons?.show();
        else
            this._set1ToggleButtons?.hide();

        if (toggle2Visible)
            this._set2ToggleButtons?.show();
        else
            this._set2ToggleButtons?.hide();
    }

    updateAlias(alias) {
        this._modelLabel.text = alias;
    }

    updatePinButton(selected) {
        if (this._showPinButton && this._pinButton) {
            const isSelected = this._path ===  selected;
            const gioIcon =  isSelected ? this._gIcon('bbm-pinned-symbolic.svg')
                : this._gIcon('bbm-pin-symbolic.svg');

            this._pinButton.icon.gicon = gioIcon;
            this._pinButton.reactive = !isSelected;
        }
    }
});

