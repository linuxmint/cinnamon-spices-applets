// Redshift Cinnamon applet
// Marvin Uhlmann 7/8/17
// Version 1.0

const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop; //timer stuff
const Gettext = imports.gettext.domain('cinnamon');
const _ = Gettext.gettext;

//const SetBrightnessCmd = 'gdbus call --session --dest org.gnome.SettingsDaemon --object-path /org/gnome/SettingsDaemon/Power --method org.gnome.SettingsDaemon.Power.Screen.SetPercentage ';
//const GetBrightnessCmd = 'gdbus call --session --dest org.gnome.SettingsDaemon --object-path /org/gnome/SettingsDaemon/Power --method org.gnome.SettingsDaemon.Power.Screen.GetPercentage';


function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_symbolic_name("keyboard-brightness-symbolic");
            this.set_applet_tooltip(_("Brightness")); // applet tooltip
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);   
                                    
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
            
            this.brightnessMenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.brightnessMenuItem);
    
            //brightness slider control
            this._brightnessSlider = new PopupMenu.PopupSliderMenuItem(0);
            this._brightnessSlider.connect('value-changed', Lang.bind(this, this.sliderChanged));
            this.menu.addMenuItem(this._brightnessSlider);

            //redshift colour slider
            this.c_MenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.c_MenuItem);
            this.c_Slider = new PopupMenu.PopupSliderMenuItem(0);
            this.c_Slider.connect('value-changed', Lang.bind(this, this.c_sliderChanged));
            this.menu.addMenuItem(this.c_Slider);

            //redshift brightness slider
            this.b_MenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.menu.addMenuItem(this.b_MenuItem);
            this.b_Slider = new PopupMenu.PopupSliderMenuItem(0);
            this.b_Slider.connect('value-changed', Lang.bind(this, this.b_sliderChanged));
            this.menu.addMenuItem(this.b_Slider);

            //redshift switch control    		
            this.redshiftSwitch = new PopupMenu.PopupSwitchMenuItem(_("Redshift"));
        		this.redshiftSwitch.connect('toggled', Lang.bind(this, this.doRedshiftSwitch));
        		this.menu.addMenuItem(this.redshiftSwitch);
            
            // delay for UI to allow time to get system power level
            Mainloop.timeout_add(500, Lang.bind(this, this.do_UI_update_probe));
            // crashing HD intel, nvidia without ? uncertain why... hack
            
            // attach scroll event to icon
            //let x = this.get_applet_icon;
            //this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
            // todo: use a St icon with a St box and connect
        }
        catch (e) {
            global.logError(e);
        }
        


        this.maxColor = 7000;
        this.minColor = 1000;

        this.redshiftColor = 3500;
		this.c_Slider.setValue((this.redshiftColor-this.minColor)/(this.maxColor-this.minColor));
        this.do_UI_update_colortag();


        this.maxBrightness = 1;
        this.minBrightness = 0.1;

        this.redshiftBrightness = 0.5;
		this.b_Slider.setValue((this.redshiftBrightness-this.minBrightness)/(this.maxBrightness-this.minBrightness));
        this.do_UI_update_brightnesstag();



    },
    
    on_applet_clicked: function(event) {
        // update brightness UI if values altered by system
        // todo: use watcher on dbus instead
        
        this.do_UI_update_probe();
        this.menu.toggle();
    },

    getSystemBrightness: function() {     
	    try {  
            let currentBright = GLib.spawn_command_line_sync('gdbus call --session --dest org.cinnamon.SettingsDaemon --object-path /org/cinnamon/SettingsDaemon/Power --method org.cinnamon.SettingsDaemon.Power.Screen.GetPercentage'); //crashes if not hard coded
            currentBright = currentBright.toString();
                
            // (uint32 53,) std output of getbrightnesscmd, just want 53 value on end
            // split string and get second part numeric value only
            let strArray = currentBright.split(' ');
            currentBright = strArray[1];
            currentBright = parseInt(currentBright); // strip non-numeric
            // global.log("currentbright: " + currentBright);
            
            if (isNaN(currentBright)) {
                currentBright = 100; // 100% bright as fallback
                global.log("Error getting Cinnamon backlight power settings");
            }
 
            return currentBright / 100;
            }
        catch (e) {
            global.logError(e);
            
		    return 1; // 100% bright as fallback
        }
    },
        
    do_UI_update_probe: function() {
        let currentBrightness = this.getSystemBrightness();
        let brightnessStr = _("Brightness") + ": " + Math.round(currentBrightness * 100) + "%";
        this._brightnessSlider.setValue(currentBrightness); // slider position
        this.set_applet_tooltip(_(brightnessStr)); // applet tooltip
        this.brightnessMenuItem.label.text = brightnessStr; // GUI Label Brightness: 
    },

    do_UI_update_colortag: function() {
        let colorStr = _("Redshift colour") + ": " + this.redshiftColor + "K";
        this.c_MenuItem.label.text = colorStr; // GUI Label Colour: 
    },

    do_UI_update_brightnesstag: function() {
        let brightnessStr = _("Redshift brightness") + ": " + Math.round(this.redshiftBrightness*100) + "%";
        this.b_MenuItem.label.text = brightnessStr; // GUI Label Brightness: 
    },

    
    do_UI_update_slider: function(currentBrightness) { 
        let brightnessStr = _("Brightness") + ": " + currentBrightness + "%";
        this.set_applet_tooltip(_(brightnessStr)); // applet tooltip
        this.brightnessMenuItem.label.text = brightnessStr; // GUI Label Brightness: 
    },
    
    sliderChanged: function(slider, value) {   
        let brightness = parseFloat(value);
        brightness = Math.round(brightness * 100);
        
        if (brightness < 5) brightness = 5 // safe minimum
      
        this.do_UI_update_slider(brightness); //update UI from slider value
        
        try {  
            Util.spawnCommandLine('gdbus call --session --dest org.cinnamon.SettingsDaemon --object-path /org/cinnamon/SettingsDaemon/Power --method org.cinnamon.SettingsDaemon.Power.Screen.SetPercentage ' + brightness); //crashes if not hard coded
        }  
        catch (e) {
            global.logError(e);
        }
    },

    c_sliderChanged: function(slider, value) {   
        this.redshiftSwitch.setToggleState(true);
        let sliderval = parseFloat(value);
        this.redshiftColor = Math.round(sliderval * (this.maxColor-this.minColor)+this.minColor);
//        if (brightness < 5) brightness = 5 // safe minimum
        this.do_UI_update_colortag(); //update UI from slider value
        
        try {
           Util.spawnCommandLine('redshift -O ' + this.redshiftColor +' -b '+this.redshiftBrightness)
        }  
        catch (e) {
            global.logError(e);
        }
    },

    b_sliderChanged: function(slider, value) {   
        this.redshiftSwitch.setToggleState(true);
        let sliderval = parseFloat(value);
        this.redshiftBrightness = sliderval * (this.maxBrightness-this.minBrightness)+this.minBrightness;
//        if (brightness < 5) brightness = 5 // safe minimum
        this.do_UI_update_brightnesstag(); //update UI from slider value
        
        try {
           Util.spawnCommandLine('redshift -O ' + this.redshiftColor +' -b '+this.redshiftBrightness)
        }  
        catch (e) {
            global.logError(e);
        }
    },

	doRedshiftSwitch: function(item) {
        	if (item.state) {
               Util.spawnCommandLine('redshift -O ' + this.redshiftColor +' -b '+this.redshiftBrightness)
        	} 
    		else {
                Util.spawnCommandLine('redshift -x')
    		}
    	},


    
    // todo: attach to St box using an icon obj
    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            global.log('scrolling down');
        }
        else if (direction == Clutter.ScrollDirection.UP) {
           global.log('scrolling up');
        } 
    },
}

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
