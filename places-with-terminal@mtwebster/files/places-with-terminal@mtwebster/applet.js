const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

let ICON_SIZE = 22;

String.prototype.contains = function(it) { return this.indexOf(it) != -1; };

function ok_Terminal(id)
{
    if (!id) {
        return false;
    } else if ((id == 'special:connect') || id.contains('ftp')) {
        return false;
    } else {
        return true;
    }
}

// l10n
const Gettext = imports.gettext;
const UUID = "places-with-terminal@mtwebster";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
   let translation = Gettext.gettext(str);
   if(translation != str) {
      return translation;
   }
   return Gettext.dgettext(UUID, str);
};

function MyPopupMenuItem()
{
	this._init.apply(this, arguments);
}

MyPopupMenuItem.prototype =
{
		__proto__: PopupMenu.PopupBaseMenuItem.prototype,
		_init: function(show_terminal, icon, text, loc, menu_actor, params)
		{
		    let term_icon = new St.Icon({icon_name: "terminal", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
			this.icon = icon;
            this.loc = loc;
			this.menu_actor = menu_actor;
			this.addActor(this.icon);
            this.labeltext = text;
			this.label = new St.Label({ text: text });
			this.addActor(this.label);
			if (show_terminal && ok_Terminal(this.loc)) {
			    this.buttonbox = new St.BoxLayout();
                let button = new St.Button({ child: term_icon });
                button.connect('clicked', Lang.bind(this, this._terminal));
                this.buttonbox.add_actor(button);
                this.addActor(this.buttonbox);
			}
        },

        _terminal: function () {

            if (this.loc == "special:home") {
                this.loc = Gio.file_new_for_path(GLib.get_home_dir()).get_uri().replace('file://','');
            } else if (this.loc == "special:desktop") {
                this.loc = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)).get_uri().replace('file://','');
            } else if (this.loc == "root") {
                this.loc = "/";
            }
            Main.Util.spawnCommandLine("gnome-terminal --working-directory="+this.loc);
			this.menu_actor.hide();
        }
};

function MyApplet(metadata, orientation, panelHeight, instanceId) {
	this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
		__proto__: Applet.IconApplet.prototype,

		_init: function(metadata, orientation, panelHeight, instanceId) {
			Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

			try {
                this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
                this.settings.bind("show-terminal", "show_terminal", this._refresh);
                this.settings.bind("icon", "icon", this.set_icon);

                this.set_icon();

				this.set_applet_tooltip(_("Places and bookmarks"));

				this.menuManager = new PopupMenu.PopupMenuManager(this);
				this.menu = new Applet.AppletPopupMenu(this, orientation);
				this.menuManager.addMenu(this.menu);

				this._display();
				this.refresh_menu_item = new PopupMenu.PopupIconMenuItem(_("Refresh bookmarks..."), 'view-refresh-symbolic', St.IconType.SYMBOLIC);
                this.refresh_menu_item.connect('activate', Lang.bind(this, this._refresh));
                this._applet_context_menu.addMenuItem(this.refresh_menu_item);
                this.defaults_menu_item = new PopupMenu.PopupIconMenuItem(_("Change default programs..."), 'system-run-symbolic', St.IconType.SYMBOLIC);
                this.defaults_menu_item.connect('activate', Lang.bind(this, this._defaults));
                this._applet_context_menu.addMenuItem(this.defaults_menu_item);
			}
			catch (e) {
				global.logError(e);
			};
		},

        _refresh: function() {
            this.menu.removeAll();
            Main.placesManager._reloadBookmarks();
            this._display();
        },

        _defaults: function() {
            Util.spawn(['cinnamon-settings', 'default']);
        },

		on_applet_clicked: function(event) {
			this.menu.toggle();
		},

		_display: function() {
			let placeid = 0;
			this.placeItems = [];
			this.defaultPlaces = Main.placesManager.getDefaultPlaces();
			this.bookmarks     = Main.placesManager.getBookmarks();

			// Display default places
			for ( placeid; placeid < this.defaultPlaces.length; placeid++) {
				let icon = this.defaultPlaces[placeid].iconFactory(ICON_SIZE);
				this.placeItems[placeid] = new MyPopupMenuItem(this.show_terminal, icon, _(this.defaultPlaces[placeid].name),
                                    this.defaultPlaces[placeid].id.replace('bookmark:file://',''), this.menu.actor);
				this.placeItems[placeid].place = this.defaultPlaces[placeid];

				this.menu.addMenuItem(this.placeItems[placeid]);
				this.placeItems[placeid].connect('activate', function(actor, event) {
					actor.place.launch();
				});
			}

			// Display Computer / Filesystem
			let icon = new St.Icon({icon_name: "computer", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon'});
			this.computerItem = new MyPopupMenuItem(this.show_terminal, icon, _("Computer"));

			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                            Main.Util.spawnCommandLine("xdg-open computer://");
			});

			icon = new St.Icon({icon_name: "harddrive", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon'});
			this.filesystemItem = new MyPopupMenuItem(this.show_terminal, icon, _("File System"), "root", this.menu.actor);

			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                            Main.Util.spawnCommandLine("xdg-open /");
			});

			// Separator
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			let bookmarkid = 0;
			// Display default bookmarks
			for ( bookmarkid; bookmarkid < this.bookmarks.length; bookmarkid++, placeid++) {
				let icon = this.bookmarks[bookmarkid].iconFactory(ICON_SIZE);
				this.placeItems[placeid] = new MyPopupMenuItem(this.show_terminal, icon, _(this.bookmarks[bookmarkid].name),
                        this.bookmarks[bookmarkid].id.replace('bookmark:file://',''), this.menu.actor);
				this.placeItems[placeid].place = this.bookmarks[bookmarkid];
				this.menu.addMenuItem(this.placeItems[placeid]);
				this.placeItems[placeid].connect('activate', function(actor, event) {
					actor.place.launch();
				});
			};
		},

        set_icon: function() {
            if ( this.icon == "" ||
               ( GLib.path_is_absolute(this.icon) &&
                 GLib.file_test(this.icon, GLib.FileTest.EXISTS) ) ) {
                if ( this.icon.search("-symbolic.svg") == -1 ) this.set_applet_icon_path(this.icon);
                else this.set_applet_icon_symbolic_path(this.icon);
            }
            else if ( Gtk.IconTheme.get_default().has_icon(this.icon) ) {
                if ( this.icon.search("-symbolic") != -1 ) this.set_applet_icon_symbolic_name(this.icon);
                else this.set_applet_icon_name(this.icon);
            }
            else this.set_applet_icon_name("folder");
        }
};

function main(metadata, orientation, panelHeight, instanceId) {
	let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
	return myApplet;
};
