const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const AppletDir = imports.ui.appletManager.appletMeta['menu@csknet.org'].path;

function MyMenu(launcher, orientation) {
    this._init(launcher, orientation);
}
MyMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    _init: function(launcher, orientation) {
        this._launcher = launcher;
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    }
}

function MyApplet(orientation) {
	this._init(orientation);
};

MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			this.set_applet_icon_name("star");
			this.set_applet_tooltip("Csk Menu");

			this.menuManager = new PopupMenu.PopupMenuManager(this);
            		this.menu = new MyMenu(this, orientation);
            		this.menuManager.addMenu(this.menu);
            
            		this.updateMenu();
		}
		catch (e) {
			global.logError(e);
		}
	},
	
	updateMenu: function() {
		this.menu.removeAll();
		try {

			let [res, out, err, status] = GLib.spawn_command_line_sync("cat "+AppletDir+"/applet.cfg");
		
			if(out.length!=0) {
				let comandi = out.toString().split("\n");
				for(let i=0; i<comandi.length; i++) {
					let comando = comandi[i];
					if(comando=="") continue;
					
					if (comando=="--") {
						this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
						continue;
                                        }

					let info = comando.split("^");					
					let name = info[0];
					let id = info[1];		
					
					if (name=="title") {
						let menuitem = new PopupMenu.PopupMenuItem(id);
						menuitem.actor.reactive = false;
						menuitem.actor.can_focus = false;
						menuitem.label.add_style_class_name('stile-titolo');
						menuitem.setShowDot(true);
						this.menu.addMenuItem(menuitem);
						continue;
					}

					let menuitem = new PopupMenu.PopupMenuItem(name);
					menuitem.label.add_style_class_name('stile-normale');
					menuitem.connect('activate', Lang.bind(this, function() { this.startCM(id); }));
					this.menu.addMenuItem(menuitem);					
				}
			}
		} catch(e) {
			this.menu.addMenuItem(new PopupMenu.PopupMenuItem("ERROR: "+err.toString(), { reactive: false }));
		}
		
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		let menuitemUpdate = new PopupMenu.PopupMenuItem("Refresh");
		menuitemUpdate.label.add_style_class_name('stile-refresh');
		menuitemUpdate.connect('activate', Lang.bind(this, this.updateMenu));
		this.menu.addMenuItem(menuitemUpdate);
	},
	
	startCM: function(id) {
		Main.Util.spawnCommandLine(id);
	},
	
	on_applet_clicked: function(event) {
		this.menu.toggle();
	}
};

function main(metadata, orientation) {
	let myApplet = new MyApplet(orientation);
	return myApplet;
}
