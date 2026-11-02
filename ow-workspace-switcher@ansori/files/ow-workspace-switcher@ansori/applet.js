const Applet = imports.ui.applet;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Settings = imports.ui.settings;
const Cinnamon = imports.gi.Cinnamon;

class OWWorkspaceSwitcher extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Bind Settings
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("theme", "theme", this.refreshApplet);
        this.settings.bind("overview_mode", "overview_mode", this.refreshApplet);
        this.settings.bind("show_indicator", "show_indicator", this.refreshApplet);
        this.settings.bind("indicator_style", "indicator_style", this.refreshApplet);
        this.settings.bind("use_custom_size", "use_custom_size", this.refreshApplet);
        this.settings.bind("custom_height", "custom_height", this.refreshApplet);
        this.settings.bind("custom_width", "custom_width", this.refreshApplet);
        this.settings.bind("use_custom_opacity", "use_custom_opacity", this.refreshApplet);
        this.settings.bind("custom_opacity", "custom_opacity", this.refreshApplet);
        
        // Bind Custom Wallpapers (1 to 10 dynamically)
        this.settings.bind("enable_custom_wallpapers", "enable_custom_wallpapers", this._onWallpaperChanged);
        for (let i = 1; i <= 10; i++) {
            this.settings.bind(`bg_file_${i}`, `bg_file_${i}`, this._onWallpaperChanged);
        }

        // Listen to Desktop Background changes
        this.bgSettings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.background' });
        this.bgSettingsId = this.bgSettings.connect('changed::picture-uri', () => this.refreshApplet());

        this.wm = global.workspace_manager;
        
        this.wmSignals = [];
        this.displaySignals = [];
        this.wsSignals = [];
        
        this.mainBox = new St.BoxLayout();
        this.actor.add(this.mainBox);

        this._connectSignals();
        this._updateDesktopBackground();
        this.refreshApplet();
    }

    _connectSignals() {
        this.wmSignals.push(this.wm.connect('notify::n-workspaces', () => this._onWorkspacesChanged()));
        this.wmSignals.push(this.wm.connect('workspace-switched', () => {
            this._updateDesktopBackground();
            this.refreshApplet();
        }));
        
        this.displaySignals.push(global.display.connect('notify::focus-window', () => this.refreshApplet()));
        this.displaySignals.push(global.display.connect('restacked', () => this.refreshApplet()));

        this._connectWorkspaceSignals();
    }

    _connectWorkspaceSignals() {
        this._disconnectWorkspaceSignals();
        for (let i = 0; i < this.wm.n_workspaces; i++) {
            let ws = this.wm.get_workspace_by_index(i);
            this.wsSignals.push({ ws: ws, id: ws.connect('window-added', () => this.refreshApplet()) });
            this.wsSignals.push({ ws: ws, id: ws.connect('window-removed', () => this.refreshApplet()) });
        }
    }

    _disconnectWorkspaceSignals() {
        if (this.wsSignals) {
            for (let s of this.wsSignals) {
                s.ws.disconnect(s.id);
            }
        }
        this.wsSignals = [];
    }

    _onWorkspacesChanged() {
        this._connectWorkspaceSignals();
        this.refreshApplet();
    }

    _onWallpaperChanged() {
        this._updateDesktopBackground();
        this.refreshApplet();
    }

    _getWorkspaceWallpaper(index) {
        if (!this.enable_custom_wallpapers) return null;
        
        let fileVar = this[`bg_file_${index + 1}`];
        if (fileVar && fileVar !== "") {
            return fileVar.startsWith('file://') ? fileVar : 'file://' + fileVar;
        }
        return null;
    }

    _updateDesktopBackground() {
        if (!this.enable_custom_wallpapers) return;

        let activeIndex = this.wm.get_active_workspace_index();
        let customBg = this._getWorkspaceWallpaper(activeIndex);

        if (customBg) {
            let currentBg = this.bgSettings.get_string('picture-uri');
            if (currentBg !== customBg) {
                this.bgSettings.set_string('picture-uri', customBg);
            }
        }
    }

    refreshApplet() {
        this.mainBox.destroy_all_children();
        
        this.mainBox.style_class = `ow-workspace-switcher ow-workspace-switcher-${this.theme}`;

        if (this.use_custom_opacity) {
            let alpha = this.custom_opacity / 100;
            if (this.theme === 'dark') {
                this.mainBox.set_style(`background-color: rgba(45, 48, 56, ${alpha}); border: 1px solid rgba(20, 22, 26, ${alpha});`);
            } else {
                this.mainBox.set_style(`background-color: rgba(235, 238, 242, ${alpha}); border: 1px solid rgba(180, 185, 190, ${alpha});`);
            }
        } else {
            this.mainBox.set_style('');
        }

        let globalBgUri = this.bgSettings.get_string('picture-uri');
        let activeIndex = this.wm.get_active_workspace_index();

        for (let i = 0; i < this.wm.n_workspaces; i++) {
            let isActive = (i === activeIndex);
            let item = this._createWorkspaceItem(i, isActive, globalBgUri);
            this.mainBox.add_child(item);
        }
    }

    _createWorkspaceItem(index, isActive, globalBgUri) {
        let button = new St.Button({ reactive: true, can_focus: true });
        button.connect('clicked', () => {
            let ws = this.wm.get_workspace_by_index(index);
            if (ws) ws.activate(global.get_current_time());
        });

        let wrapper = new St.BoxLayout({ vertical: true, style_class: 'ow-ws-wrapper' });
        
        let box = new St.Bin({ style_class: `ow-ws-box ow-ws-box-${this.theme}` });
        if (isActive) box.add_style_class_name('ow-ws-box-active');

        if (!this.show_indicator) {
            box.add_style_class_name('ow-ws-box-no-indicator');
        }

        let dimmerBin = new St.Bin({ style_class: 'ow-ws-dimmer', x_fill: true, y_fill: true });
        let centerBin = new St.Bin({ x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, x_fill: true, y_fill: true });

        let boxStyle = "";

        if (this.use_custom_size) {
            boxStyle += `height: ${this.custom_height}px; width: ${this.custom_width}px; `;
        }

        let boxBgUri = this._getWorkspaceWallpaper(index) || globalBgUri;

        if (this.overview_mode) {
            if (boxBgUri) {
                boxStyle += `background-image: url("${boxBgUri}"); background-size: cover; background-position: center;`;
            } else {
                dimmerBin.remove_style_class_name('ow-ws-dimmer');
            }
            
            let ws = this.wm.get_workspace_by_index(index);
            let windows = ws.list_windows();
            
            let validWindows = windows.filter(w => 
                !w.is_skip_taskbar() && 
                w.window_type !== Meta.WindowType.DESKTOP && 
                !w.minimized
            );
            
            if (validWindows.length > 0) {
                let sortedWindows = global.display.sort_windows_by_stacking(validWindows);
                let topmostWin = sortedWindows[sortedWindows.length - 1]; 
                
                let tracker = Cinnamon.WindowTracker.get_default();
                let app = tracker.get_window_app(topmostWin);
                if (app) {
                    let icon = app.create_icon_texture(16); 
                    centerBin.set_child(icon);
                }
            }
        } else {
            dimmerBin.remove_style_class_name('ow-ws-dimmer');
            let label = new St.Label({ text: (index + 1).toString(), style_class: `ow-ws-label ow-ws-label-${this.theme}` });
            centerBin.set_child(label);
        }

        if (boxStyle !== "") {
            box.set_style(boxStyle);
        }

        dimmerBin.set_child(centerBin);
        box.set_child(dimmerBin);
        wrapper.add_child(box);

        if (this.show_indicator) {
            let indicatorArea = new St.Bin({ style_class: 'ow-ws-indicator-area', x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
            
            if (isActive) {
                let indicatorWidget;
                if (this.indicator_style === 'triangle') {
                    indicatorWidget = new St.Label({ text: '▲', style_class: `ow-ws-triangle-${this.theme}` });
                } else if (this.indicator_style === 'circle_filled') {
                    indicatorWidget = new St.Bin({ style_class: `ow-ws-circle-filled-${this.theme}` });
                } else if (this.indicator_style === 'circle_empty') {
                    indicatorWidget = new St.Bin({ style_class: `ow-ws-circle-empty-${this.theme}` });
                }
                indicatorArea.set_child(indicatorWidget);
            }
            wrapper.add_child(indicatorArea);
        }

        button.set_child(wrapper);
        return button;
    }

    on_applet_removed_from_panel() {
        if (this.bgSettingsId) {
            this.bgSettings.disconnect(this.bgSettingsId);
        }
        for (let s of this.wmSignals) {
            this.wm.disconnect(s);
        }
        for (let s of this.displaySignals) {
            global.display.disconnect(s);
        }
        this._disconnectWorkspaceSignals();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new OWWorkspaceSwitcher(metadata, orientation, panel_height, instance_id);
}
