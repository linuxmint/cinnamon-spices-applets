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
// const NMClient = imports.gi.NMClient;
// const NetworkManager = imports.gi.NetworkManager;

// Code for selecting network manager thanks to Jeffrey Bush
const GIRepository = imports.gi.GIRepository;
let CONNECTED_STATE, NMClient_new;
let nm_index = GIRepository.Repository.get_default().get_loaded_namespaces().indexOf('NetworkManager')
if (nm_index == -1) {
  // The NetworkManager repository is not currently loaded so load the NM repo
  const NM = imports.gi.NM;
  CONNECTED_STATE = NM.DeviceState.Activated;
  NMClient_new = () => { return NM.Client.new(null); }
} else {
  // The NetworkManager repository is current loaded so load it and the NMClient repos
  const NMClient = imports.gi.NMClient;
  const NetworkManager = imports.gi.NetworkManager;
  CONNECTED_STATE = NetworkManager.DeviceState.ACTIVATED;
  NMClient_new = () => { return NMClient.Client.new(); }
}

// l10n/translation
const Gettext = imports.gettext;
let UUID;

function _(str) {
    return Gettext.dgettext(UUID, str);
};

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {
            // l10n/translation
            UUID = metadata.uuid;
            Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

            this.set_applet_icon_path(metadata.path + "/icon.png");   
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);       
                     
            this.imageWidget = new St.Bin({x_align: St.Align.MIDDLE});            
            this.textWidget = new St.Label();            
            this.menu.addActor(this.imageWidget);
            this.menu.addActor(this.textWidget);
            
            this._device = "null";
            this.vnstatImage = GLib.get_home_dir() + "/vnstatlmapplet.png";
//            this._client = NMClient.Client.new();
            this._client = NMClient_new();
            
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
        this._updateGraph(); // Comment this out to test without vnstat installed
    },

    getInterfaces: function () {
        return this._client.get_devices();
    },

    isInterfaceAvailable: function (name) {
        let interfaces = this.getInterfaces();
        if (interfaces != null) {
           for (let i = 0; i < interfaces.length; i++) {
                let iname = interfaces[i].get_iface();
//                if (iname == name && interfaces[i].state ==  NetworkManager.DeviceState.ACTIVATED) {
                if (iname == name && interfaces[i].state == CONNECTED_STATE) {

                   return true;
                 }
             }
        }
        return false;
    },

    _updateDevice: function() {
         try {
             this._device = "null"
             let interfaces = this.getInterfaces();
             if (interfaces != null) {
                 for (let i = 0; i < interfaces.length; i++) {
                    let iname = interfaces[i].get_iface();
                    if (this.isInterfaceAvailable(iname)) {
                        this._device = iname; 
//                        global.logError("Test output - vnstat@linuxmin.com detected device: " + this._device);   // Comment out unless testing
                    }
                }
            }
        }
        catch (e) {
            global.logError(e);
        } 
    },
       
    _updateGraph: function() {
        try {
            if (this._device != "null") {                                     
               GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this._device + ' -o ' +  this.vnstatImage ); 
//               this.textWidget.set_text(" " + _("Current Active Interface:") + " " + this._device + "  " + _("Last update time is at top right") );
            }
            else {
                this.textWidget.set_text(" " + _("No interface devices currently active - Showing last update") + " ");
            }
            let l = new Clutter.BinLayout();
            let b = new Clutter.Box();
            let c = new Clutter.Texture({keep_aspect_ratio: true, filter_quality: 2, filename: this.vnstatImage });
            b.set_layout_manager(l);            
            b.add_actor(c);
            this.imageWidget.set_child(b);
        }
        catch (e) {
            this.textWidget.set_text(" " + _("Please make sure vnstat and vnstati are installed and that the vnstat daemon is running!") + " " + e + " ");
            global.logError(e);
        }
    },
         
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;      
}

