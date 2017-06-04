const AppletUUID = "0dyseus@ExtensionsManager";
const AppletMeta = imports.ui.appletManager.appletMeta[AppletUUID];
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Lang = imports.lang;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const NotificationUrgency = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    CRITICAL: 3
};

const SPICES_URL = "http://cinnamon-spices.linuxmint.com";

Gettext.bindtextdomain(AppletUUID, GLib.get_home_dir() + "/.local/share/locale");

function _(aStr) {
    let customTrans = Gettext.dgettext(AppletUUID, aStr);

    if (customTrans !== aStr && aStr !== "")
        return customTrans;

    return Gettext.gettext(aStr);
}

function GenericButton(label) {
    this._init(label);
}

GenericButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(label) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });
        this.actor._delegate = this;
        this.button_name = "";

        this.label = new St.Label({
            text: label
        });

        this.addActor(this.label);
        this.label.realize();

        this.actor.reactive = false;

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
    }
};

function ConfirmationDialog() {
    this._init.apply(this, arguments);
}

ConfirmationDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    // Passing the OK and Cancel buttons labels as arguments to avoid initializing
    // the "translation functions" inside this file (appletModules.js).
    _init: function(aCallback, aDialogLabel, aDialogMessage) {
        ModalDialog.ModalDialog.prototype._init.call(this, {
            styleClass: null
        });

        let mainContentBox = new St.BoxLayout({
            style_class: 'polkit-dialog-main-layout',
            vertical: false
        });
        this.contentLayout.add(mainContentBox, {
            x_fill: true,
            y_fill: true
        });

        let messageBox = new St.BoxLayout({
            style_class: 'polkit-dialog-message-layout',
            vertical: true
        });
        mainContentBox.add(messageBox, {
            y_align: St.Align.START
        });

        this._subjectLabel = new St.Label({
            style_class: 'polkit-dialog-headline',
            text: aDialogLabel
        });

        messageBox.add(this._subjectLabel, {
            y_fill: false,
            y_align: St.Align.START
        });

        this._descriptionLabel = new St.Label({
            style_class: 'polkit-dialog-description',
            text: aDialogMessage
        });

        messageBox.add(this._descriptionLabel, {
            y_fill: true,
            y_align: St.Align.START
        });

        this.setButtons([{
            label: _("Cancel"),
            action: Lang.bind(this, function() {
                this.close();
            }),
            key: Clutter.Escape
        }, {
            label: _("OK"),
            action: Lang.bind(this, function() {
                this.close();
                aCallback();
            })
        }]);
    }
};

function CustomSwitchMenuItem() {
    this._init.apply(this, arguments);
}

CustomSwitchMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(aApplet, aExtensionObj, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.applet = aApplet;
        this.extension = aExtensionObj;
        this._extension_icon_size = this.applet.pref_extension_icon_size;

        // Elements creation
        this.label = new St.Label({
            text: (this.applet.pref_use_extension_names_as_label ?
                this.extension.name :
                this.extension.uuid)
        });

        if (this.applet.pref_max_width_for_menu_items_label !== 0) {
            this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            this.label.set_style("max-width: " + this.applet.pref_max_width_for_menu_items_label + "em;");
        }

        if (this.applet.pref_icons_on_menu)
            this._icon = this._createIcon(this.extension.image);

        this._statusBin = new St.BoxLayout({
            vertical: false,
            style: "spacing: 10px;",
            x_align: St.Align.END
        });
        this._switch = new PopupMenu.Switch(this.extension.is_enabled);

        if (this.applet.pref_show_config_button) {
            let iconSettings = new St.Icon({
                icon_name: "system-run",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: aApplet.pref_extension_options_icon_size,
                style_class: "popup-menu-icon"
            });
            this.settingsButton = new St.Button({
                child: iconSettings
            });

            if (this.extension.setting_type !== 0 && this.extension.is_enabled) {
                this._addConnectionsAndTooltipToButton("settingsButton",
                    _("Open settings window"),
                    "_settings");
            } else {
                this.settingsButton.set_opacity(0);
            }
        }

        if (this.applet.pref_show_spices_button) {
            let iconSpices = new St.Icon({
                icon_name: "extensions-manager-internet",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: aApplet.pref_extension_options_icon_size,
                style_class: "popup-menu-icon"
            });
            this.spicesButton = new St.Button({
                child: iconSpices
            });

            if (this.extension.spices_id !== "") {
                this._addConnectionsAndTooltipToButton("spicesButton",
                    _("Spices page"),
                    "_openSpicesSite");
            } else {
                this.spicesButton.set_opacity(0);
            }
        }

        if (this.applet.pref_show_edit_extension_file_button) {
            let iconEdit = new St.Icon({
                icon_name: "extensions-manager-edit",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: aApplet.pref_extension_options_icon_size,
                style_class: "popup-menu-icon"
            });
            this.editButton = new St.Button({
                child: iconEdit
            });

            this._addConnectionsAndTooltipToButton("editButton",
                _("Edit extension main file"),
                "_editExtensionFile");
        }

        if (this.applet.pref_show_open_extension_folder_button) {
            let iconFolder = new St.Icon({
                icon_name: "extensions-manager-folder",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: aApplet.pref_extension_options_icon_size,
                style_class: "popup-menu-icon"
            });
            this.folderButton = new St.Button({
                child: iconFolder
            });

            this._addConnectionsAndTooltipToButton("folderButton",
                _("Open extension folder"),
                "_openExtensionFolder");
        }

        // Elements insertion
        if (this.applet.pref_icons_on_menu)
            this.addActor(this._icon, {
                span: 0
            });

        this.addActor(this.label);
        this.addActor(this._statusBin, {
            expand: true,
            span: -1,
            align: St.Align.END
        });

        if (this.applet.pref_show_config_button)
            this._statusBin.add(this.settingsButton);

        if (this.applet.pref_show_spices_button)
            this._statusBin.add(this.spicesButton);

        if (this.applet.pref_show_open_extension_folder_button)
            this._statusBin.add(this.folderButton);

        if (this.applet.pref_show_edit_extension_file_button)
            this._statusBin.add(this.editButton);

        this._statusBin.add(this._switch.actor);

        this.tooltip = new Tooltips.Tooltip(this.actor, "");
        this.tooltip._tooltip.set_style("text-align: left;max-width: 450px;");
        this.tooltip._tooltip.get_clutter_text().set_line_wrap(true);
        this.tooltip._tooltip.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.tooltip._tooltip.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE; // Just in case
        // Ensure tooltip is destroyed when this button is destroyed
        this.connect("destroy", Lang.bind(this, function() {
            this.tooltip.destroy();
        }));
        this._setTooltip();
    },

    _addConnectionsAndTooltipToButton: function(aButton, aText, aCallback) {
        this[aButton].connect("clicked", Lang.bind(this, this[aCallback]));
        this[aButton].connect("enter-event", Lang.bind(this, this._onButtonEnterEvent));
        this[aButton].connect("leave-event", Lang.bind(this, this._onButtonLeaveEvent));
        this[aButton].tooltip = new Tooltips.Tooltip(this[aButton], aText);
        // Ensure tooltip is destroyed when this button is destroyed
        this[aButton].connect("destroy", Lang.bind(this, function() {
            this[aButton].tooltip.destroy();
        }));
    },

    _setTooltip: function(aButton, aText, aCallback) { // jshint ignore:line
        try {
            this.tooltip._tooltip.get_clutter_text().set_markup(
                '<span weight="bold">' + _("Name") + ': </span>' + this.extension.name + "\n" +
                '<span weight="bold">UUID: </span>' + this.extension.uuid + "\n" +
                '<span weight="bold">' + _("Description") + ': </span>' + this.extension.description
            );
        } catch (aErr) {
            // global.logError(aErr);
            this.tooltip._tooltip.set_text(
                _("Name") + ": " + this.extension.name + "\n" +
                "UUID: " + this.extension.uuid + "\n" +
                _("Description") + ": " + this.extension.description
            );
        }
    },

    _onButtonEnterEvent: function(event) { // jshint ignore:line
        this.tooltip.preventShow = true;
        this.tooltip.hide();
    },

    _onButtonLeaveEvent: function(event) { // jshint ignore:line
        this.tooltip.preventShow = false;
    },

    activate: function(event) {
        if (event.get_button() === 1 && this._switch.actor.mapped) {
            this.toggle();
        }
    },

    toggle: function() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    },

    get state() {
        return this._switch.state;
    },

    setToggleState: function(state) {
        this._switch.setToggleState(state);
    },

    _createIcon: function(aIconName) {
        // If aIconName is a path to an icon
        if (aIconName[0] === '/') {
            let file = Gio.file_new_for_path(aIconName);
            let iconFile = new Gio.FileIcon({
                file: file
            });

            return new St.Icon({
                gicon: iconFile,
                icon_size: this._extension_icon_size
            });
        } else { // use a themed icon
            return new St.Icon({
                icon_name: aIconName,
                icon_size: this._extension_icon_size,
                icon_type: St.IconType.FULLCOLOR
            });
        }
    },

    _settings: function() {
        try {
            switch (this.extension.setting_type) {
                case 1: // Internal settings (Cinnamon's native)
                    Util.spawn_async([
                        "cinnamon-settings",
                        "extensions",
                        this.extension.uuid
                    ]);
                    break;
                case 2: // External settings (exteral app)
                    Util.spawn_async([this.extension.ext_config_app]);
                    break;
            }
        } catch (aErr) {
            global.logError(aErr);
        } finally {
            this.applet.menu.close(false);
        }
    },

    _openSpicesSite: function(aEvent) { // jshint ignore:line
        try {
            Util.spawn_async(["xdg-open", SPICES_URL + "/extensions/view/" +
                this.extension.spices_id
            ]);
        } catch (aErr) {
            global.logError(aErr);
        } finally {
            this.applet.menu.close(false);
        }
    },

    _openExtensionFolder: function(aEvent) { // jshint ignore:line
        try {
            Util.spawn_async(["xdg-open", this.extension.extension_dir]);
        } catch (aErr) {
            global.logError(aErr);
        } finally {
            this.applet.menu.close(false);
        }
    },

    _editExtensionFile: function(aEvent) { // jshint ignore:line
        try {
            Util.spawn_async(["xdg-open", this.extension.extension_dir + "/extension.js"]);
        } catch (aErr) {
            global.logError(aErr);
        } finally {
            this.applet.menu.close(false);
        }
    }
};

