/* Clipboard QR code applet
 * Creates QR code from clipboard content using pure javascript
 *
 * Version 1.0
 *
 * by ebbes.ebbes@gmail.com
 *
 * This is some proof-of-concept. I simply wanted to test St.DrawingArea.
 * Additionally, I am planing to code a clipboard manager applet.
 * A QR code creation could be a nice feature to copy your clipboard content to your smartphone.
 * Maybe I'll start coding this manager applet when I'm bored, I already wrote a tiny python script
 * to monitor clipboard changes and send events through dbus. Basically this is what GPaste does.
 * Since I don't like external dependencies for applets very much, I will not use GPaste but my own
 * script instead which will be started by the applet if needed.
*/
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;

const AppletDir = imports.ui.appletManager.applets["clipboard-qr@ebbes"];
const QRLib = AppletDir.QR;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            this.set_applet_tooltip(_("Create QR code from clipboard"));
            this.set_applet_icon_symbolic_name('edit-paste-symbolic');

            this._errorString = new PopupMenu.PopupMenuItem('', { reactive: false });
            this.menu.addMenuItem(this._errorString);
                        
            this._maincontainer = new St.BoxLayout({ style_class: 'qrappletqrcode' });
            this.menu.addActor(this._maincontainer);

            this._qr = new QRLib.QR(0, this._maincontainer);
            
            this._maincontainer.add_actor(this._qr.actor);

        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        let clipboard = St.Clipboard.get_default()
            clipboard.get_text(Lang.bind(this,
                function(clipboard, text) {
                    this._qr.set_text(text);
                    this._errorString.label.text = this._qr.error;
                    this.menu.toggle();
                }));
    }
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}

