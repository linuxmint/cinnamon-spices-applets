const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const GLib = imports.gi.GLib;
const NMClient = imports.gi.NMClient;

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {               
            this.set_applet_icon_path(metadata.path + "/icon.png");   
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);       
                     
            this.imageWidget = new St.Bin({x_align: St.Align.MIDDLE});            
            this.textWidget = new St.Label();            
            this.menu.addActor(this.imageWidget);
            this.menu.addActor(this.textWidget);
            
            this._device = "eth0";
            this._client = NMClient.Client.new();
            //this._update();            
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        if (!this.menu.isOpen) {
            this._update();
        }
        this.menu.toggle();
    },
    
    _update: function() {
        this._updateDevice();
        this._updateGraph();
        //Mainloop.timeout_add_seconds(5, Lang.bind(this, this._update));
        //return false;
    },
    
    _updateDevice: function() {
        try {
            global.logError("device: " + this._device);
            let activeConnections = this._client.get_active_connections();
            for (let i = 0; i < activeConnections.length; i++) {
                let a = activeConnections[i];
                if (a['default']) {
                    let devices = a.get_devices();
                    for (let j = 0; j < devices.length; j++) {
                        let d = devices[j];
                        if (d._delegate) {
                            this._device = d.get_iface();
                            break;
                        }
                    }                        
                }
            }                                                  
        }
        catch (e) {
            this._device = "eth0";
            global.logError(e);
        }
    },
       
    _updateGraph: function() {
        try {                                                    
            GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this._device + ' -o /tmp/vnstatlmapplet.png');
            let l = new Clutter.BinLayout();
            let b = new Clutter.Box();
            let c = new Clutter.Texture({keep_aspect_ratio: true, filter_quality: 2, filename: "/tmp/vnstatlmapplet.png"});
            b.set_layout_manager(l);            
            b.add_actor(c);
            this.imageWidget.set_child(b);
        }
        catch (e) {
            this.textWidget.set_text(" Please make sure vnstat and vnstati are installed and that the vnstat daemon is running! " + e + " ");
            global.logError(e);
        }
                
    },
            
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;      
}
