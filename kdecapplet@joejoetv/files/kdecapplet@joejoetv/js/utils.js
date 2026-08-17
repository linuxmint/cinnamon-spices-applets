const MessageTray = require("ui.messageTray");
const PopupMenu = require("ui.popupMenu");
const Util = require("misc.util");
const St = require("gi.St");
const Gio = require("gi.Gio");
const Clutter = require("gi.Clutter");
const GLib = require("gi.GLib");
const Params = require("misc.params");
const Gettext = require("gettext");

const Logging = require("./js/logging.js");

/** The UUID of the applet. */
const UUID = "kdecapplet@joejoetv";

// l10n support
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

/** The display name of the applet. */
const APPLET_NAME = _("KDE Connect Applet");
/** The DBus service name of KDE Connect. */
const KDECONNECT_DBUS_NAME = "org.kde.kdeconnect";
const KDECONNECT_APP_ID = "kdeconnect";

/**
 * Map for default icon names.
 * @constant {DefaultIcons}
 */
const DefaultIcons = {
    "SYMBOLIC": "kdeconnect-tray",
    "COLOR": "kdeconnect"
}

/** Whether debug features are turned on. */
const DEBUG_FEATURES = false;

/**
 * Logger to use for this file
 * @type {Logger}
 * @private
 */
const LOGGER = new Logging.Logger(UUID, "utils");

/**
 * Checks the filesystem for an available name with the basename of `filename`
 * in the directory `directory` and adds increasing numbers to the end until an available name is found
 * @param {string} directory - The directorx to check for the filename
 * @param {string} filename - The base filename to check against
 * @param {string} extension - The extension of the file to check
 * @returns {?string} An available filename with the base name of `filename` or `null`, if the directory doesn't exist
 */
function getAvailableFilename(directory, filename, extension) {
    let dirPath = GLib.build_filenamev([directory]);
    let dirFile = Gio.File.new_for_path(dirPath);

    let fileType = dirFile.query_file_type(Gio.FileQueryInfoFlags.NONE, null);

    if (fileType == Gio.FileType.DIRECTORY) {
        // File exists and is directory
        
        // If file can be saved as is, directly return filename
        let filePath = GLib.build_filenamev([dirPath, filename+"."+extension]);
        let file = Gio.File.new_for_path(filePath);
        
        if (file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.UNKNOWN) {
            // Filename is free

            LOGGER.debug(`File with name of 'filename' is free: ${filePath}`, "getAvailableFilename");
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
                        LOGGER.warn("Aborted checking for free filename after trying 1000000 filename additions. Why do you have over 1000000 files with the same base name?", "getAvailableFilename");
                        return null;
                    }

                    counter = counter + 1;
                }
            }
            return filePath;
        }
    } else {
        // Directory doesn't exist or is a different type
        LOGGER.warn(`Given directory path (${directory}) is not a directory or does not exit.`, "getAvailableFilename");

        return null;
    }
}

/**
 * Opens `url` in the default program registered to open it.
 * @param {string} url URL to open
 */
function openURL(url) {
    Util.spawn(["xdg-open", url]);
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
        LOGGER.error("Error while sending notification for copied text", error, "copyAndNotify");
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