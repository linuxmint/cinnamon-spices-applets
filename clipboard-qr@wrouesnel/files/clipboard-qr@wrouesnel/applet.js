/* Clipboard QR code applet
 * Creates QR code from clipboard content using pure javascript
 *
 * Version 1.0
 *
 * originally by ebbes.ebbes@gmail.com
 * modified by w.rouesnel@gmail.com (fixed drawing on modern Cinnamons)
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
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GUdev = imports.gi.GUdev;
const ByteArray = imports.byteArray;

const AppletDir = imports.ui.appletManager.appletMeta['clipboard-qr@wrouesnel'].path;
imports.ui.searchPath.unshift(AppletDir);

const PicturesDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
const PicturesName = PicturesDir.substring(PicturesDir.lastIndexOf('/') + 1);

const QRLib = imports.ui.QR;

const QRReaderHelper = 'clipboard-qr.py';

const MAX_BYTES = 1048576;

const Gettext = imports.gettext;
const UUID = "clipboard-qr@wrouesnel";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            // Holds the subprocess reference to a zbarimg
            this._qrprocess = null;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.set_applet_tooltip(_("Create QR code from clipboard"));
            this.set_applet_icon_symbolic_name('qrcode');

            // The QR code error string
            this._errorString = new PopupMenu.PopupMenuItem('', { reactive: false });
            this.menu.addMenuItem(this._errorString);

            // The QR code main window
            this._maincontainer = new St.BoxLayout({ style_class: 'qrappletqrcode' });
            this.menu.addActor(this._maincontainer);

            // Add button to create qr-code.svg file
            this.saveMenuItem = new PopupMenu.PopupIconMenuItem(_("Save QR code as SVG in '~/%s'").format(PicturesName), "document-save", St.IconType.SYMBOLIC);
            this.menu.addMenuItem(this.saveMenuItem);
            this.saveMenuItem.connect('activate', Lang.bind(this, this._onSaveMenuItemClicked));

            // Add a separator
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Link to udev to track connected cameras and provide appropriate
            // capture items on the menu.
            this.camera_menus = {};	// Track which cameras we have in the menu

            this.udev_client = new GUdev.Client ({subsystems: ["video4linux"]});
            this.udev_client.connect ("uevent", Lang.bind(this, this.refresh_cameras));

            // Populate the menu with an initial list of cameras
            this.refresh_cameras();

            this._qr = new QRLib.QR(0, this._maincontainer);

            this._maincontainer.add_actor(this._qr.actor);

        }
        catch (e) {
            global.logError(e);
        }
    },

    _onSaveMenuItemClicked: function () {
        let date = new Date();
        let month = ((date.getMonth()+1)<10?'0':'') + (date.getMonth()+1);
        let day = (date.getDate()<10?'0':'') + date.getDate();
        let hour = (date.getHours()<10?'0':'') + date.getHours();
        let minute = (date.getMinutes()<10?'0':'') + date.getMinutes();
        let second = (date.getSeconds()<10?'0':'') + date.getSeconds();
        let dateString = date.getFullYear() + "-" + month + "-" + day + "-" + hour + minute + second;
        this._qr._create_svg(dateString);
    },

    _launch_qr_reader: function (camera_path) {
        try {
            if (this._qrprocess == null) {
                // Spawn the python helper
                this._qrprocess = Gio.Subprocess.new(
                    ["/usr/bin/python3", GLib.build_filenamev([AppletDir,QRReaderHelper]), camera_path],
                    Gio.SubprocessFlags.STDOUT_PIPE);
                // Read from stdout
                let streamOut = this._qrprocess.get_stdout_pipe();
                streamOut.read_bytes_async(MAX_BYTES, 0, null, Lang.bind(this, function (o,result) {
                    let data = o.read_bytes_finish(result);
                    let clipboard = St.Clipboard.get_default();
                    // Check Cinnamon version
                    let cinn_ver = GLib.getenv('CINNAMON_VERSION');
                    cinn_ver = cinn_ver.substring(0, cinn_ver.lastIndexOf("."))
                    if (parseFloat(cinn_ver) <= 3.4) {
                        clipboard.set_text(data.get_data().toString());
                    } else if (parseFloat(cinn_ver) <= 4.6) {
                        clipboard.set_text(St.ClipboardType.CLIPBOARD, data.get_data().toString());
                    } else {
                        clipboard.set_text(St.ClipboardType.CLIPBOARD, ByteArray.toString(data.get_data()));
                    }
                }));

                this._qrprocess.wait_async(null, Lang.bind(this, function(o,result) {
                    this._qrprocess = null;
                    o.wait_finish(result);
                }));
            }
        } catch (e) {
            global.logError(e);
        }
    },

    // Dynamically updates the applet menu as cameras are plugged/unplugged
    refresh_cameras: function () {
        // Refresh camera list
        for (let item in this.camera_menus) {
            this.menu.remove(item);
        }
        this.camera_menus = {};

        let camera_devices = this.udev_client.query_by_subsystem ("video4linux");
        for (var n = 0; n < camera_devices.length; n++) {
            let devfile = camera_devices[n].get_device_file ();
            let description = camera_devices[n].get_property('ID_V4L_PRODUCT');

            let menuItem = new PopupMenu.PopupIconMenuItem(_("Scan QR Code") + ' (' + description +')', "qrcode-scan", St.IconType.SYMBOLIC);

            menuItem.connect('activate', Lang.bind(this, function (menuItem, event) {
                this._launch_qr_reader(devfile);
                return false;
            }));

            this.menu.addMenuItem(menuItem);
            this.camera_menus[devfile+description] = menuItem;
        }
    },

    on_applet_clicked: function(event) {
        let clipboard = St.Clipboard.get_default();

        // Check Cinnamon version
        let cinn_ver = GLib.getenv('CINNAMON_VERSION');
        cinn_ver = cinn_ver.substring(0, cinn_ver.lastIndexOf("."))
        if (parseFloat(cinn_ver) <= 3.4) {
            clipboard.get_text(Lang.bind(this,
            function(clipboard, text) {
                this._qr.set_text(text);
                try {
                    this._errorString.label.text = this._qr.error;
                } catch (e) {
                    this._errorString.label.text = _("No QR code scanned.");
                }
                this.menu.toggle();
            }));
        } else {
            this.saveMenuItem.actor.hide();
            clipboard.get_text(St.ClipboardType.CLIPBOARD, Lang.bind(this,
            function(clipboard, text) {
                this._qr.set_text(text);
                try {
                    this._errorString.label.text = this._qr.error;
                    if (this._qr.error == _("QR generated"))
                        this.saveMenuItem.actor.show();
                } catch (e) {
                    this._errorString.label.text = _("No QR code scanned.");
                }
                this.menu.toggle();
            }));
        }

    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}
