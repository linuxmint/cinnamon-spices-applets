const Lang = imports.lang
const Applet = imports.ui.applet
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk
const Gio = imports.gi.Gio
const St = imports.gi.St
const PopupMenu = imports.ui.popupMenu
const ModalDialog = imports.ui.modalDialog
const Util = imports.misc.util
const UUID = "PDFManager@cinnamon.org"
const AppletDirectory = imports.ui.appletManager.appletMeta[UUID].path

const Gettext = imports.gettext
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")


function _(str) {
   return Gettext.dgettext(UUID, str)
}

function MyPopupMenuItem()
{
    this._init.apply(this, arguments)
}

MyPopupMenuItem.prototype =
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    _init: function(icon, text, params)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params)
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' })
        this.icon = icon
        this.box.add(this.icon)
        this.label = new St.Label({ text: text })
        this.box.add(this.label)
        this.addActor(this.box)
    }
}

function MyApplet(orientation) {
    this._init(orientation)
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation)
        try {
            this.set_applet_tooltip(_("Click here to manage your PDF"))
            this.set_applet_icon_name("gnome-mime-application-pdf")

            this.menuManager = new PopupMenu.PopupMenuManager(this)
            this.menu = new Applet.AppletPopupMenu(this, orientation)
            this.menuManager.addMenu(this.menu)
        }
        catch (e) {
            global.logError(e)
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle()
        this._redisplay()
    },
    _display: function() {

		if(Gio.file_new_for_path("/usr/bin/pdftk").query_exists(null)) {
			let icon = new St.Icon({ icon_name: 'list-add', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			let menuItem = new MyPopupMenuItem(icon, _("Merge PDF"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._merge, {}))

	        icon = new St.Icon({ icon_name: 'list-remove', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			menuItem = new MyPopupMenuItem(icon, _("Extract PDF"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._extract, {}))

	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())

	        icon = new St.Icon({ icon_name: 'view-refresh', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			menuItem = new MyPopupMenuItem(icon, _("Reduce size of PDF"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._reduce, {}))

	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())

	        icon = new St.Icon({ icon_name: 'object-rotate-left', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			menuItem = new MyPopupMenuItem(icon, _("Rotate left PDF"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._rotate_left, {}))

	        icon = new St.Icon({ icon_name: 'object-rotate-right', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			menuItem = new MyPopupMenuItem(icon, _("Rotate right PDF"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._rotate_right, {}))

	        icon = new St.Icon({ icon_name: 'object-flip-vertical', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			menuItem = new MyPopupMenuItem(icon, _("Flip vertically PDF"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._flip_v, {}))
		} else {
			let icon = new St.Icon({ icon_name: 'list-add', icon_type: St.IconType.SYMBOLIC, icon_size: 16 })
 			let menuItem = new MyPopupMenuItem(icon, _("Install PDFManager's tools"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._run, "apturl apt://pdftk"))
		}


        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
        if (Gio.file_new_for_path("/usr/bin/evince").query_exists(null)) {

			icon = new St.Icon({ gicon: Gio.icon_new_for_string("/usr/share/icons/Mint-X/apps/16/evince.png"), icon_size: 16})
 			menuItem = new MyPopupMenuItem(icon, _("Open Document Viewer"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._run, "evince"))
        }
        if (Gio.file_new_for_path("/usr/bin/pdfmod").query_exists(null)) {

			icon = new St.Icon({ gicon: Gio.icon_new_for_string("/usr/share/icons/hicolor/16x16/apps/pdfmod.png"), icon_size: 16})
 			menuItem = new MyPopupMenuItem(icon, _("Open PDF Mod"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._run, "pdfmod"))
        }
        if (Gio.file_new_for_path("/usr/bin/pdfedit").query_exists(null)) {

			icon = new St.Icon({ gicon: Gio.icon_new_for_string("/usr/share/pdfedit/icon/pdfedit_icon_16.png"), icon_size: 16})
 			menuItem = new MyPopupMenuItem(icon, _("Open PDF Editor"), {})
			this.menu.addMenuItem(menuItem)
			menuItem.connect('activate', Lang.bind(this, this._run, "pdfedit"))
        }

    },
    _redisplay: function() {
        this.menu.removeAll()
        this._display()
    },

    _run: function(a, b, c, d) {
        Util.spawnCommandLine(d)
    },
    _merge: function(a, b, c, d) {
        Util.spawnCommandLine(AppletDirectory + "/merge.py")
    },
    _extract: function(a, b, c, d) {
        Util.spawnCommandLine(AppletDirectory + "/extract.py")
    },
    _rotate_left: function(a, b, c, d) {
        Util.spawnCommandLine(AppletDirectory + "/rotate-left.py")
    },
    _rotate_right: function(a, b, c, d) {
        Util.spawnCommandLine(AppletDirectory + "/rotate-right.py")
    },
    _flip_v: function(a, b, c, d) {
        Util.spawnCommandLine(AppletDirectory + "/flip-v.py")
    },
    _reduce: function(a, b, c, d) {
    	Util.spawnCommandLine(AppletDirectory + "/reduce.py")
    },

    destroy: function() {
        this.menu.destroy()
        this.emit('destroy')
    }

}

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation)
    return myApplet
}
