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

const Params = imports.misc.params;

// Common constants
const UUID = "kdecapplet@joejoetv";
const KDECONNECT_DBUS_NAME = "org.kde.kdeconnect";
const APPLET_NAME = "KDE Connect Applet"

const DefaultIcons = {
    "SYMBOLIC": "kdeconnect-tray",
    "COLOR": "kdeconnect"
}
var ActivateType = {
    ITEM: 0,
    BUTTON: 1
}

var LogLevel = {
    DEBUG: 0,
    VERBOSE: 1,
    INFO: 2,
    NORMAL: 3,
    MINIMAL: 4
}

// lookup table for log level representant string
var logLevelNames = {};

logLevelNames[LogLevel.DEBUG] = "DEBUG";
logLevelNames[LogLevel.VERBOSE] = "VERBOSE";
logLevelNames[LogLevel.INFO] = "INFO";
logLevelNames[LogLevel.NORMAL] = "NORMAL";
logLevelNames[LogLevel.MINIMAL] = "MINIMAL";

// Log level for whole applet
const LOG_LEVEL = LogLevel.NORMAL;

// Flag to enable debug features
const DEBUG_FEATURES = false;

/**
 * General logging functions with log level support
 */

/**
 * Common logging function
 * @param {string} msg - The message to log as 'info'
 * @param {LogLevel} level - The level to log the message at
 */
function logInfo(msg, level) {
    if (Object.values(LogLevel).includes(level) == false) {
        global.logError("["+UUID+"] "+"Invalid log level: '"+level+"' (Message: '"+msg+"')");
    } else if (level >= LOG_LEVEL) {
        global.log("["+UUID+"/"+logLevelNames[level]+"] "+msg);
    }
}

/**
 * Common logging function
 * @param {string} msg - The message to log as 'warning'
 * @param {LogLevel} level - The level to log the message at
 */
function logWarn(msg, level) {
    if (Object.values(LogLevel).includes(level) == false) {
        global.logError("["+UUID+"] "+"Invalid log level: '"+level+"' (Message: '"+msg+"')");
    } else if (level >= LOG_LEVEL) {
        global.logWarning("["+UUID+"/"+logLevelNames[level]+"] "+msg);
    }
}

/**
 * Common logging function
 * @param {string} msg - The message to log as 'error'
 * @param {LogLevel} level - The level to log the message at
 */
function logError(msg, level) {
    if (Object.values(LogLevel).includes(level) == false) {
        global.logError("["+UUID+"] "+"Invalid log level: '"+level+"' (Message: '"+msg+"')");
    } else if (level >= LOG_LEVEL) {
        global.logError("["+UUID+"/"+logLevelNames[level]+"] "+msg);
    }
}


/**
 * Logging functions for utility functions
 */

/**
 * Logging function for utility stuff.
 * Takes a name representing the function, class or similar, that called it.
 * @param {string} msg - The message to log as 'info'
 * @param {LogLevel} level - The level to log the message at
 * @param {string} name - The name to use in the log message
 */
function utilInfo(msg, level, name) {
    logInfo("("+name+") "+msg, level);
}

/**
 * Logging function for utility stuff.
 * Takes a name representing the function, class or similar, that called it.
 * @param {string} msg - The message to log as 'warning'
 * @param {LogLevel} level - The level to log the message at
 * @param {string} name - The name to use in the log message
 */
function utilWarn(msg, level, name) {
    logWarn("("+name+") "+msg, level);
}

/**
 * Logging function for utility stuff.
 * Takes a name representing the function, class or similar, that called it.
 * @param {string} msg - The message to log as 'error'
 * @param {LogLevel} level - The level to log the message at
 * @param {string} name - The name to use in the log message
 */
function utilError(msg, level, name) {
    logError("("+name+") "+msg, level);
}

/**
 * Utility functions and classes
 */

/**
 * Checks the filesystem for an available name with the basename of `filename`
 * in the directory `directory` and adds increasing numbers to the end until an available name is found
 * @param {string} directory - The directorx to check for the filename
 * @param {string} filename - The base filename to check against
 * @param {string} extension - The extension of the file to check
 * @returns An available filename with the base name of `filename` or `null`, if the directory doesn't exist
 */
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

            utilInfo("File with name of 'filename' is free: "+filePath, LogLevel.DEBUG, "getAvailableFilename");

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
                        utilWarn("Aborted checking for free filename after trying 1000000 filename additions. Why do you have over 1000000 files with the same base name?", LogLevel.NORMAL, "getAvailableFilename");

                        return null;
                    }

                    counter = counter + 1;
                }
            }

            return filePath;
        }

    } else {
        // Directory doesn't exists or is a different type

        utilWarn("File path to check filename in, doesn't exist or isn't a directory", LogLevel.INFO, "getAvailableFilename");

        return null;
    }
}

/**
 * Opens `url` in the default program registered to open it
 * @param {string} url 
 */
function openURL(url) {
    Util.spawnCommandLine('xdg-open "'+url+'"');
}

/**
 * Copies `text` to the clipboard and sends a notification informing the user that `typestring` was copied to the clipboard
 * @param {MessageTray.Source} notificationSource - The notification source to use for the notification
 * @param {string} text - The text to copy
 * @param {string} typestring - A string representing what was copied to the clipboard
 */
