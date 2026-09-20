const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const C = require('./constants');
const { UUID, _ } = C;

// 内联盒子模式（同选择器）：固定宽度，不参与主菜单宽度计算
// St 实测为 content-box（box-sizing 无效）：style width = 内容宽，总占宽 = width + padding
// 外盒总宽 344 = 内容 336 + padding 8；行总宽 336 = 内容 312 + padding 24
const POWER_ROW_WIDTH = 312;
const POWER_BOX_WIDTH = 336;
const POWER_BTN_WIDTH = 336;

function PowerMenu(applet) {
    this._applet = applet;
}

// 关机二级菜单：两种模式（完整菜单 / 系统对话框）由 power-mode 设置切换，改设置后重建。
PowerMenu.prototype = {
    buildPowerMenu: function() {
        let applet = this._applet;

        // 外盒：圆角底色（对应原 .quick-settings-power-section）
        let box = new St.BoxLayout({
            vertical: true,
            style: 'margin: 4px 6px; padding: 4px; border-radius: 10px; background-color: rgba(255,255,255,0.07); width: ' + POWER_BOX_WIDTH + 'px; max-width: ' + POWER_BOX_WIDTH + 'px;'
        });

        // 头部：透明底（对应原 .quick-settings-power-header）
        let headerBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 10px; padding: 6px 12px; width: ' + POWER_ROW_WIDTH + 'px; max-width: ' + POWER_ROW_WIDTH + 'px;'
        });
        headerBox.add_child(new St.Icon({
            icon_name: 'system-shutdown-symbolic',
            icon_size: 20,
            style: 'color: #ffffff;',
            y_align: Clutter.ActorAlign.CENTER
        }));
        headerBox.add_child(new St.Label({
            text: _("Power Off"),
            style: 'font-weight: bold; font-size: 14px; color: #ffffff;',
            y_align: Clutter.ActorAlign.CENTER
        }));
        box.add_child(headerBox);

        let useSystemDialog = applet._settings && applet._settings.getValue('power-mode');

        if (useSystemDialog) {
            // 系统对话框模式：Power Off + 分隔线 + Log Out
            this._addRow(box, _("Power Off"), function() {
                Util.spawn(['cinnamon-session-quit', '--power-off']);
            });
            box.add_child(new St.Widget({
                style: 'height: 1px; width: ' + (POWER_BTN_WIDTH - 24) + 'px; max-width: ' + (POWER_BTN_WIDTH - 24) + 'px; background-color: rgba(255,255,255,0.12); margin: 4px 12px;'
            }));
            this._addRow(box, _("Log Out"), function() {
                Util.spawn(['cinnamon-session-quit', '--logout']);
            });
        } else {
            // 完整菜单模式
            applet._powerItems = {};

            applet._powerItems.suspend = this._addRow(box, _("Suspend"), function() { Util.spawn(['systemctl', 'suspend']); });
            applet._powerItems.reboot = this._addRow(box, _("Reboot"), function() { Util.spawn(['systemctl', 'reboot']); });
            applet._powerItems.off = this._addRow(box, _("Power Off"), function() { Util.spawn(['systemctl', 'poweroff']); });

            box.add_child(new St.Widget({
                style: 'height: 1px; width: ' + (POWER_BTN_WIDTH - 24) + 'px; max-width: ' + (POWER_BTN_WIDTH - 24) + 'px; background-color: rgba(255,255,255,0.12); margin: 4px 12px;'
            }));

            applet._powerItems.logout = this._addRow(box, _("Log Out"), function() { Util.spawn(['cinnamon-session-quit', '--logout', '--no-prompt']); });
            applet._powerItems.switchuser = this._addRow(box, _("Switch User"), function() { Util.spawn(['cinnamon-screensaver-command', '--lock']); });
        }

        // 无响应 wrapper 塞进菜单；_powerSection 仍指向 wrapper，外部调用兼容
        let wrapper = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        wrapper.addActor(box, { span: -1 });
        wrapper.actor.hide();
        applet.menu.addMenuItem(wrapper, 1);
        applet._powerSection = wrapper;
        applet._powerBox = box; // 调试测量用
    },

    // 内联行按钮（对应原 .popup-menu-item：320px / 8px 12px / 圆角6px + 悬浮高亮）
    _addRow: function(box, label, onActivate) {
        let applet = this._applet;
        let rowStyle = 'spacing: 6px; padding: 8px 12px; border-radius: 6px; width: ' + POWER_ROW_WIDTH + 'px; max-width: ' + POWER_ROW_WIDTH + 'px;';
        let rowHoverStyle = rowStyle + ' background-color: rgba(255,255,255,0.12);';

        let row = new St.BoxLayout({
            vertical: false,
            style: rowStyle
        });
        row.add_child(new St.Label({
            text: label,
            style: 'font-size: 13px; color: #ffffff;',
            y_align: Clutter.ActorAlign.CENTER
        }));

        let btn = new St.Button({ reactive: true, can_focus: true, x_expand: true,
            style: 'padding: 0; border-width: 0; width: ' + POWER_BTN_WIDTH + 'px; max-width: ' + POWER_BTN_WIDTH + 'px;' });
        btn.set_child(row);
        btn.connect('enter-event', function() { row.set_style(rowHoverStyle); });
        btn.connect('leave-event', function() { row.set_style(rowStyle); });
        btn.connect('clicked', function() {
            applet._ignoreClose = false;
            applet.menu.close();
            Mainloop.idle_add(onActivate);
        });
        box.add_child(btn);
        return btn;
    },

    rebuildPowerMenu: function() {
        let applet = this._applet;
        let wasVisible = applet._powerMenuVisible;
        if (applet._powerSection) {
            try { applet._powerSection.actor.destroy(); } catch(e) {}
            applet._powerSection = null;
        }
        this.buildPowerMenu();
        if (wasVisible && applet._powerSection) {
            applet._powerSection.actor.show();
        }
    },

    togglePowerMenu: function() {
        let applet = this._applet;

        applet._startIgnoreClose();

        applet._powerMenuVisible = !applet._powerMenuVisible;
        if (applet._powerMenuVisible) {
            if (applet._brightnessVisible && applet._brightnessSection) {
                applet._brightnessVisible = false;
                applet._brightnessSection.actor.hide();
            }
            if (applet._mprisController) applet._mprisController._collapseChooser();
            applet._animateSubmenu(applet._powerSection.actor, true);
        } else {
            applet._animateSubmenu(applet._powerSection.actor, false);
        }
    }
};
module.exports = PowerMenu;
