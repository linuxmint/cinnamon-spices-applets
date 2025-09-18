const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Gettext = imports.gettext;


const ccc = Gettext.domain('cinnamon-control-center');
function _ccc(str) {
	return ccc.gettext(str);
}

class ProxyModeApplet extends Applet.IconApplet {
	// disabled, not supported on Cinnamon$4.4.8
	// _meta = null;
	// _menuItems = null;
	// _menuModeChangedHandlerId = null;
	// _settingsModeChangeHandlerId = null;
	// _proxySettings = null;
	// _menu = null;

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
		// this._meta = metadata;

		this._initContextMenu();
		this._initMenu(orientation);
		this._connectSettings();
		this._updateMenu();
	}

	_init(orientation, panelHeight, instanceId) {
		super._init(orientation, panelHeight, instanceId);
		this.set_applet_tooltip(this._("Proxy Mode Switcher"));
		this.set_applet_icon_symbolic_name("preferences-system-network-proxy-symbolic");
	}

	_initContextMenu() {
		if (this._applet_context_menu) {
			let openSettingsItem = new PopupMenu.PopupIconMenuItem(_ccc("Network settings"), 'preferences-system-network-symbolic', St.IconType.SYMBOLIC);
			openSettingsItem.connect('activate', () => {
				Util.spawnCommandLine("cinnamon-settings network");
			});
			this._applet_context_menu.addMenuItem(openSettingsItem);
		}
	}

	_initMenu(orientation) {
		this._menu = new Applet.AppletPopupMenu(this, orientation);
		this._menuManager.addMenu(this._menu);

		this._menuItems = {
			none: new PopupMenu.PopupIndicatorMenuItem(_ccc("None")),
			manual: new PopupMenu.PopupIndicatorMenuItem(_ccc("Manual")),
			auto: new PopupMenu.PopupIndicatorMenuItem(_ccc("Automatic"))
		};

		this._menu.addMenuItem(this._menuItems.none);
		this._menu.addMenuItem(this._menuItems.manual);
		this._menu.addMenuItem(this._menuItems.auto);

		let _setMode = (mode) => {
			if (this._proxySettings) {
				this._proxySettings.set_string('mode', mode);
			}
		};

		this._menuItems.none.connect('activate', () => _setMode('none'));
		this._menuItems.manual.connect('activate', () => _setMode('manual'));
		this._menuItems.auto.connect('activate', () => _setMode('auto'));
	}

	_connectSettings() {
		this._proxySettings = new Gio.Settings({ schema: 'org.gnome.system.proxy' });
		this._settingsModeChangeHandlerId = this._proxySettings.connect('changed::mode', () => {
			this._updateMenu();
		});
	}

	_updateMenu() {
		let mode = this._proxySettings.get_string('mode');
		this._menuItems.none.setShowDot(mode === 'none');
		this._menuItems.manual.setShowDot(mode === 'manual');
		this._menuItems.auto.setShowDot(mode === 'auto');
	}

	_cleanup() {
		if (this._settingsModeChangeHandlerId) {
			this._proxySettings.disconnect(this._settingsModeChangeHandlerId);
			this._settingsModeChangeHandlerId = null;
		}
		if (this._proxySettings) {
			this._proxySettings = null;
		}
	}

	on_applet_clicked(event) {
		// HACK: protection from weird cinnamon bug where both context and main menu opens and main one stucks along with whole cinnamon
		// observer on cinnamon 4.4.8
		if (this._applet_context_menu.isOpen) {
			this._applet_context_menu.toggle();
		}

		this._menu.toggle();
	}

	on_applet_reloaded() {
		this._cleanup();
		super.on_applet_reloaded();
	}

	on_applet_removed_from_panel() {
		this._cleanup();
		super.on_applet_removed_from_panel();
	}

}

function main(metadata, orientation, panelHeight, instanceId) {
	return new ProxyModeApplet(metadata, orientation, panelHeight, instanceId);
}
