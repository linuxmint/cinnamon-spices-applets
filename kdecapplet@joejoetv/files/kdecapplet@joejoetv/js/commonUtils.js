const MessageTray = imports.ui.messageTray;
const St = imports.gi.St;

function copyAndNotify(notificationSource, text, typestring) {
    try {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    
        let notification = new MessageTray.Notification(notificationSource, "KDE Connect Applet", _("Copied {typestring} to the clipboard").replace("{typestring}", typestring));
        notification.setTransient(true);
        notificationSource.notify(notification);
    } catch (error) {
        global.logError("[Notification] Error while sending notification: " + error);
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