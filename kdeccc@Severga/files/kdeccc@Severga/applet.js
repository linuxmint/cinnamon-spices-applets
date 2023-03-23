// KDE Connect Control Center Applet

const AppletUUID = "kdeccc@Severga";

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib; // Needed for translations
const Gettext = imports.gettext; // Needed for translations

const HOME_DIR = GLib.get_home_dir();
// l10n support
Gettext.bindtextdomain(AppletUUID, HOME_DIR + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// Localisation/translation support
function _(str, uuid=AppletUUID) {
	var customTrans = Gettext.dgettext(uuid, str);
	if (customTrans !== str && customTrans !== "") return customTrans;
	return Gettext.gettext(str);
}

const kdecProxy = Gio.DBusProxy.makeProxyWrapper("\
	<node name='/modules/kdeconnect'>\
		<interface name='org.kde.kdeconnect.daemon'>\
			<method name='deviceNames'>\
				<arg direction='in' type='b' />\
				<arg direction='in' type='b' />\
				<arg direction='out' type='a{ss}' />\
			</method>\
			<method name='devices'>\
				<arg direction='in' type='b' />\
				<arg direction='in' type='b' />\
				<arg direction='out' type='as' />\
			</method>\
			<signal name='deviceListChanged'>\
			</signal>\
		</interface>\
	</node>\
");

function MyApplet(orientation, panel_height, instance_id) {
	this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
	__proto__: Applet.TextIconApplet.prototype,
	
	_init: function(orientation, panel_height, instance_id) {
		Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
		
		try {
			this.setAllowedLayout(Applet.AllowedLayout.BOTH);
			this.set_show_label_in_vertical_panels(false);
		}
		catch (e) {
			global.logError(e);
		}
		this.set_applet_icon_symbolic_name("phone-symbolic");
		this._applet_context_menu.addCommandlineAction(_("Configure KDE Connect"), "kcmshell5 kcm_kdeconnect");
		this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);
		try {
			let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
			this.kdec = new kdecProxy(bus, "org.kde.kdeconnect", "/modules/kdeconnect");
			this._onDeviceListChangedId = this.kdec.connectSignal("deviceListChanged", Lang.bind(this, this.onDeviceListChanged));
		}
		catch (e) {
			global.logError(e);
		}
		this.pDeviceId = [];
		this.openDeviceMenu = {};
		this.updateMenu();
	},
	
	on_applet_clicked: function(event) {
		this.menu.toggle();
		if (this.openDeviceMenu) this.openDeviceMenu.open();
	},
	
	on_applet_removed_from_panel: function() {
		if (typeof this._onDeviceListChangedId !== "undefined")
		{
			this.kdec.disconnectSignal(this._onDeviceListChangedId);
			delete this._onDeviceListChangedId;
		}
	},
	
	onDeviceListChanged: function() {
		this.updateMenu();
	},
	
	updateMenu: function() {
		this.openDeviceMenu = {};
		this.menu.close();
		this.menu.removeAll();
		let deviceId = [];
		this.pDeviceId = [];
		let deviceName = new Object();
		try {
			deviceId = this.kdec.devicesSync(true, true)[0];
			deviceName = this.kdec.deviceNamesSync(true, true)[0];
		}
		catch (e) {
			global.logError(e);
		}
		let q = deviceId.length;
		if (q == 0) {
			this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No reachable paired devices"), {reactive: false}));
			this.set_applet_label("");
			this.set_applet_tooltip(_("No reachable paired devices"));
		}
		else {
			for (let i = 0; i < q; i++) {
				let id = deviceId[i];
				this.pDeviceId[i] = {id: id};
				let deviceMenuItem = new PopupMenu.PopupSubMenuMenuItem(deviceName[id]);
				this.menu.addMenuItem(deviceMenuItem);
				if (q == 1) this.openDeviceMenu = deviceMenuItem.menu;
				deviceMenuItem.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Id:  ") + id, {reactive: false}));
				deviceMenuItem.menu.addCommandlineAction(_("    Send Ping to"), "kdeconnect-cli --ping -d " + id);
				deviceMenuItem.menu.addCommandlineAction(_("    Force to Ring"), "kdeconnect-cli --ring -d " + id);
				deviceMenuItem.menu.addAction(_("    Send File to..."), function() {
					imports.misc.fileDialog.open(function(selection) {
						if (selection != "") imports.misc.util.spawnCommandLine("kdeconnect-cli --share '" + (selection.charAt(selection.length-1) == "\n" ? selection.substring(0, selection.length-1) : selection) + "' -d " + id);
					}, {});
				}.bind(this.pDeviceId[i]));
				deviceMenuItem.menu.addAction(_("    Send SMS via..."), function() {
					let dlg = new imports.ui.modalDialog.ModalDialog();
					let St = imports.gi.St;
					dlg.contentLayout.add(new St.Label({text: _("Enter the phone number of your SMS's addressee:")}));
					let phnEntry = new St.Entry({text: "+71234567890", opacity: 100});
					dlg.contentLayout.add(phnEntry);
					dlg.contentLayout.add(new St.Label({text: _("Enter the text of your SMS:")}));
					let txtEntry = new St.Entry({text: _("...message body..."), opacity: 100});
					dlg.contentLayout.add(txtEntry);
					dlg.contentLayout.add(new St.Label({text: _("Press <") + _("Yes") + _("> if you are ready to send your SMS, or <") + _("Cancel") + _("> to avoid sending.")}));
					dlg.setInitialKeyFocus(phnEntry);
					dlg.setButtons([
						{
							label: _("Cancel"),
							action: imports.lang.bind(this, function() {
								dlg.destroy();
							})
						},
						{
							label: _("Yes"),
							action: imports.lang.bind(this, function() {
								imports.misc.util.spawnCommandLine("kdeconnect-cli --send-sms '" + txtEntry.get_text().trim() + "' --destination '" + phnEntry.get_text().trim() + "' -d " + id);
								dlg.destroy();
							})
						}
					]);
					dlg.open();
				}.bind(this.pDeviceId[i]));
				deviceMenuItem.menu.addAction(_("    Mount and Explore"), function() {
					let kdecDevProxy = Gio.DBusProxy.makeProxyWrapper("\
						<node name='/modules/kdeconnect/devices/" + id + "/sftp'>\
							<interface name='org.kde.kdeconnect.device.sftp'>\
								<method name='mount'>\
								</method>\
								<method name='mountPoint'>\
									<arg direction='out' type='s' />\
								</method>\
							</interface>\
						</node>\
					");
					let mountPoint = "";
					try {
						let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
						let kdecDev = new kdecDevProxy(bus, "org.kde.kdeconnect", "/modules/kdeconnect/devices/" + id + "/sftp");
						kdecDev.mountSync();
						mountPoint = kdecDev.mountPointSync()[0];
					}
					catch (e) {
						global.logError(e);
					}
					if (mountPoint != "") imports.misc.util.spawnCommandLine("nemo '" + mountPoint + "'");
				}.bind(this.pDeviceId[i]));
				deviceMenuItem.menu.addAction(_("    Unmount"), function() {
					let kdecDevProxy = Gio.DBusProxy.makeProxyWrapper("\
						<node name='/modules/kdeconnect/devices/" + id + "/sftp'>\
							<interface name='org.kde.kdeconnect.device.sftp'>\
								<method name='unmount'>\
								</method>\
							</interface>\
						</node>\
					");
					try {
						let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
						let kdecDev = new kdecDevProxy(bus, "org.kde.kdeconnect", "/modules/kdeconnect/devices/" + id + "/sftp");
						kdecDev.unmountSync();
					}
					catch (e) {
						global.logError(e);
					}
				}.bind(this.pDeviceId[i]));
			}
			this.set_applet_label(String(q));
			this.set_applet_tooltip(_("Reachable paired devices: ") + q);
		}
	}
} // End MyApplet

function main(metadata, orientation, panel_height, instance_id) {  
	return new MyApplet(orientation, panel_height, instance_id);
}

