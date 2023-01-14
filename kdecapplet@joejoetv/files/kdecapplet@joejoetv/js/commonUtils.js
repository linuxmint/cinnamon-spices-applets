const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const Gtk = imports.gi.Gtk;
const Signals = imports.signals;

const SignalManager = imports.misc.signalManager;

// Common constants
const UUID = "kdecapplet@joejoetv";
const KDECONNECT_DBUS_NAME = "org.kde.kdeconnect";

const DefaultIcons = {
    "SYMBOLIC": "kdeconnect-tray",
    "COLOR": "kdeconnect"
}

function utilInfo(msg, name) {
    global.log("[" + UUID + "] (" + name + ") " + msg);
}

function utilWarn(msg, name) {
    global.log("[" + UUID + "] (" + name + ") " + msg);
}

function utilError(msg, name) {
    global.log("[" + UUID + "] (" + name + ") " + msg);
}

function getAvailableFilename(directory, filename, extension) {
    let dirPath = GLib.build_filenamev([directory]);
    let dirFile = Gio.File.new_for_path(dirPath);

    let fileType = dirFile.query_file_type(Gio.FileQueryInfoFlags.NONE, null);

    if (fileType == Gio.FileType.DIRECTORY) {
        // File exists and id directory
        
        // If file can be saved as is, directly return filename
        let filePath = GLib.build_filenamev([dirPath, filename+"."+extension]);
        let file = Gio.File.new_for_path(filePath);
        
        if (file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.UNKNOWN) {
            // Filename is free

            utilInfo("File path directly free: "+filePath, "getAvailableFilename");

            return filePath
        } else {
            // Filename is already in use, add number until it's free

            let counter = 1;
            let found = false;

            while (found == false) {
                filePath = GLib.build_filenamev([dirPath, filename+"-"+counter+"."+extension]);
                file = Gio.File.new_for_path(filePath);

                if (file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.UNKNOWN) {
                    found = true;
                } else {

                    // Failsafe if counter is too large to be realistically viable
                    if (counter > 1000000) {
                        utilWarn("Aborted checking for filename. Why do you have over 1000000 files with the same base name?", "getAvailableFilename");
                        return null;
                    }

                    counter = counter + 1;
                }
            }

            return filePath;
        }

    } else {
        // File doesn't exists or is a different type
        return null;
    }
}

function openURL(url) {
    Util.spawnCommandLine('xdg-open "'+url+'"');
}

function copyAndNotify(notificationSource, text, typestring) {
    try {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    
        let notification = new MessageTray.Notification(notificationSource, "KDE Connect Applet", _("Copied {typestring} to the clipboard").replace("{typestring}", typestring));
        notification.setTransient(true);
        notificationSource.notify(notification);
    } catch (error) {
        utilError("[Notification] Error while sending notification: " + error, "copyAndNotify");
    }
}

class AppletNotificationSource extends MessageTray.Source {
    constructor(appletName) {
        super(appletName);

        this._setSummaryIcon(this.createNotificationIcon());
    }

    createNotificationIcon() {
        return new St.Icon({
            icon_name: "kdeconnect",
            icon_type: St.IconType.APPLICATION,
            icon_size: this.ICON_SIZE
        });
    }

    open() {
        this.destroy();
    }
}

class MenuItemIconButton {
    constructor(iconName, iconType) {
        this.actor = new St.Bin({style_class: 'notification-button',
            track_hover: true, hover: true, reactive: true, can_focus: true, x_expand: false, margin_right: 0});

        this._icon = new St.Icon({style_class: 'popup-menu-icon',icon_name: iconName, icon_type: iconType});

        this.tooltip = new Tooltips.Tooltip(this.actor, "");

        // Hide tooltip by default
        this.tooltip.preventShow = true;

        this._signals = new SignalManager.SignalManager(null);

        // Add class to change padding, margin and border-radius, so button can be small enough for the popup menu item
        this.actor.add_style_class_name("kdec-popup-button-menu-item-button");

        this._icon.add_style_class_name("kdec-popup-button-menu-item-button-icon");

        this.actor.ensure_style();
        this._icon.ensure_style();

        this.actor.child = this._icon;

        // Variable to track hover state
        this.hover = false;

        // Variable to track active state
        this.active = false;

        // Variable to track enabled state
        this.enabled = true;

        // Connect event callbacks
        this._signals.connect(this.actor, "button-press-event", Lang.bind(this, this._onButtonPressEvent));
        this._signals.connect(this.actor, "button-release-event", Lang.bind(this, this._onButtonReleaseEvent));

        this._signals.connect(this.actor, "key-press-event", Lang.bind(this, this._onKeyPressEvent));

        this._signals.connect(this.actor, "notify::hover", Lang.bind(this, this._onHoverChanged));

        this._signals.connect(this.actor, "key-focus-in", Lang.bind(this, this._onKeyFocusIn));
        this._signals.connect(this.actor, "key-focus-out", Lang.bind(this, this._onKeyFocusOut));

        // Set pseudo class states to default
        this.actor.change_style_pseudo_class("hover", this.hover);
        this.actor.change_style_pseudo_class("active", this.active);
        this.actor.change_style_pseudo_class("focus", false);
        this.actor.sync_hover();

        utilInfo("Style: "+this.actor.get_style_class_name(), "MenuItemIconButton");
    }

