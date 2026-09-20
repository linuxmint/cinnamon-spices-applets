const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const C = require('./constants');
const { UUID, _, TOGGLE_WIDTH, TOGGLE_HEIGHT, ARROW_WIDTH, MENU_CONTENT_WIDTH } = C;

function ToggleManager(applet) {
    this._applet = applet;
}

// 开关网格：网络/蓝牙（含右侧箭头）与四个常规开关共用 createToggleRow，
// 差异只在有无 onSettings；行内 _icon/_nameLabel/_statusLabel 引用供外部更新。
ToggleManager.prototype = {
    buildToggleGrid: function() {
        let applet = this._applet;

        let container = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 6px;'
        });
        container.set_width(MENU_CONTENT_WIDTH);

        applet._toggleButtons = {};

        let topRow = new St.BoxLayout({
            vertical: false, style: 'spacing: 6px;'
        });
        topRow.add_child(this.createToggleRow({
            id: 'network',
            iconName: 'network-wireless-symbolic',
            label: _("Network"),
            onClick: function() { applet.onNetworkClick(); },
            onSettings: function() { applet.openWifiSettings(); }
        }));
        topRow.add_child(this.createToggleRow({
            id: 'bluetooth',
            iconName: 'bluetooth-symbolic',
            label: _("Bluetooth"),
            onClick: function() { applet.onBluetoothClick(); },
            onSettings: function() { applet.openBluetoothSettings(); }
        }));
        container.add_child(topRow);

        let regular = [
            { id: 'performance', icon: 'power-profile-balanced-symbolic',
              label: _("Power Mode"),   cb: function() { applet._themeSwitcher.togglePerformanceMode(); } },
            { id: 'nightlight',  icon: 'night-light-symbolic',
              label: _("Night Light"),  cb: function() { applet._themeSwitcher.toggleNightLight(); } },
            { id: 'darkmode',    icon: 'weather-clear-night-symbolic',
              label: _("Dark Style"),   cb: function() { applet._themeSwitcher.toggleDarkMode(); } },
            { id: 'airplane',    icon: 'airplane-mode-symbolic',
              label: _("Airplane Mode"), cb: function() { applet._themeSwitcher.toggleAirplaneMode(); } }
        ];

        for (let i = 0; i < regular.length; i += 2) {
            let rowBox = new St.BoxLayout({
                vertical: false, style: 'spacing: 6px;'
            });
            rowBox.add_child(this.createToggleRow({
                id: regular[i].id,
                iconName: regular[i].icon,
                label: regular[i].label,
                onClick: regular[i].cb
            }));
            if (i + 1 < regular.length) {
                rowBox.add_child(this.createToggleRow({
                    id: regular[i + 1].id,
                    iconName: regular[i + 1].icon,
                    label: regular[i + 1].label,
                    onClick: regular[i + 1].cb
                }));
            }
            container.add_child(rowBox);
        }

        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        item.addActor(applet._wrapCentered(container), { span: -1, expand: true });
        if (applet._insertOrdered) applet._insertOrdered('toggle', item);
        else applet.menu.addMenuItem(item);
        applet._toggleItem = item;
    },

    createToggleRow: function(config) {
        let applet = this._applet;
        let row = new St.BoxLayout({
            vertical: false,
            style_class: 'quick-settings-toggle',
            style: 'spacing: 0;',
            x_expand: false
        });
        row.set_width(TOGGLE_WIDTH);
        row.set_height(TOGGLE_HEIGHT);

        let mainBtnWidth = config.onSettings ? TOGGLE_WIDTH - ARROW_WIDTH : TOGGLE_WIDTH;
        let mainBtn = new St.Button({
            style_class: 'quick-settings-toggle-main',
            reactive: true, can_focus: true
        });
        mainBtn.set_width(mainBtnWidth);
        mainBtn.set_height(TOGGLE_HEIGHT);

        let hbox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px; padding: 0 ' + (config.onSettings ? '0 0 12px' : '12px') + ';'
        });
        hbox.set_width(mainBtnWidth);
        hbox.set_height(TOGGLE_HEIGHT);

        let icon = new St.Icon({
            icon_name: config.iconName, icon_size: 16,
            style: 'color: #ffffff;',
            y_align: Clutter.ActorAlign.CENTER
        });
        hbox.add_child(icon);

        let labelBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        let nameLabel = new St.Label({
            text: config.label,
            style_class: 'quick-settings-toggle-label',
            x_align: Clutter.ActorAlign.START
        });
        let statusLabel = new St.Label({
            text: '',
            style_class: 'quick-settings-toggle-status',
            x_align: Clutter.ActorAlign.START,
            visible: false // 空状态不占高度，否则单行文字被顶上
        });
        labelBox.add_child(nameLabel);
        labelBox.add_child(statusLabel);
        hbox.add_child(labelBox);
        // 关掉纵向填充，否则 y_align CENTER 被拉伸顶掉，空状态行时文字偏上
        try { hbox.child_set_property(labelBox, 'y-fill', false); } catch(e) {}

        mainBtn.set_child(hbox);
        mainBtn.connect('clicked', function() {
            if (config.onClick) {
                try { config.onClick(); }
                catch (e) { global.logError("QS onClick: " + e.message); }
            }
        });
        row.add_child(mainBtn);

        if (config.onSettings) {
            let arrowBtn = new St.Button({
                style_class: 'quick-settings-arrow-btn',
                reactive: true, can_focus: true
            });
            arrowBtn.set_width(ARROW_WIDTH);
            arrowBtn.set_height(TOGGLE_HEIGHT);

            // 图标直接作为按钮子节点，St.Button 默认将其居中
            arrowBtn.set_child(new St.Icon({
                icon_name: 'pan-end-symbolic',
                icon_size: 16,
                style: 'color: rgba(255, 255, 255, 0.85);'
            }));
            arrowBtn.connect('clicked', function() {
                if (config.onSettings) {
                    try { config.onSettings(); }
                    catch (e) { global.logError("QS onSettings: " + e.message); }
                }
            });
            row.add_child(arrowBtn);
        }

        row._icon = icon;
        row._nameLabel = nameLabel;
        row._statusLabel = statusLabel;
        row._mainBtn = mainBtn;

        applet._toggleButtons[config.id] = row;
        return row;
    },

    // 启用/禁用某一开关（无硬件时禁用并提示）
    setRowEnabled: function(id, enabled, statusText) {
        let row = this._applet._toggleButtons[id];
        if (!row) return;
        if (row._mainBtn) {
            row._mainBtn.reactive = enabled;
            row._mainBtn.opacity = enabled ? 255 : 140;
        }
        if (statusText !== undefined && row._statusLabel) {
            row._statusLabel.set_text(statusText);
            row._statusLabel.visible = (statusText !== '');
        }
    },

    setToggleState: function(id, active) {
        let b = this._applet._toggleButtons[id];
        if (!b) return;
        let actor = b.actor || b;
        if (!actor.has_style_class_name) return;
        if (active) {
            if (!actor.has_style_class_name('active')) actor.add_style_class_name('active');
        } else {
            if (actor.has_style_class_name('active')) actor.remove_style_class_name('active');
        }
    },

    applyToggleVisibility: function() {
        let applet = this._applet;
        if (!applet._settings || !applet._toggleButtons) return;
        let keys = ['performance', 'nightlight', 'darkmode', 'airplane'];
        for (let i = 0; i < keys.length; i++) {
            let btn = applet._toggleButtons[keys[i]];
            if (btn) {
                let show = applet._settings.getValue('show-toggle-' + keys[i]);
                btn.visible = show;
            }
        }
    }
};
module.exports = ToggleManager;
