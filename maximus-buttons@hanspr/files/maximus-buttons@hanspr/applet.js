const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const APPNAME = 'Maximus Tittle Buttons';
const tracker = Cinnamon.WindowTracker.get_default();
const UUID = 'maximus-title-buttons@hanspr';

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight, instanceId);
            this.metadata = metadata;
            this.uuid = metadata.uuid;
            this.orientation = orientation;
            this.panelHeight = panelHeight;
            this.instanceId = instanceId;
            this.appletPath = metadata.path;
            this.hide_applet_label(false);
            this.bindSettings();
            this.connectSignals();
            this.initButtons();
            setTimeout(() => {
                this.initialized = true
            }, 500);
        } catch (e) {
            global.logError(e);
        }
    }

    initButtons() {
        let buttons = this.buttons_style.split(":");
        if (this.checkButton(buttons, "maximize") || this.checkButton(buttons, "minimize") || this.checkButton(buttons, "close")) {
            this.loadTheme();
        }
        this.button = [];
        this.createButtons(this.buttons_style);
        this.on_panel_edit_mode_changed;
    }

    bindSettings() {
        this.settings = new Settings.AppletSettings(this, this.uuid, this.instanceId);

        this.settings.bind("buttons-style", "buttons_style", this.on_settings_changed);
        this.settings.bind("buttons-theme", "buttonsTheme");
        this.settings.bind("only-maximized", "onlyMaximized", this.on_settings_changed);
        this.settings.bind("hide-buttons", "hideButtons", this.on_settings_changed);
        this.settings.bind("on-desktop-shutdown", "onDesktopShutdown", this.on_settings_changed);
    }

    connectSignals() {
        this.signalManager = new SignalManager.SignalManager(null);

        this.signalManager.connect(Main.themeManager, 'theme-set', this.loadTheme, this);
        this.signalManager.connect(global.settings, 'changed::panel-edit-mode', this.on_panel_edit_mode_changed, this);
        this.signalManager.connect(global.window_manager, 'size-change', this._windowChange, this);
        this.signalManager.connect(global.display, 'notify::focus-window', this._windowFocus, this);
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean("panel-edit-mode");

        let b = this.buttons_style.split(":");
        for (let i = 0; i < b.length; ++i) {
            this.button[b[i]].reactive = reactive;
        }
    }

    getCssPath(theme) {
        let cssPath = this.appletPath + "/themes/" + theme + "/style.css";
        return cssPath;
    }

    loadTheme() {
        this.actor.set_style_class_name("window-buttons");
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        theme.load_stylesheet(this.getCssPath(this.buttonsTheme));
        this.oldTheme = this.buttonsTheme;
    }

    createButtons(buttonsStyle) {
        buttonsStyle = buttonsStyle.split(":");
        for (let i = 0; i < buttonsStyle.length; ++i) {
            let buttonName = buttonsStyle[i] + "Button";
            this[buttonName]();
        }
    }

    iconButton() {
        this.button["icon"] = new St.Button({
            name: "iconButton",
            style_class: "window-list-item",
            reactive: true
        });
        this.actor.add(this.button["icon"]);
    }

    minimizeButton() {
        this.button["minimize"] = new St.Button({
            name: "windowButton",
            style_class: "minimize window-button",
            reactive: true
        });
        this.actor.add(this.button["minimize"]);
        this.button["minimize"].connect("button-press-event", (actor, event) => {
            let button = event.get_button();
            if (button == 1) {
                this.minimizeWindow();
                return true;
            } else if (button == 3) {
                this._applet_context_menu.toggle();
            }
            return true;
        });
    }

    minimizeWindow() {
        if (this.button["minimize"].opacity == 0) {
            return false;
        }
        let activeWindow = global.display.focus_window;
        let app = tracker.get_window_app(activeWindow);
        if (!app) {
            return;
        } else {
            activeWindow.minimize();
        }
    }

    maximizeButton() {
        this.button["maximize"] = new St.Button({
            name: "windowButton",
            style_class: "maximize window-button",
            reactive: true
        });
        this.actor.add(this.button["maximize"]);
        this.button["maximize"].connect("button-press-event", (actor, event) => {
            let button = event.get_button();
            if (button == 1) {
                this.maximizeWindow();
                return true;
            } else if (button == 3) {
                this._applet_context_menu.toggle();
            }
            return true;
        });
    }

    maximizeWindow() {
        if (this.button["maximize"].opacity == 0) {
            return false;
        }
        let activeWindow = global.display.focus_window;
        if (activeWindow) {
            let app = tracker.get_window_app(activeWindow);
            if (!app) {
                return;
            } else {
                if (activeWindow.get_maximized()) {
                    activeWindow.unmaximize(3);
                } else {
                    activeWindow.maximize(3);
                }
            }
        }

    }

    closeButton() {
        this.button["close"] = new St.Button({
            name: "windowButton",
            style_class: "close window-button",
            reactive: true
        });
        this.actor.add(this.button["close"]);
        this.button["close"].connect("button-press-event", (actor, event) => {
            let button = event.get_button();
            if (button == 1) {
                this.closeWindow();
                return true;
            } else if (button == 3) {
                this._applet_context_menu.toggle();
            }
            return true;
        });
    }

    closeWindow() {
        if (this.button["close"].opacity == 0) {
            return false;
        }
        let activeWindow = global.display.focus_window;
        let app = tracker.get_window_app(activeWindow);

        if (!app) {
            if (this.onDesktopShutdown == true) {
                this._session.ShutdownRemote();
            }
            return;
        } else {
            activeWindow.delete(global.get_current_time());
        }

    }

    updateWindowIcon() {
        let activeWindow = global.display.focus_window;
        if (activeWindow) {
            let app = tracker.get_window_app(activeWindow);
            if (app) {
                let icon = tracker.get_window_app(activeWindow).create_icon_texture(this.titleIconWidth);
                this.button["icon"].set_child(icon);
                this.actor.add(this.button['icon']);
            } else {
                let size = parseInt(this.titleIconWidth);
                size = size;
                size = size.toString();
                let icon = new St.Icon({
                    icon_name: "video-display",
                    icon_type: St.IconType.SYMBOLIC,
                    style: "icon-size:24px;"
                });
                this.button["icon"].set_child(icon);
            }
        } else {
            let size = parseInt(this.titleIconWidth);
            size = size;
            size = size.toString();
            let icon = new St.Icon({
                icon_name: "video-display",
                icon_type: St.IconType.SYMBOLIC,
                style: "icon-size:24px;"
            });
            this.button["icon"].set_child(icon);
        }
    }

    _windowFocus() {
        this._windowChange()
    }

    _windowChange(shellwm, actor, change) {
        let buttons = this.buttons_style.split(":");
        if (this.checkButton(buttons, "icon")) {
            this.updateWindowIcon();
        }
        if (this.onlyMaximized == true) {
            this.onlyMaximize();
        } else {
            for (let i = 0; i < buttons.length; ++i) {
                this.button[buttons[i]].show();
                this.button[buttons[i]].opacity = 255;
            }
        }
    }

    on_settings_changed() {
        this.actor.destroy_all_children();
        let buttons = this.buttons_style.split(":");
        if (this.checkButton(buttons, "maximize") || this.checkButton(buttons, "minimize") || this.checkButton(buttons, "close")) {
            this.loadTheme();
        }
        this.button = [];
        this.createButtons(this.buttons_style);
        this._windowChange();
    }

    checkButton(arr, obj) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] == obj) {
                return true;
            }
        }
        return null;
    }

    onlyMaximize() {
        let w = global.display.focus_window;
        let app = tracker.get_window_app(w);
        let buttons = this.buttons_style.split(":");
        if (app && w.get_maximized()) {
            for (let i = 0; i < buttons.length; ++i) {
                this.button[buttons[i]].show();
                this.button[buttons[i]].opacity = 255;
            }
        } else {
            for (let i = 0; i < buttons.length; ++i) {
                if (!this.hideButtons) {
                    this.button[buttons[i]].hide();
                }
                if (buttons[i] != "icon") {
                    this.button[buttons[i]].opacity = 0;
                }
            }
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}