    /**
     * Event Callbacks
     */

    _onButtonPressEvent(actor, event) {
        this.setActive(true);

        return true;
    }

    _onButtonReleaseEvent(actor, event) {
        this.setActive(false);

        this.activate(event);

        return true;
    }

    _onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter) {
            this.activate(event);
            return true;
        }
        return false;
    }

    _onHoverChanged(actor) {
        this.setHover(actor.hover);

        if (actor.hover == false) {
            this.setActive(false);
        }
    }

    _onKeyFocusIn(actor) {
        this.setHover(true);
    }

    _onKeyFocusOut(actor) {
        this.setHover(false);
    }

    /**
     * Other methods
     */

    setEnabled(enabled) {
        if (enabled != this.enabled) {
            this.enabled = enabled;
            this._icon.change_style_pseudo_class("disabled", !enabled);
            this.actor.set_track_hover(enabled);
            this.actor.set_reactive(enabled);

            if (enabled == false) {
                this.actor.set_hover(false);
                this.setHover(false);
                this.setActive(false);
            }
        }
    }

    activate(event) {
        if (this.enabled == true) {
            this.emit("activate", event);
            utilInfo("Activate!", "MenuItemIconButton");
        }
    }

    setActive(active) {
        if (active != this.active && this.enabled == true) {
            this.active = active;
            this.actor.change_style_pseudo_class("active", active);

            this.emit("active-changed", active);
            utilInfo("Active Changed: "+active, "MenuItemIconButton");
        }
    }

    setHover(hover) {
        if (hover != this.hover && this.enabled == true) {
            utilInfo("Set Hover: "+hover, "MenuItemIconButton");
            this.hover = hover;
            this.actor.change_style_pseudo_class("hover", hover);

            this.emit("hover-changed", hover);

            utilInfo("Hover Changed: "+hover, "MenuItemIconButton");
        }
    }

    destroy() {
        utilInfo("Destroy", "MenuItemIconButton");
        this.emit("destroy");

        this._signals.disconnectAllSignals();

        this.tooltip.destroy();
        this.actor.destroy();
        this._icon.destroy();
    }

    setIconSymbolicName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.SYMBOLIC);
    }
    
    setIconName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.FULLCOLOR);
    }
}
Signals.addSignalMethods(MenuItemIconButton.prototype);

class PopupButtonIconMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(text, iconName, iconType, buttonIconName, buttonIconType, params) {
        super(params);

        // Create actors
        this.label = new St.Label({text: text});
        this._icon = new St.Icon({style_class: 'popup-menu-icon', icon_name: iconName, icon_type: iconType});
        this._buttonBin = new St.Bin({x_align: St.Align.END});
        this.button = new MenuItemIconButton(buttonIconName, buttonIconType);
        
        this.tooltip = new Tooltips.Tooltip(this.actor, "");

        // Hide tooltip by default
        this.tooltip.preventShow = true;


        // Add Actors to Menu Item
        this.addActor(this._icon, {span: 0});
        this.addActor(this.label);
        this.addActor(this._buttonBin, {expand: true, span: -1, align: St.Align.END});
        
        this.actor.label_actor = this.label;

        this._buttonBin.child = this.button.actor;

        this._signals.connect(this.button, "hover-changed", Lang.bind(this, this._onButtonHoverChanged));

        // Override style of menu item actor, so the menu item isn't too high
        this.actor.add_style_class_name("kdec-popup-button-menu-item");

        this.actor.ensure_style();
    }
    
    _onButtonHoverChanged(button, buttonHover) {
        utilInfo("Button Hover Changed: "+buttonHover, "PopupButtonIconMenuItem");
        if (buttonHover == true) {
            this.setActive(false);

            // Hide tooltip and prevent it showing, when hovering over button
            this.tooltip.hide();
            this.tooltip.preventShow = true;
        } else {
            this.setActive(this.actor.hover);

            this.tooltip.preventShow = false;
        }
    }

    /**
     * Function overrides
     */

    _onButtonReleaseEvent(actor, event) {
        if (this.button.active == false) {
            this.activate(event, false);
            utilInfo("Activate!", "PopupButtonIconMenuItem");
            return true;
        }
        return false;
    }

    _onHoverChanged(actor) {
        this.setActive(actor.hover);
        utilInfo("Hover Changed: "+actor.hover, "PopupButtonIconMenuItem");
    }

    /**
     * Other functions
     */

    setIconSymbolicName (iconName) {
        this._icon.set_icon_name(iconName);
        this.actor.set_icon_type(St.IconType.SYMBOLIC);
    }

    setIconName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.FULLCOLOR);
    }

    setButtonIconSymbolicName (iconName) {
        this.button.setIconSymbolicName(iconName);
    }
    
    setButtonIconName (iconName) {
        this.button.setIconName(iconName);
    }

    onButtonClicked(sender, mouseButton) {

    }

    activate(event) {
        super.activate(event, true);
    }
}