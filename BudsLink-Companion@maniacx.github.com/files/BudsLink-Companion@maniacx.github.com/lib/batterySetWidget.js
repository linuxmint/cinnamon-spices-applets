const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Me = imports.ui.appletManager.applets['BudsLink-Companion@maniacx.github.com'];
const {CircleBatteryIcon} = Me.lib.circleBatteryIconWidget;

var BatterySetWidget = GObject.registerClass({
    GTypeName: 'BudsLinkCompanion_BatterySetWidget',
}, class BatterySetWidget extends St.BoxLayout {
    _init(widgetInfo, dataHandler) {
        super._init();
        this._dataHandler = dataHandler;
        this._config = this._dataHandler.getConfig();
        const orientation = {x_align: Clutter.ActorAlign.START, vertical: true};
        const boxStyleClass = 'bbm-battery-vertical-widget-box';
        const labelStyleClass = 'bbm-battery-veritcal-widget-label';

        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const batteryCanvasSize = scaleFactor * 34;

        this.add_style_class_name(boxStyleClass);

        if (this._config.battery1Icon) {
            this._battery1BatteryBox =  new St.BoxLayout(orientation);
            const battery1VectorPath = this._config.battery1Icon;
            this._battery1BatteryIcon = new CircleBatteryIcon(
                batteryCanvasSize, battery1VectorPath, widgetInfo);
            this._battery1PercentageLabel = new St.Label({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._battery1PercentageLabel.add_style_class_name(labelStyleClass);

            this._battery1BatteryBox.add_child(this._battery1BatteryIcon);
            this._battery1BatteryBox.add_child(this._battery1PercentageLabel);
            this._battery1BatteryIcon.updateValues(0, false);
            this.add_child(this._battery1BatteryBox);
        }

        if (this._config.battery2Icon) {
            const spaceBin1 = new St.Bin({style_class: 'bbm-battery-vertical-space-bin'});
            this.add_child(spaceBin1);
            this._battery2BatteryBox =  new St.BoxLayout(orientation);
            const battery2VectorPath = this._config.battery2Icon;
            this._battery2BatteryIcon = new CircleBatteryIcon(
                batteryCanvasSize, battery2VectorPath, widgetInfo);
            this._battery2PercentageLabel = new St.Label({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._battery2PercentageLabel.add_style_class_name(labelStyleClass);
            this._battery2BatteryBox.add_child(this._battery2BatteryIcon);
            this._battery2BatteryBox.add_child(this._battery2PercentageLabel);
            this._battery2BatteryIcon.updateValues(0, false);
            this.add_child(this._battery2BatteryBox);
        }

        if (this._config.battery3Icon) {
            const spaceBin2 = new St.Bin({style_class: 'bbm-battery-vertical-space-bin'});
            this.add_child(spaceBin2);
            this._battery3BatteryBox =  new St.BoxLayout(orientation);
            const battery3VectorPath = this._config.battery3Icon;
            this._battery3BatteryIcon = new CircleBatteryIcon(
                batteryCanvasSize, battery3VectorPath, widgetInfo);
            this._battery3PercentageLabel = new St.Label({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._battery3PercentageLabel.add_style_class_name(labelStyleClass);
            this._battery3BatteryBox.add_child(this._battery3BatteryIcon);
            this._battery3BatteryBox.add_child(this._battery3PercentageLabel);
            this._battery3BatteryIcon.updateValues(0, false);
            this.add_child(this._battery3BatteryBox);
        }

        const props = this._dataHandler.getProps();
        this._updateProps(props);

        this._dataHandler.connectObject(
            'properties-changed', () => {
                const properties = this._dataHandler.getProps();
                this._updateProps(properties);
            },
            this
        );
    }

    _updateProps(props) {
        if (this._config.battery1Icon) {
            if (this._config.battery1ShowOnDisconnect ||
                props.battery1Level !== 0 && props.battery1Status !== 'disconnected') {
                this._battery1BatteryIcon.updateValues(props.battery1Level, props.battery1Status);
                this._battery1PercentageLabel.text =
                    props.battery1Level === 0 && this._config.battery1ShowOnDisconnect
                        ? '' : `${props.battery1Level}%`;
                this._battery1BatteryBox.visible = true;
            } else {
                this._battery1BatteryBox.visible = false;
            }
        }

        if (this._config.battery2Icon) {
            if (this._config.battery2ShowOnDisconnect ||
                props.battery2Level !== 0 && props.battery2Status !== 'disconnected') {
                this._battery2BatteryIcon.updateValues(props.battery2Level, props.battery2Status);
                this._battery2PercentageLabel.text =
                    props.battery2Level === 0 && this._config.battery2ShowOnDisconnect
                        ? '' : `${props.battery2Level}%`;
                this._battery2BatteryBox.visible = true;
            } else {
                this._battery2BatteryBox.visible = false;
            }
        }

        if (this._config.battery3Icon) {
            if (this._config.battery3ShowOnDisconnect ||
                props.battery3Level !== 0 && props.battery3Status !== 'disconnected') {
                this._battery3BatteryIcon.updateValues(props.battery3Level, props.battery3Status);
                this._battery3PercentageLabel.text =
                    props.battery3Level === 0 && this._config.battery3ShowOnDisconnect
                        ? '' : `${props.battery3Level}%`;
                this._battery3BatteryBox.visible = true;
            } else {
                this._battery3BatteryBox.visible = false;
            }
        }
    }
});
