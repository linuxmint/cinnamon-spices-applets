/*
 * QR.js
 * contains QR class
 * part of clipboard-qr@ebbes applet
 */
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const AppletDir = imports.ui.appletManager.appletMeta['clipboard-qr@wrouesnel'].path;
const PicturesDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
imports.ui.searchPath.unshift(AppletDir);
const QRLibrary = imports.ui.QRLib;

const QR_Blocksize = 5;

const Gettext = imports.gettext;
const UUID = "clipboard-qr@wrouesnel";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function QR(width, height, parent) {
    this._init(width, height, parent);
}

QR.prototype = {
    _init: function(size, parent) {
        this.actor = new St.DrawingArea({reactive: false});
        this.parent = parent;
        this.size = size;
        this.actor.set_width(size);
        this.actor.set_height(size);
        this._qrdata = {};
        this.error = '';
        this.actor.connect('repaint', Lang.bind(this, this._draw));
    },
    _draw: function() {
        let [width, height] = this.actor.get_surface_size();
        let context = this.actor.get_context();

        //clear drawing area
        context.setSourceRGBA(1.0,1.0,1.0,1.0);
        context.rectangle(0, 0, width, height);
        context.fill();

        if (!this._qrdata)
            return;

        //draw qr code
        context.setSourceRGBA(0.0,0.0,0.0,1.0);
        let length = this._qrdata.length;

        for (let i = 0; i < length; ++i) {
            for (let j = 0; j < length; ++j) {
                if (this._qrdata[i][j]) {
                    context.rectangle(QR_Blocksize * (j + 1), QR_Blocksize * (i + 1),
                    	QR_Blocksize, QR_Blocksize);
                    context.fill();
                }
            }
        }
        this.actor.show();
    },
    _resize: function(size) {
        this.size = size;
        this.actor.set_width(size);
        this.actor.set_height(size);
    },
    set_text: function(text) {
        try {
            this._qrdata = QRLibrary.qr_generate(text, {});
            this.error = _("QR generated");
            this._resize((this._qrdata.length + 2) * QR_Blocksize);
        }
        catch (e) {
            this.error = e;
            this._qrdata = {};
            this._resize(0);
        }
    },
    _create_svg: function(suffix) {
        if (!this._qrdata)
            return;

        let length = this._qrdata.length;
        let height = length+2

        let svgFile = Gio.File.new_for_path(PicturesDir + '/qrcode-' + suffix + '.svg')
        if (svgFile.query_exists(null))
            svgFile.delete(null);
        let readwrite = svgFile.create_readwrite(Gio.FileCreateFlags.NONE, null);
        let writeFile = readwrite.get_output_stream();

        writeFile.write('<svg height="' + height + '" width="' + height + '" xmlns="http://www.w3.org/2000/svg">', null)
        writeFile.write('  <rect width="' + height + '" height="' + height + '" x="0" y="0" fill="#ffffff" />\n', null);

        for (let i = 0; i < length; ++i) {
            for (let j = 0; j < length; ++j) {
                if(this._qrdata[i][j])
                    writeFile.write('  <rect width="1" height="1" x="'+ (j+1) +'" y="' + (i+1) + '" fill="#000000" />\n', null);
            }
        }
        writeFile.write('</svg>', null)
        writeFile.close(null);
    }
};