function copyAndNotify(notificationSource, text, typestring) {
    try {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    
        let notification = new MessageTray.Notification(notificationSource, APPLET_NAME, _("Copied {typestring} to the clipboard").replace("{typestring}", typestring));
        notification.setTransient(true);
        notificationSource.notify(notification);
    } catch (error) {
        utilError("Error while sending notification for copied text: "+error, LogLevel.NORMAL, "copyAndNotify");
    }
}

/**
 * Notification Source for the applet
 */
class AppletNotificationSource extends MessageTray.Source {
    constructor(appletName) {
        super(APPLET_NAME);

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

/**
 * Button to add to a Popup-Menu Item with an icon
 */
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

        utilInfo("Key pressed: "+symbol, LogLevel.DEBUG, "MenuItemIconButton");

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
            this.tooltip.preventShow = !enabled;

            if (enabled == false) {
                this.actor.set_hover(false);
                this.setHover(false);
                this.setActive(false);

                this.tooltip.hide();

                utilInfo("Disabled!", LogLevel.VERBOSE, "MenuItemIconButton");
            } else {
                utilInfo("Enabled!", LogLevel.VERBOSE, "MenuItemIconButton");
            }


            this.emit("enabled-changed", enabled);
        }
    }

    activate(event) {
        if (this.enabled == true) {
            this.emit("activate", event);
            utilInfo("Activated!", LogLevel.VERBOSE, "MenuItemIconButton");
        }
    }

    setActive(active) {
        if (active != this.active && this.enabled == true) {
            this.active = active;
            this.actor.change_style_pseudo_class("active", active);

            this.emit("active-changed", active);

            utilInfo("'active' changed! New value: "+active, LogLevel.VERBOSE, "MenuItemIconButton");
        }
    }

    setHover(hover) {
        if (hover != this.hover && this.enabled == true) {
            this.hover = hover;
            this.actor.change_style_pseudo_class("hover", hover);

            this.emit("hover-changed", hover);

            utilInfo("'hover' changed! New value: "+hover, LogLevel.VERBOSE, "MenuItemIconButton");
        }
    }

    destroy() {
        utilInfo("Destroy called!", LogLevel.VERBOSE, "MenuItemIconButton");
        this.emit("destroy");

        this._signals.disconnectAllSignals();
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
        
        this.actor.label_actor = this.label;

        this._icon = new St.Icon({style_class: 'popup-menu-icon', icon_name: iconName, icon_type: iconType});
        this.button = new MenuItemIconButton(buttonIconName, buttonIconType);
        
        // Add Actors to Menu Item
        this.addActor(this._icon, {span: 0});
        this.addActor(this.label);

        this._buttonBin = new St.Bin({x_align: St.Align.END});
        this.addActor(this._buttonBin, {expand: true, span: -1, align: St.Align.END});
        this._buttonBin.child = this.button.actor;

        this.tooltip = new Tooltips.Tooltip(this.actor, "");

        // Hide tooltip by default
        this.tooltip.preventShow = true;

        this._signals.connect(this.button, "hover-changed", Lang.bind(this, this._onButtonHoverChanged));
        this._signals.connect(this.button, "activate", Lang.bind(this, this._onButtonActivate));

        // Override style of menu item actor, so the menu item isn't too high
        this.actor.add_style_class_name("kdec-popup-button-menu-item");
    }
    
    _onButtonHoverChanged(button, buttonHover) {
        utilInfo("'hover' of button changed! New value: "+buttonHover, LogLevel.VERBOSE, "PopupButtonIconMenuItem");
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

    _onButtonActivate(button, event) {
        this.activate(event, false, ActivateType.BUTTON);
    }

    /**
     * Function overrides
     */

    _onButtonReleaseEvent(actor, event) {
        if (this.button.active == false) {
            this.activate(event, true, ActivateType.ITEM);
            return true;
        }
        return false;
    }

    _onHoverChanged(actor) {
        utilInfo("'hover' changed! New value: "+actor.hover, LogLevel.VERBOSE, "PopupButtonIconMenuItem");
        this.setActive(actor.hover);
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

    activate(event, keepMenu, activationType) {
        utilInfo("Activated! Type: "+activationType, LogLevel.VERBOSE, "PopupButtonIconMenuItem");
        this.emit('activate', event, keepMenu, activationType);
    }
}

/**
 * Method emulating the addActor method of PopupMenu.PopupBaseMenuItem available in cinnamon 5.4.1 and up,
 * which added the ability to specify the position and align parameters
 * 
 * @param {PopupMenu.PopupBaseMenuItem} menuItem - The menu item to add the child to
 * @param {Clutter.Actor} child - The child actor to add
 * @param {object} params - Parameters for how to add the actor
 */
function addActorAtPos(menuItem, child, params) {
    params = Params.parse(params, { span: 1,
                                    expand: false,
                                    align: St.Align.START,
                                    position: -1 });
    params.actor = child;
    menuItem._children.splice(params.position >= 0 ? params.position : Number.MAX_SAFE_INTEGER, 0, params);
    menuItem._signals.connect(menuItem.actor, 'destroy', menuItem._removeChild.bind(menuItem, child));
    menuItem.actor.insert_child_at_index(child, params.position);
}