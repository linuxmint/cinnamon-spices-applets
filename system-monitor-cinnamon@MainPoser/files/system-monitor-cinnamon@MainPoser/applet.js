/**
 * System Monitor Plus - Initial Commit
 * 采用现代 ES6 Class 写法
 */

// 导入系统库
const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const UUID = "system-monitor-cinnamon@MainPoser";
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}

// 定义类型提示 (VS Code 离线补全核心)
/** @typedef {import('gi://St')} St */
/** @typedef {import('gi://GLib')} GLib */

class SysMonitorCinnamon extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        global.log("System Monitor Plus: Initializing...");

        // 创建一个用于放置动画图标的容器
        this.set_applet_label(_("Loading..."));

        global.log(_("Loading..."));

        this._settings = {
            icon_theme: "auto",
            refresh_interval: 2,
            show_network: true,
            runner: "cat"
        };

        this._stats = {
            cpu: 0,
            mem: 0,
            net: { up: 0, down: 0 },
            lastVfsData: this._get_net_raw(),
            lastCpuData: null
        };

        // --- 3. 渲染相关的状态 ---
        this._render = {
            frame: 0,
            path: metadata.path,
            dataTimeoutId: null,
            animTimeoutId: null,
        };

        this._initSettings(metadata.uuid, instance_id);
        this._data_loop();
        this._anim_loop();
    }

    /**
     * 核心循环逻辑
     */
    _data_loop() {
        this._stats.cpu = this._get_cpu_usage();
        this._stats.mem = this._get_mem_usage();

        // 5. 根据配置逻辑显示
        let label = ` CPU: ${this._stats.cpu}% | RAM: ${this._stats.mem}%`;

        if (this._settings.show_network) {
            let net = this._get_net_speed();
            label += ` | ${net}`;
        }

        this.set_applet_label(label);

        // 使用绑定的变量 this._settings.refresh_interval
        this._render.dataTimeoutId = Mainloop.timeout_add(this._settings.refresh_interval * 1000, () => this._data_loop());
        return false;
    }

    /**
     * 循环 2: 动画渲染 (频率动态变化)
     * 只负责切换图标，性能开销极小
     */
    _anim_loop() {
        // 计算当前帧的延迟: CPU 越高，跑得越快
        // 映射逻辑: 0% -> 400ms, 100% -> 40ms
        let delay = Math.max(40, 400 - (this._stats.cpu * 3.6));

        // 切换 0-4 帧
        this._render.frame = (this._render.frame + 1) % 5;
        this._settings.them = this._get_them();

        let iconPath = `${this._render.path}/icons/runners/${this._settings.runner}/${this._settings.them}/${this._settings.runner}_${this._render.frame}.svg`;

        if (GLib.file_test(iconPath, GLib.FileTest.EXISTS)) {
            // 使用最基础、绝不报错的方法
            this.set_applet_icon_path(iconPath);
        }

        this._render.animTimeoutId = Mainloop.timeout_add(delay, () => this._anim_loop());
        return false;
    }

    /**
     * 纯读取 /proc/stat 获取 CPU 负载
     */
    _get_cpu_usage() {
        try {
            // 1. 读取 /proc/stat
            let content = GLib.file_get_contents("/proc/stat")[1].toString();
            let line = content.split('\n')[0].split(/\s+/);

            /**
             * Linux /proc/stat 第一行数据含义 (从下标 1 开始):
             * user, nice, system, idle, iowait, irq, softirq...
             */
            let user = parseInt(line[1]);
            let nice = parseInt(line[2]);
            let system = parseInt(line[3]);
            let idle = parseInt(line[4]);
            let iowait = parseInt(line[5]);
            let irq = parseInt(line[6]);
            let softirq = parseInt(line[7]);

            // 计算当前时刻的总 CPU 时间和空闲时间
            let total = user + nice + system + idle + iowait + irq + softirq;

            // 2. 初始化检查: 如果是第一次运行，先记录数据并返回 0
            if (!this._stats.lastCpuData) {
                this._stats.lastCpuData = { total: total, idle: idle };
                return 0;
            }

            // 3. 计算两次采样之间的差值 (Delta)
            let deltaTotal = total - this._stats.lastCpuData.total;
            let deltaIdle = idle - this._stats.lastCpuData.idle;

            // 更新历史记录供下次使用
            this._stats.lastCpuData.total = total;
            this._stats.lastCpuData.idle = idle;

            // 4. 计算占用率: 1 - (空闲时间变化 / 总时间变化)
            if (deltaTotal === 0) return 0;
            let usage = Math.round((1 - deltaIdle / deltaTotal) * 100);

            // 约束在 0-100 之间
            return Math.min(100, Math.max(0, usage));

        } catch (e) {
            global.logError("Failed to get CPU usage: " + e);
            return 0;
        }
    }

    /**
     * 纯读取 /proc/meminfo 获取内存
     */
    _get_mem_usage() {
        let content = GLib.file_get_contents("/proc/meminfo")[1].toString();
        let total = parseInt(content.match(/MemTotal:\s+(\d+)/)[1]);
        let available = parseInt(content.match(/MemAvailable:\s+(\d+)/)[1]);
        return Math.round(((total - available) / total) * 100);
    }

    /**
     * 获取网速原始数据
     */
    _get_net_raw() {
        try {
            let content = GLib.file_get_contents("/proc/net/dev")[1].toString();
            let lines = content.split('\n');
            let totalDownload = 0;
            let totalUpload = 0;

            for (let line of lines) {
                // 排除环回地址 lo 和虚拟网卡，只计算物理网卡或特定前缀
                if (line.includes(":") && !line.includes("lo")) {
                    let data = line.trim().split(/[:\s]+/);
                    // data[0] 是网卡名
                    // data[1] 是 Receive Bytes (下载)
                    // data[9] 是 Transmit Bytes (上传)
                    totalDownload += parseInt(data[1]);
                    totalUpload += parseInt(data[9]);
                }
            }
            return {
                rx: totalDownload,
                tx: totalUpload,
                time: Date.now()
            };
        } catch (e) {
            global.logError("Failed to read network data: " + e);
            return this._stats.lastVfsData;
        }
    }

    /**
     * 计算两次间隔的网速
     */
    _get_net_speed() {
        let current = this._get_net_raw();

        // 计算时间差 (秒)
        let deltaTime = (current.time - this._stats.lastVfsData.time) / 1000;
        if (deltaTime <= 0) return "↓ 0.0 KB/s ↑ 0.0 KB/s";

        // 计算差值并转为 KB/s
        this._stats.net.down = ((current.rx - this._stats.lastVfsData.rx) / 1024 / deltaTime).toFixed(1);
        this._stats.net.up = ((current.tx - this._stats.lastVfsData.tx) / 1024 / deltaTime).toFixed(1);

        this._stats.lastVfsData = current;

        // 返回格式化的字符串
        return `↓ ${this._stats.net.down} KB/s ↑ ${this._stats.net.up} KB/s`;
    }

    /**
     * 核心: 决定当前应该使用哪个文件夹
     */
    _get_them() {
        // 如果用户手动选择了黑色或白色，直接返回
        if (this._settings.icon_theme === "black") return "black";
        if (this._settings.icon_theme === "white") return "white";

        // 如果是“跟随系统” (auto)
        // 获取面板文字的亮度
        let themeNode = this.actor.get_theme_node();
        let color = themeNode.get_foreground_color();

        // 计算感知亮度 (Luminance)
        let luminance = (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue) / 255;

        // 亮度 > 0.5 表示文字是浅色的 -> 背景是深色 -> 使用白色图标
        return (luminance > 0.5) ? "white" : "black";
    }

    _initSettings(uuid, instance_id) {
        this.settings = new Settings.AppletSettings(this._settings, uuid, instance_id);

        // 批量绑定: 只要 settings-schema 里的 key 和 this._settings 里的 key 一致即可
        let keys = Object.keys(this._settings);
        for (let key of keys) {
            this.settings.bind(key, key, () => this._on_settings_changed());
        }
    }

    _on_settings_changed() {
        // 当配置改变时，这里会被触发
        global.log("--- Settings changed ---");
        global.log(this._settings);

        // 重启定时器以应用新的刷新频率
        if (this._render.dataTimeoutId) {
            Mainloop.source_remove(this._render.dataTimeoutId);
        }
        this._data_loop();
    }

    /**
     * 插件被移除时的清理操作
     */
    on_applet_removed_from_panel() {
        if (this._render.dataTimeoutId) {
            Mainloop.source_remove(this._render.dataTimeoutId);
        }
        if (this._render.animTimeoutId) {
            Mainloop.source_remove(this._render.animTimeoutId);
        }
        global.log("System Monitor Plus: Removed from panel.");
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SysMonitorCinnamon(metadata, orientation, panel_height, instance_id);
}