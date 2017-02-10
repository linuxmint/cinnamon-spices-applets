/*
 *  Window Buttons applet for Cinnamon
 *  - Adds window buttons to the panel.
 *
 * Copyright (C) 2011-2012
 *	 Josiah Messiah <josiah.messiah@gmail.com>,
 *	 Daniel Liptrot <robotdan2003@yahoo.co.uk>
 *
 * Window Buttons is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Window Buttons is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Window Buttons.  If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GConf = imports.gi.GConf;
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

// Settings
const WA_SETTINGS_SCHEMA = 'org.cinnamon.applets.windowButtons@lippy';
const WA_PINCH = 'pinch';
const WA_ORDER = 'order';
const WA_THEME = 'theme';
const WA_DOGTK = 'dogtk';
const WA_ONLYMAX = 'onlymax';
const WA_HIDEONNOMAX = 'hideonnomax';

let appletPath = "";

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);

        try {
            // Load settings.
            this._settings = new Gio.Settings({ schema: WA_SETTINGS_SCHEMA });

            // Stop the entire applet from being highlighted on mouseover by default.
            this.actor.set_style_class_name("window-buttons");

            // Used to reference the maximize button in order to make it dynamic in appearance.
            this.maximizePos = -1;
            // Records the state of the maximize button. Squashes a bug where it can be stuck in its highlighted state.
            this.maximizeState = true;
            // The maximize button can change state, so this keeps it disabled in panel edit mode.
            this.isInPanelEditMode = false;
            // Box for the buttons.
            this.rightBox = null;
            // Array for the buttons.
            this.button = [];
            // So we can hotswap themes.
            this.oldTheme = "";

            // Do the donkey work.
            this._loadApplet();

            // Connect to window change events.
            let tracker = Cinnamon.WindowTracker.get_default();
            tracker.connect('notify::focus-app', Lang.bind(this, this._windowChanged));
            global.window_manager.connect('switch-workspace', Lang.bind(this, this._windowChanged));
            global.window_manager.connect('minimize', Lang.bind(this, this._windowChanged));
            global.window_manager.connect('maximize', Lang.bind(this, this._windowChanged));
            global.window_manager.connect('unmaximize', Lang.bind(this, this._windowChanged));
            global.window_manager.connect('map', Lang.bind(this, this._windowChanged));
            global.window_manager.connect('destroy', Lang.bind(this, this._windowChanged));

            // Connect to setting change events.
            this._settings.connect('changed::'+WA_DOGTK, Lang.bind(this, this._loadApplet));
            this._settings.connect('changed::'+WA_THEME, Lang.bind(this, this._loadApplet));
            this._settings.connect('changed::'+WA_ORDER, Lang.bind(this, this._loadApplet));
            this._settings.connect('changed::'+WA_PINCH, Lang.bind(this, this._loadApplet));
            this._settings.connect('changed::'+WA_HIDEONNOMAX, Lang.bind(this, this._hideonnomaxChanged));
            this._settings.connect('changed::'+WA_ONLYMAX, Lang.bind(this, this._windowChanged));

            // Connect to panel edit event.
            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {},

    on_panel_edit_mode_changed: function() {
        // Disable buttons in panel edit mode.
        this.isInPanelEditMode = !global.settings.get_boolean('panel-edit-mode');
        for ( let i = 0; i < this.button.length; ++i ) {
            this.button[i].reactive = this.isInPanelEditMode;
        }
    },

    _loadApplet: function() {
        // Load theme.
        this._loadTheme();

        // Add the buttons.
        this._addButtons();

        // Make applet draggable in panel edit mode.
        this.on_panel_edit_mode_changed();

        // Show or hide buttons.
        this._hideonnomaxChanged();
    },

    _addButtons: function() {
        // Clean up first.
        for ( let i = 0; i < this.button.length; ++i ) {
            this.button[i].destroy();
        }
        this.button = [];
        if (this.rightBox) {
            this.rightBox.destroy();
            this.rightBox = null;
        }
        this.maximizePos = -1;
        this.maximizeState = true;

        // Create a box for the buttons.
        this.rightBox = new St.BoxLayout({ style_class: 'button-box' });
        this.actor.add(this.rightBox);

        let pinch = this._settings.get_enum(WA_PINCH);

        // Grab the button order depending on the settings.
        switch (pinch) {
            case 0: // Use custom layout.
                order = this._settings.get_string(WA_ORDER);
                break;
            case 1: // Use Cinnamon layout.
                order = GConf.Client.get_default().get_string("/desktop/cinnamon/windows/button_layout");
                break;
            case 2: // Use Metacity layout.
                order = GConf.Client.get_default().get_string("/apps/metacity/general/button_layout");
                break;
        }

        // Button tooltips and functions. Should change this in future as the restore tooltip had to be defined somewhere else.
        let buttonlist = { minimize : [_("Minimize Window"), this._minimize],
                           maximize : [_("Maximize Window"), this._maximize],
                           close    : [_("Close Window"), this._close] } ;

        // We have the string; now we split it into an array.
        let orders = order.split(':');
        let orderRight = orders[1].split(',');

        // Add the buttons to the applet in the correct order.
        if (orderRight != "") {
            for ( let i = 0; i < orderRight.length; ++i ) {
                this.button[i] = new St.Button({ name: 'windowButton',
                                                 style_class: orderRight[i] + ' window-button',
                                                 reactive: true } );
                //this.button[i].set_tooltip_text( buttonlist[orderRight[i]][0] );
                this.button[i].connect('button-release-event', Lang.bind(this, buttonlist[orderRight[i]][1]));
                this.rightBox.add_actor(this.button[i]);
                // If the button is maximize, grab its position in the array so we can reference it later.
                // This is so we can dynamically change its appearance.
                if (orderRight[i] == "maximize") {
                    this.maximizePos = i;
                }
            }
        }
    },

    _loadTheme: function() {
        let newTheme = "default";
        let dogtk = this._settings.get_boolean(WA_DOGTK);

        if (dogtk) {
            // Get Cinnamon theme name.
            newTheme = GConf.Client.get_default().get_string("/desktop/cinnamon/windows/theme");
        } else {
            // Get custom theme name.
            newTheme = this._settings.get_string(WA_THEME);
        }

        // Nothing to do here.
        if (newTheme == this.oldTheme) {
            return;
        }

        // Saves us from having to do this twice.
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();

        // Unload old theme so we can hotswap it for a new shiny one.
        if (this.oldTheme != "") {
            theme.unload_stylesheet(this._getCssPath(this.oldTheme));
        }

        // Apply new theme. Old method, no longer requires restart really. ;)
        theme.load_stylesheet(this._getCssPath(newTheme));

        // Remember old theme so we can hotswap it later.
        this.oldTheme = newTheme;
    },

    _getCssPath: function(theme) {
        // Get CSS of new theme, and check it exists, falling back to 'default'
        let cssPath = appletPath + '/themes/' + theme + '/style.css';
        let cssFile = Gio.file_new_for_path(cssPath);
        if (!cssFile.query_exists(null)) {
            cssPath = appletPath + '/themes/default/style.css';
        }

        return cssPath;
    },

    _windowChanged: function() {
        let activeWindow = global.display.focus_window;
        let hideonnomax = this._settings.get_boolean(WA_HIDEONNOMAX);
        let onlymax = this._settings.get_boolean(WA_ONLYMAX);
        let upperMax = false;
        let isActiveWindowMaximized = false;

        if (onlymax) {
            // The onlymax option uses a different set of rules. Here the window buttons control the uppermost window that is maximized.
            upperMax = this._upperMax();

            // Hide buttons when there are no maximized windows.
            if (hideonnomax) {
                if (upperMax) {
                    this.actor.show();
                } else {
                    this.actor.hide();
                    // Might as well end it now. Nothing else to do here...
                    return;
                }
            }
        } else {
            // Otherwise it's standard behaviour. Window buttons control the active window.
            isActiveWindowMaximized = activeWindow ? activeWindow.get_maximized() : false;

            // Hide buttons when active window is maximized if option is set.
            if (hideonnomax) {
                if (isActiveWindowMaximized) {
                    this.actor.show();
                } else {
                    this.actor.hide();
                    // Might as well end it now. Nothing else to do here...
                    return;
                }
            }
        }

        // No need to do any more if the maximize button isn't displayed.
        if (this.maximizePos == -1) {
            return;
        }

        // Swap out the maximize button for the restore button or vice versa if required.
        if (!this.maximizeState) {
            // Nice convoluted if statement here. It's either this or add a few guards, but the latter won't do much good here.
            if ((onlymax && !upperMax) || (!onlymax && (!isActiveWindowMaximized || activeWindow.get_title() == "Desktop"))) {
                // No active windows, or active window is not maximized. No need to do this if buttons are hidden.
                // Alternatively if onlymax is set, there are no maximized windows.
                this.button[this.maximizePos].set_tooltip_text(_("Maximize Window"));
                this.button[this.maximizePos].style_class = 'maximize window-button';
                this.button[this.maximizePos].reactive = this.isInPanelEditMode;
                this.maximizeState = true;
            }
        } else if (upperMax || isActiveWindowMaximized) {
            // Button is maximize. Active window is maximized, or onlymax is set and at least one window is maximized.
            this.button[this.maximizePos].set_tooltip_text(_("Restore Window"));
            this.button[this.maximizePos].style_class = 'restore window-button';
            this.button[this.maximizePos].reactive = this.isInPanelEditMode;
            this.maximizeState = false;
        }
    },

    _hideonnomaxChanged: function() {
        // Show the buttons by default. The _windowChanged() function can take care of the rest.
        this.actor.show();
        this._windowChanged();
    },

    _upperMax: function() {
        let maxwin = false;
        let winactors = global.get_window_actors();
        let window = null;
        let currentWorkspace = global.screen.get_active_workspace();

        // Return the uppermost maximized window from the current workspace, or false if there is none
        for ( let i = winactors.length - 1; i >= 0; --i ) {
            window = winactors[i].get_meta_window();
            if (window.get_workspace() == currentWorkspace && window.get_maximized() && !window.minimized) {
                // Maximized window get!
                maxwin = window;
                break;
            }
        }

        return maxwin;
    },

    _minimize: function() {
        let activeWindow = global.display.focus_window;
        let onlymax = this._settings.get_boolean(WA_ONLYMAX);

        // Run for the hills if no windows are active.
        if (!activeWindow || activeWindow.get_title() == _("Desktop")) {
            return;
        }

        if (onlymax && !activeWindow.get_maximized()) {
            // If the active window is not maximized, minimize the uppermost 
            // maximized window if the option to only control maximized windows is set
            let uppermax = this._upperMax()
            if ( uppermax ) {
                uppermax.minimize();
                activeWindow.activate(global.get_current_time());
            } else {
                // If no maximized windows, minimize the active window
                activeWindow.minimize();
            }
        } else {
            // Otherwise minimize the active window
            activeWindow.minimize();
        }
    },

    _maximize: function() {
        let activeWindow = global.display.focus_window;
        let onlymax = this._settings.get_boolean(WA_ONLYMAX);

        // Run for the hills if no windows are active.
        if (!activeWindow || activeWindow.get_title() == "Desktop") {
            return;
        }

        if (activeWindow.get_maximized()) {
            // If the active window is maximized, unmaximize it
            activeWindow.unmaximize(3);
        } else if (onlymax) {
            // If the active window is not maximized, unmaximize the uppermost 
            // maximized window if the option to only control maximized windows is set
            let uppermax = this._upperMax()
            if ( uppermax ) {
                uppermax.unmaximize(3);
                activeWindow.activate(global.get_current_time());
            } else {
                activeWindow.maximize(3);
            }
        } else {
            // Otherwise maximize the active window
            activeWindow.maximize(3);
        }

        // Toggle maximize button appearance.
        this._windowChanged();
    },

    _close: function() {
        let activeWindow = global.display.focus_window;
        let onlymax = this._settings.get_boolean(WA_ONLYMAX);

        // Run for the hills if no windows are active.
        if (!activeWindow || activeWindow.get_title() == "Desktop") {
            return;
        }

        if (onlymax && !activeWindow.get_maximized()) {
            // If the active window is not maximized, close the uppermost 
            // maximized window if the option to only control maximized windows is set
            let uppermax = this._upperMax()
            if ( uppermax ) {
                uppermax.delete(global.get_current_time());
                activeWindow.activate(global.get_current_time());
            } else {
                // If no maximized windows, close the active window
                activeWindow.delete(global.get_current_time());
            }
        } else {
            // Otherwise close the active window.
            activeWindow.delete(global.get_current_time());
        }
    },
};

function main(metadata, orientation) {
    appletPath = metadata.path;
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
