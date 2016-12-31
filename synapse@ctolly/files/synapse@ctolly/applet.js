const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Cinnamon = imports.gi.Cinnamon;

const icon = "synapse-1.svg"
const appletUUID = 'synapse@ctolly';
const iconPath = imports.ui.appletManager.appletMeta[appletUUID].path+"/"+icon;

const useDefaultIcon = false;

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
	try {
		if(useDefaultIcon){
            		this.set_applet_icon_symbolic_name("synapse");
		} else {
			this.set_applet_icon_path(iconPath);
		}
        	this.set_applet_tooltip(_("Synapse"));
	} 
	catch (e) {
		global.logError(e);
	}
    },
    
    on_window_mapped: function(cinnamonwm, actor) {
        this._desktopShown = false;        
    },
    
    on_applet_clicked: function(event) {
	let _appSys = Cinnamon.AppSystem.get_default();
	let _gsmApp = _appSys.lookup_app('synapse.desktop');
	_gsmApp.activate();
    }
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}