function informJSONError(aMsg) {
    customNotify(
        _(AppletMeta.name),
        _("Error parsing JSON string.") + "\n" +
        aMsg + "\n" +
        _("A detailed error has been logged into ~/.cinnamon/glass.log."),
        "dialog-warning",
        NotificationUrgency.CRITICAL, [{
            label: "~/.cinnamon/glass.log", // Just in case.
            tooltip: "~/.cinnamon/glass.log",
            iconName: "extensions-manager-edit-find",
            callback: function() {
                Gio.AppInfo.launch_default_for_uri(
                    "file://" + GLib.get_home_dir() + "/.cinnamon/glass.log",
                    null
                );
            }
        }]);
}

function customNotify(aTitle, aBody, aIconName, aUrgency, aButtons) {
    let icon = new St.Icon({
        icon_name: aIconName,
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 24
    });
    let source = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(source, aTitle, aBody, {
        icon: icon,
        bodyMarkup: true,
        titleMarkup: true,
        bannerMarkup: true
    });
    notification.setTransient(aUrgency === NotificationUrgency.LOW);

    if (aUrgency !== NotificationUrgency.LOW && typeof aUrgency === "number") {
        notification.setUrgency(aUrgency);
    }

    try {
        if (aButtons && typeof aButtons === "object") {
            let i = 0,
                iLen = aButtons.length;
            for (; i < iLen; i++) {
                let btnObj = aButtons[i];
                try {
                    if (!notification._buttonBox) {

                        let box = new St.BoxLayout({
                            name: "notification-actions"
                        });
                        notification.setActionArea(box, {
                            x_expand: true,
                            y_expand: false,
                            x_fill: true,
                            y_fill: false,
                            x_align: St.Align.START
                        });
                        notification._buttonBox = box;
                    }

                    let button = new St.Button({
                        can_focus: true
                    });

                    if (btnObj.iconName) {
                        notification.setUseActionIcons(true);
                        button.add_style_class_name("notification-icon-button");
                        button.child = new St.Icon({
                            icon_name: btnObj.iconName,
                            icon_type: St.IconType.SYMBOLIC,
                            icon_size: 16
                        });
                    } else {
                        button.add_style_class_name("notification-button");
                        button.label = btnObj.label;
                    }

                    button.connect("clicked", btnObj.callback);

                    if (btnObj.tooltip) {
                        button.tooltip = new Tooltips.Tooltip(
                            button,
                            btnObj.tooltip
                        );
                        button.connect("destroy", function() { // jshint ignore:line
                            button.tooltip.destroy();
                        });
                    }

                    if (notification._buttonBox.get_n_children() > 0)
                        notification._buttonFocusManager.remove_group(notification._buttonBox);

                    notification._buttonBox.add(button);
                    notification._buttonFocusManager.add_group(notification._buttonBox);
                    notification._inhibitTransparency = true;
                    notification.updateFadeOnMouseover();
                    notification._updated();
                } catch (aErr) {
                    global.logError(aErr);
                    continue;
                }
            }
        }
    } finally {
        source.notify(notification);
    }
}

/*
exported informJSONError
 */
