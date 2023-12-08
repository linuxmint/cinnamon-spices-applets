const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Lang = imports.lang;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;
const UUID = "cheaty@centurix";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const APPLET_PATH = global.userdatadir + "/applets/" + UUID;
const ICON = APPLET_PATH + "/icon.png";
const REFDOCS = APPLET_PATH + "/refdocs";


function SheetMenuItem()
{
	this._init.apply(this, arguments);
}

SheetMenuItem.prototype = 
{
	__proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

	_init: function(sheet, icon, params)
	{
		// We're changing the order of the PopupSubMenuMenuItem's actors, keep everything except the init
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._triangle = null;

        // This check allows PopupSubMenu to be used as a generic scrollable container.
        if (typeof sheet.name === 'string') {
            this.actor.add_style_class_name('popup-submenu-menu-item');
            this.actor.add_style_class_name('cheatsheet');

            let iconFile = Gio.file_new_for_path(icon);
            if (iconFile.query_exists(null)) {
            	let gicon = new Gio.FileIcon({ file: iconFile });
            	this.icon = new St.Icon({
            		gicon: gicon,
            		icon_size: 32,
            		icon_type: St.IconType.FULLCOLOR,
            		style_class: "sheeticon"
            	});
            	this.addActor(this.icon);
            }

            this.label = new St.Label({
            	text: sheet.name,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            this.addActor(this.label);
            this.actor.label_actor = this.label;

            this._triangleBin = new St.Bin({
            	x_align: St.Align.END
            });
            this.addActor(
            	this._triangleBin, {
            		expand: true,
                    span: -1,
                    align: St.Align.END
                }
            );

            this._triangle = PopupMenu.arrowIcon(St.Side.RIGHT);
            this._triangle.pivot_point = new Clutter.Point({ x: 0.5, y: 0.5 });
            this._triangleBin.child = this._triangle;
        }

        this.menu = new PopupMenu.PopupSubMenu(this.actor, this._triangle);
        this._signals.connect(this.menu, 'open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
		this._tooltip = new Tooltips.Tooltip(this.actor, sheet.name + " (" + _("version") + " " + sheet.version + ")\n" + sheet.description + "\n" + _("Author:") + " " + sheet.author + "\n" + _("Email:") + " " + sheet.email + "\n" + _("Repository:") + " " + sheet.repository);
	}
}

function DescriptionMenuItem()
{
	this._init.apply(this, arguments);
}

DescriptionMenuItem.prototype =
{
	__proto__: PopupMenu.PopupBaseMenuItem.prototype,

	_init: function(item, callback, params)
	{
		PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

		this.actor.add_style_class_name("sheet-item");

		this.code = item.code;

		let container = new St.BoxLayout({});
		container.set_vertical(true);

		let description_box = new St.BoxLayout({});
		let description = new St.Label({ text: item.description, style_class: 'sheet-item-description' });

		description.get_clutter_text().set_line_wrap(true);
		description.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

		description.set_width(400);
		description.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;

		description_box.add(description);

		container.add_actor(description_box);

		let code_box = new St.BoxLayout({});
		code_box.set_vertical(true);
		let code_label = new St.Label({ text: item.code, style_class: 'sheet-item-code'});
		code_box.add(code_label);

		if (item.alternatives) {
			for (var alternative in item.alternatives) {
				let alt_label = new St.Label({ text: 'Alt: ' + item.alternatives[alternative].code, style_class: 'sheet-item-code-alternative'});
				code_box.add(alt_label);
			}
		}

		container.add_actor(code_box);

		this.addActor(container);

		return this;
	}
};


function Cheaty(metadata, orientation, panelHeight, instanceId) {
	this.instance_id = instanceId;
	this.settings = new Settings.AppletSettings(this, UUID, instanceId);
	this._init(orientation, panelHeight, instanceId);
}

Cheaty.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(orientation, panelHeight, instanceId) {
		Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
		this.set_applet_icon_path(ICON);
		this.set_applet_tooltip(_("Cheaty: Easy access cheatsheets"));

		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		this.settingsApiCheck();

		this.cheatsheetFolder = REFDOCS;

		// Fill in our sheets from the folder
		this.cheatsheets = [];

		this.settings.bindProperty(
			Settings.BindingDirection.IN, 
			"cheatsheetFolder",
			"cheatsheetFolder",
			this.onCheatsheetFolderUpdate, 
			null
		);
		this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
		this._setKeybinding();
		this.settings.bindProperty(
			Settings.BindingDirection.BIDIRECTIONAL,
			"cheatsheets",
			"cheatsheets",
			this.onCheatsheetsUpdate,
			null
		);


		this._msgsrc = new MessageTray.SystemNotificationSource("Cheaty");
		Main.messageTray.add(this._msgsrc);
		this.refresh(true);
	},

	refresh: function(updateSettings=false) {
		this.menu.removeAll();

		let currentDir = Gio.file_new_for_path(resolveHome(this.cheatsheetFolder));

		let enumerator = currentDir.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null);
		let file;

		this._sheets = [];

		let current_sheets = [];
		let tmp_sheets = this.settings.getValue("cheatsheets")
		tmp_sheets.forEach((sheet) => {
			current_sheets.push(sheet.name);
		});

		while ((file = enumerator.next_file(null)) !== null) {
			if (file.get_file_type() === Gio.FileType.DIRECTORY) {
				let sheetName = file.get_name();
				// For this to be a valid cheat sheet it must have a sheet.json file
				try {
					let sheet = Gio.file_new_for_path(resolveHome(this.cheatsheetFolder) + '/' + sheetName + '/sheet.json');
					if (!sheet.query_exists(null)) {
						global.log('No valid sheet.json file found in "' + sheetName + '"');
						continue;
					}

					let [ok, data, etag] = sheet.load_contents(null);
					if (ok) {
						let contents = JSON.parse(ByteArray.toString(data));

						if (!current_sheets.includes(contents.name)) {
							// Detected a new sheet, add it to the settings
							tmp_sheets.push({
								"enabled": true,
								"name": contents.name,
								"description": contents.description,
								"author": contents.author
							})
						} else {
							// Get the enabled state from the settings
							let breaker = false;
							tmp_sheets.forEach((sheet) => {
								if (sheet.name == contents.name && !sheet.enabled) {
									breaker = true;
								}
							})
							if (breaker) {
								continue;
							}
						}

						let iconPath = resolveHome(this.cheatsheetFolder) + '/' + sheetName + '/icon.svg';

						this._sheets[sheetName] = new SheetMenuItem(contents, iconPath);
						this._sheets[sheetName]._sections = [];

						for (var section in contents.sections) {
							this._sheets[sheetName]._sections[section] = new PopupMenu.PopupSubMenuMenuItem('\t' + section);
							this._sheets[sheetName]._sections[section]._items = [];
							for (var item in contents.sections[section]) {
								this._sheets[sheetName]._sections[section]._items[item] = new PopupMenu.PopupSubMenuMenuItem('\t\t' + item);

								let code = new DescriptionMenuItem(contents.sections[section][item]);
								code.connect("activate", Lang.bind(this, this.copyToClipboard));

								this._sheets[sheetName]._sections[section]._items[item].menu.addMenuItem(code);
								this._sheets[sheetName]._sections[section].menu.addMenuItem(this._sheets[sheetName]._sections[section]._items[item]);
							}
							this._sheets[sheetName].menu.addMenuItem(this._sheets[sheetName]._sections[section]);
						}
						this.menu.addMenuItem(this._sheets[sheetName]);
					}
				} catch (e) {
					global.log('Exception: ' + e)
				}
			}
		}
		if (updateSettings) {
			this.settings.setValue("cheatsheets", tmp_sheets);
		}
	},

	_setKeybinding: function () {
		Main.keybindingManager.addHotKey("cheaty-show-" + this.instance_id, this.keyOpen, Lang.bind(this, this._openMenu));
	},

	on_applet_removed_from_panel: function () {
		Main.keybindingManager.removeHotKey("cheaty-show-" + this.instance_id);
	},

	_openMenu: function () {
		this.menu.toggle();
	},

	onCheatsheetFolderUpdate: function() {
	},

	onCheatsheetsUpdate: function(newValue) {
		this.refresh(false);
	},

	settingsApiCheck: function() {
		const Config = imports.misc.config;
		const SETTINGS_API_MIN_VERSION = 2;
		const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

		let cinnamonVersion = Config.PACKAGE_VERSION.split('.');
		let majorVersion = parseInt(cinnamonVersion[0]);

		if (majorVersion >= SETTINGS_API_MIN_VERSION) {
			return;
		}

		let mi = new Applet.MenuItem(_("Configure..."), Gtk.STOCK_EDIT, Lang.bind(this, function() {
			Util.spawnCommandLine(CMD_SETTINGS)
		}));
		this._applet_context_menu.addMenuItem(mi);
	},

	notification: function(message) {
		let notification = new MessageTray.Notification(this._msgsrc, "Cheaty", message);
		notification.setTransient(true);
		this._msgsrc.notify(notification);
	},

	copyToClipboard: function(text) {
		St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text.code);
		this.notification(_("Code copied to the clipboard"));
	},

	on_applet_clicked: function(event) {
		this._openMenu();
	}
}

function resolveHome(path) {
	let home = GLib.get_home_dir();
	return path.replace('~', home);
}

function showProperties(debug_object) {
	global.log('SHOWING PROPERTIES FOR: ' + debug_object);
	for (var prop in debug_object) {
		global.log('PROP: ' + prop);
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Cheaty(metadata, orientation, panelHeight, instanceId);
}
