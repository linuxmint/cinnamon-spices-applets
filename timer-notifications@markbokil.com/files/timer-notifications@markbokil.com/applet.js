// Timer applet with notifications visual and auditory
// Mark Bokil 5/12/12
// Version 1.0.2

const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const Gettext = imports.gettext;

const AppletMeta = imports.ui.appletManager.applets['timer-notifications@markbokil.com'];
const AppletDir = imports.ui.appletManager.appletMeta['timer-notifications@markbokil.com'].path;
const ConfigFile = GLib.build_filenamev([global.userdatadir, 'applets/timer-notifications@markbokil.com/config.js']);
var AppOptions = AppletMeta.config.Options;
const OpenFileCmd = "xdg-open";
    
    // l10n/translation support
const UUID = "timer-notifications@markbokil.com";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function ConfirmDialog(){
    this._init();
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: AppOptions.ConfirmMessage + "\n\n", style_class: "centered"});
	this.contentLayout.add(label);

	this.setButtons([
	    {
	    style_class: "centered",
		label: _("Okay"),
		action: Lang.bind(this, function(){
            this.close();
        
		})
	    }
	]);
    },	
}


function PopupMenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}


function MyApplet(orientation) {
    this._init(orientation);
}



MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        
        try {        
            //set properties from external config file
            this.ConfirmPromptOn = AppOptions.ConfirmPromptOn;
            this.SoundPromptOn = AppOptions.SoundPrompOn;
            this.MessagePromptOn = AppOptions.MessagePromptOn;
            this.ShowMenuOn = AppOptions.ShowMenuOn;
            this.MessageStr = AppOptions.MessageStr;
            this.SoundPath = AppOptions.SoundPath; 
            this.LabelOn = AppOptions.LabelOn; 
		
            this.Timers = AppOptions.Timers;

            this.set_applet_icon_path(AppletDir + "/" + AppOptions.AppIcon);
            this.set_applet_label("");

            this.set_applet_tooltip(_("Timer Notifications"));
            
            this.timerDuration = 0;
            this.timerStopped = true;
            this.alarmOn = false;
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);     
                                                                
            
            this.timerSwitch = new PopupMenu.PopupSwitchMenuItem(_("Timer"));
            this.timerSwitch.connect('toggled', Lang.bind(this, this.doTimerSwitch));
            this.menu.addMenuItem(this.timerSwitch);
            
            this.buildTimePresetMenu();

            this.timerMenuItem = new PopupMenu.PopupMenuItem(_("Minutes: 0"), { reactive: false });
            this.menu.addMenuItem(this.timerMenuItem);
                                  
            this._timerSlider = new PopupMenu.PopupSliderMenuItem(0);
            this._timerSlider.connect('value-changed', Lang.bind(this, this.sliderChanged));
            this._timerSlider.connect('drag-end', Lang.bind(this, this.sliderReleased));
      
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection); 
            
            this.menu.addMenuItem(this._timerSlider);
            this.createContextMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        if (this.timerStopped && this.alarmOn) {
            this.set_applet_icon_path(AppletDir + "/" + AppOptions.AppIcon); // clear icon to default
            this.alarmOn = false;        
        }
 
        this.menu.toggle();
    },
    
    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    buildTimePresetMenu: function() {
            this.presetTimeMenu = new PopupMenu.PopupSubMenuMenuItem(_("Time Presets"));
	    
	    this.Timers.forEach( (timerOpt) => {
                
                var timerMinutes, timerLabel;
                if( timerOpt !== null && typeof timerOpt === 'object'){
                    timerMinutes = timerOpt.minutes;
                    timerLabel = timerOpt.label;
                }else{
                    timerMinutes = timerOpt;
                    timerLabel = timerOpt + " Minutes";
                }
                
                var timerPresetItem = new PopupMenu.PopupMenuItem(_(timerLabel));
                this.presetTimeMenu.menu.addMenuItem(timerPresetItem);
                timerPresetItem.connect('activate', Lang.bind(this, () => {
                    this.timerDuration = timerMinutes;
                    this.doStartTimer();
                }, '_output')); 
            });
            
            this.menu.addMenuItem(this.presetTimeMenu);  
    },
    
    
    doTimerSwitch: function(item) {
        if (item.state) {
            if (this.timerDuration == 0) {
                this.timerSwitch.setToggleState(false);
                
                return;
            }
            
            this.doStartTimer();
            
        } else {
            this.doStopTimer();
           
        }
    },
    
    doStartTimer: function() {
        if (this.timerDuration == 0) return;
        this.set_applet_icon_path(AppletDir + "/" + AppOptions.AppIconRunning);
        
        this.timerStopped = false;
        this.timerSwitch.setToggleState(true);
        this.startTime = this.getCurrentTime();
        this.endTime = this.startTime + this.timerDuration *  60 * 1000;
        
        this.timerMenuItem.label.text = _("Minutes: ") + this.timerDuration;
        if (AppOptions.LabelOn) {
            this.set_applet_label(this.timerDuration.toString());
        }  
 
        let timeStr = _("Timer: ") + this.timerDuration + _(" min.");
        this.set_applet_tooltip(_(timeStr));
        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.doUpdateUI));
    },
    
    getCurrentTime: function() {
        let d = new Date();
	    let x = Math.floor(d.getTime());
	    return x;
    },

    doStopTimer: function() {
        this.timerStopped = true;
        this.set_applet_icon_path(AppletDir + "/" + AppOptions.AppIcon);
     
        this.timerSwitch.setToggleState(false);
        this.set_applet_tooltip(_("Timer: ") + this.timerDuration + _(" min. OFF"));
    },
    
    doUpdateUI: function() {
        if (this.timerStopped) return;
        
        if (this.getCurrentTime() >= this.endTime) {
            this.doTimerExpired();
            return;
        }
        this.timerDuration = Math.round( (this.endTime - this.getCurrentTime()) / 60000);
        
        this.timerMenuItem.label.text = _("Minutes: ") + this.timerDuration; 
        let timeStr = _("Timer: ") + this.timerDuration + _(" min.");
        this.set_applet_tooltip(_(timeStr));
        if (AppOptions.LabelOn) {
            this.set_applet_label(this.timerDuration.toString());
        }  
              
        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.doUpdateUI));
    },
    
    doTimerExpired: function() {
        this.alarmOn = true;
        this.doStopTimer();
        this.set_applet_icon_path(AppletDir + "/" + AppOptions.AppIconReversed);
        if (AppOptions.LabelOn) {
            this.set_applet_label(""); // remove label on panel
        }  
       
        if (this.ShowMenuOn) {
            this.menu.open();
        }
        if (this.SoundPromptOn) {
             try {
                Util.spawnCommandLine("play " + this.SoundPath);
             }
             catch (e) {
                global.logError(e);
             }
        }
        if (this.MessagePromptOn) {
            Util.spawnCommandLine("notify-send '" + this.MessageStr + "'");   
        }   
        if (this.ConfirmPromptOn) {
            this.set_applet_icon_path(AppletDir + "/" + AppOptions.AppIcon); //clear icon
            this.confirm = new ConfirmDialog();
            this.confirm.open();
        }
        
    },
    
    sliderChanged: function(slider, value) {
        this.timerStopped = true;
        let position = parseFloat(value);
        this.timerDuration = Math.round(position/1.65 * 100);
        if (this.timerDuration > 60) this.timerDuration = 60;
        this.timerMenuItem.label.text = _("Minutes: ") + this.timerDuration;  
        let timeStr = _("Timer: ") + this.timerDuration + _(" min.");
        this.set_applet_tooltip(_(timeStr));
    },
    
    sliderReleased: function(slider, value) {   
        this.timerStopped = true; 
        if (this.timerDuration == 0) {
            this.doStopTimer();
            if (AppOptions.LabelOn) {
                this.set_applet_label(""); // remove label on panel
            }  
            return; 
        }
      
        this.doStartTimer();
    },
    
    loadOptions: function() {
        AppOptions = AppletMeta.config.Options;
        AppOptions = null;
        AppOptions = AppletMeta.config.Options;
    },
    
    createContextMenu: function () {
        this.edit_menu_item = new Applet.MenuItem(_('Edit Options'), Gtk.STOCK_EDIT, 
            Lang.bind(this, this.editProperties)); 
        this.reload_menu_item = new Applet.MenuItem(_('Restart Cinnamon'), Gtk.STOCK_REFRESH, 
            Lang.bind(this, this.doRestart));        
        this._applet_context_menu.addMenuItem(this.edit_menu_item);
        this._applet_context_menu.addMenuItem(this.reload_menu_item);
       
    },
    
    editProperties: function () {
        Main.Util.spawnCommandLine(OpenFileCmd + " " + ConfigFile);
    },
    
    doRestart: function() {
        Util.spawnCommandLine(global.reexec_self());
    }

};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
