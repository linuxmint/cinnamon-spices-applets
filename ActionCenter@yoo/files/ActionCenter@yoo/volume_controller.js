const Cvc = imports.gi.Cvc;

// 音量：Cvc 混音控制的薄封装。applet 持有 _control/_output，本模块只做读写换算。
// _updatingVolume 防止"外部音量变化→滑块同步→又写回去"的回环。
function VolumeController(applet) {
    this._applet = applet;
    // 存信号 id，移除/重绑时断开，防止 handler 泄漏与旧 sink 幽灵回调
    this._controlOutUpdateId = 0;
    this._controlOutAddedId = 0;
    this._controlOutRemovedId = 0;
    this._outputVolumeId = 0;
    this._outputMuteId = 0;
}

VolumeController.prototype = {
    onControlStateChanged: function() {
        let applet = this._applet;
        if (!applet._control) return;
        if (applet._control.get_state() !== Cvc.MixerControlState.READY) return;

        this._connectControlSignals();
        this._reattachOutput();
    },

    // 默认输出切换（插拔耳机/USB 声卡）时重绑；Cinnamon 的 Cvc 信号叫
    // active-output-update（GNOME 的 default-sink-changed 在这里不存在）
    _connectControlSignals: function() {
        let applet = this._applet;
        if (this._controlOutUpdateId) return;
        let self = this;
        try {
            this._controlOutUpdateId = applet._control.connect('active-output-update', function() {
                self._reattachOutput();
            });
            // 设备增减只刷新右键输出列表（菜单开着才重绘）
            this._controlOutAddedId = applet._control.connect('output-added', function() {
                self._refreshSinkSubmenuIfOpen();
            });
            this._controlOutRemovedId = applet._control.connect('output-removed', function() {
                self._refreshSinkSubmenuIfOpen();
            });
        } catch(e) { global.logError("QS output-update connect: " + e.message); }
    },

    _reattachOutput: function() {
        let applet = this._applet;
        this._detachOutputSignals();
        try {
            applet._output = applet._control.get_default_sink();
        } catch(e) {
            applet._output = null;
        }
        if (!applet._output) return;

        applet._volumeMax = applet._control.get_vol_max_norm();
        let self = this;
        try {
            this._outputVolumeId = applet._output.connect('notify::volume', function() { self.updateVolumeSlider(); });
            this._outputMuteId = applet._output.connect('notify::is-muted', function() { self.updateVolumeSlider(); });
        } catch(e) { global.logError("QS output signals: " + e.message); }
        this.updateVolumeSlider();
        this._refreshSinkSubmenuIfOpen();
    },

    // 右键菜单开着时才重绘输出列表；关着不用管（下次打开现查）
    _refreshSinkSubmenuIfOpen: function() {
        try {
            let applet = this._applet;
            if (!applet._contextMenu) return;
            let m = applet._applet_context_menu;
            if (m && m.isOpen) applet._contextMenu._rebuildSinkList();
        } catch(e) {}
    },

    updateVolumeSlider: function() {
        let applet = this._applet;
        if (!applet._output || !applet._volumeSlider) return;
        let v = applet._output.is_muted ? 0 : applet._output.volume / applet._volumeMax;
        applet._updatingVolume = true;
        try { applet._volumeSlider.setValue(v); } catch (e) {}
        applet._updatingVolume = false;
        this.updateVolumeIcon(v);
    },

    updateVolumeIcon: function(v) {
        let applet = this._applet;
        if (!applet._volumeIcon) return;
        let name;
        if (v <= 0.001) name = "audio-volume-muted-symbolic";
        else if (v < 0.33) name = "audio-volume-low-symbolic";
        else if (v < 0.66) name = "audio-volume-medium-symbolic";
        else name = "audio-volume-high-symbolic";
        applet._volumeIcon.set_icon_name(name);
    },

    onVolumeChanged: function(v) {
        let applet = this._applet;
        if (applet._updatingVolume || !applet._output) return;
        // 接近 0 视为静音（滑块物理到不了绝对 0）
        if (v < 0.005) {
            applet._output.change_is_muted(true);
            applet._output.volume = 0;
        } else {
            applet._output.change_is_muted(false);
            applet._output.volume = v * applet._volumeMax;
        }
        applet._output.push_volume();
    },

    toggleMute: function() {
        let applet = this._applet;
        if (!applet._output) return;
        applet._output.change_is_muted(!applet._output.is_muted);
    },

    // 输出设备列表（右键菜单用）：[{sink, desc, icon, active, muted}]
    getSinkList: function() {
        let applet = this._applet;
        let out = [];
        try {
            if (!applet._control) return out;
            if (applet._control.get_state() !== Cvc.MixerControlState.READY) return out;
            let sinks = applet._control.get_sinks();
            if (!sinks) return out;
            let defId = '';
            try {
                let def = applet._control.get_default_sink();
                if (def) defId = def.get_id();
            } catch(e) {}
            for (let i = 0; i < sinks.length; i++) {
                let s = sinks[i];
                let desc = '';
                try { desc = s.get_description() || s.get_name() || ''; } catch(e) {}
                if (!desc) continue;
                let icon = 'audio-card-symbolic';
                try { icon = s.get_icon_name() || icon; } catch(e) {}
                let muted = false;
                try { muted = s.get_is_muted(); } catch(e) {}
                let sid = '';
                try { sid = s.get_id(); } catch(e) {}
                out.push({ sink: s, desc: desc, icon: icon, muted: muted,
                           active: !!(defId && sid && sid === defId) });
            }
        } catch(e) {
            global.logError("QS sink list: " + e.message);
        }
        return out;
    },

    setDefaultSink: function(sink) {
        try {
            this._applet._control.set_default_sink(sink);
        } catch(e) {
            global.logError("QS set default sink: " + e.message);
        }
    },

    _detachOutputSignals: function() {
        let applet = this._applet;
        if (applet._output) {
            try {
                if (this._outputVolumeId) applet._output.disconnect(this._outputVolumeId);
                if (this._outputMuteId) applet._output.disconnect(this._outputMuteId);
            } catch(e) {}
        }
        this._outputVolumeId = 0;
        this._outputMuteId = 0;
    },

    // applet 移除时调用：断开 control + output 上所有本模块信号
    detachAll: function() {
        let applet = this._applet;
        this._detachOutputSignals();
        if (applet._control) {
            try {
                if (this._controlOutUpdateId) applet._control.disconnect(this._controlOutUpdateId);
                if (this._controlOutAddedId) applet._control.disconnect(this._controlOutAddedId);
                if (this._controlOutRemovedId) applet._control.disconnect(this._controlOutRemovedId);
            } catch(e) {}
        }
        this._controlOutUpdateId = 0;
        this._controlOutAddedId = 0;
        this._controlOutRemovedId = 0;
    }
};
module.exports = VolumeController;
