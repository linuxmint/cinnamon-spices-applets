const Gio                                = imports.gi.Gio;
const St                                 = imports.gi.St;
const Tooltips                           = imports.ui.tooltips;
const Applet                             = imports.ui.applet;

const DEFAULT_PANEL_HEIGHT               = Applet.DEFAULT_PANEL_HEIGHT;
const PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT = Applet.PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT;

// ------------------------------------------------------------------------------------------------------

function CSCollapseBtn(applet) {
    this._init(applet);
}

CSCollapseBtn.prototype = {
    _init: function(applet) {
        this._applet = applet;
        this.actor   = new St.Button({ style_class: 'applet-box' });
        this.icon    = new St.Icon({ reactive: true, track_hover: true, style_class: 'applet-icon' });

        this.actor.set_child(this.icon);

        this.setIsExpanded(true);
    },

    /*
     * Set the icon using it's qualified name
     */
    setIcon: function(name) {
        this.icon.set_icon_name(name);
        this.icon.set_icon_type(St.IconType.SYMBOLIC);
        this._setStyle();
    },

    /*
     * Set the icon using a file path
     */
    setIconFile: function(iconFile) {
        try {
            this.icon.set_gicon(new Gio.FileIcon({ file: iconFile }));
            this.icon.set_icon_type(St.IconType.SYMBOLIC);
            this._setStyle();
        } catch (e) {
            global.log(e);
        }
    },

    /*
     *
     */
    _setStyle: function() {
        let symb_scaleup = ((this._applet._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT) / global.ui_scale;

        this.icon.set_icon_size(this._applet._scaleMode ? symb_scaleup : -1);
        this.icon.set_style_class_name('system-status-icon');
    },

    /*
     * Set expanded state and refresh the icon
     */
    setIsExpanded: function(state) {
        let iconName = state ? this._applet.collapseIcon : this._applet.expandIcon;
        if (!iconName) {
            return;
        }

        let iconFile = Gio.File.new_for_path(iconName);
        if (iconFile.query_exists(null)) {
            this.setIconFile(iconFile);
        } else {
            this.setIcon(iconName);
        }
    }
}
