//Cinnamon Applet: Window Buttons with Title v0.5.2
//Release Date: 14 Aug 2014
//
//Author: Fatih Mete
//
//          Email: fatihmete@live.com

//Resources and Thanks: 

//-http://mathematicalcoffee.blogspot.com.tr/2012/05/automatically-undecorate-maximised.html
//-Gnome-Shell Maximus Extension https://bitbucket.org/mathematicalcoffee/maximus-gnome-shell-extension
//-Gnome-Shell Window Buttons Extension https://github.com/mathematicalcoffee/Gnome-Shell-Window-Buttons-Extension
//-Linux Mint IRC - #linuxmint-dev channel <mtwebster> , <clem>

// This program is free software:
//
//    You can redistribute it and/or modify it under the terms of the
//    GNU General Public License as published by the Free Software
//    Foundation, either version 3 of the License, or (at your option)
//    any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

const St = imports.gi.St;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GnomeSession = imports.misc.gnomeSession;


function WindowButtonApplet(orientation,metadata, panelHeight, instance_id) {

	this._init(orientation,metadata, panelHeight, instance_id);
}

WindowButtonApplet.prototype = {

        __proto__: Applet.Applet.prototype,
        
	_init: function(orientation,metadata, panelHeight,  instance_id) { 
	       
	Applet.Applet.prototype._init.call(this, orientation, panelHeight,  instance_id);
	   
	this.instance_id=instance_id;
	this.appletPath=metadata.path;                         

	try {

	this.settings = new Settings.AppletSettings(this, "window-buttons-with-title@fmete", this.instance_id);

	this.settings.bindProperty(Settings.BindingDirection.IN,"title-button-action","titleButtonAction",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-width-option","titleWidthOption",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-width","titleWidth",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-icon-width","titleIconWidth",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"buttons-style","buttons_style",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"buttons-theme","buttonsTheme",null,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-button-action","titleButtonAction",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-middle-button-action","titleMiddleButtonAction",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"icon-button-action","iconButtonAction",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"icon-middle-button-action", "iconMiddleButtonAction", this.on_settings_changed,null); 
	this.settings.bindProperty(Settings.BindingDirection.IN,"show-panels", "show_panels",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"text-mode", "textMode",this.on_settings_changed,null);		  
	this.settings.bindProperty(Settings.BindingDirection.IN,"only-maximized", "onlyMaximized",this.on_settings_changed,null);	
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-font", "titleFont",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-font-style", "titleFontStyle",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-font-color", "titleFontColor",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"title-font-size", "titleFontSize",this.on_settings_changed,null);
	this.settings.bindProperty(Settings.BindingDirection.IN,"on-desktop-shutdown", "onDesktopShutdown",this.on_settings_changed,null);

	this._session = new GnomeSession.SessionManager();

	
	global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
	Main.themeManager.connect("theme-set", Lang.bind(this, this.loadTheme));
	global.window_manager.connect('maximize', Lang.bind(this, this._windowChange));
	global.window_manager.connect('unmaximize', Lang.bind(this, this._windowChange));

	let buttons=this.buttons_style.split(':');
	
	    	if(this.checkButton(buttons,'maximize') || this.checkButton(buttons,'minimize') || this.checkButton(buttons,'close')){
	       		this.loadTheme();
		}
	
	this.button = [];
	this.createButtons(this.buttons_style);
	this._windowChange();

        global.screen.get_display().connect('notify::focus-window', Lang.bind(this, function(){
        				let w=global.display.focus_window;
        				
        				if(w){
        				 	w.connect('notify::title', Lang.bind(this, function(){

							this._windowChange();

							}));
        				 	
        				 }
        				this._windowChange();
        				}));

        this.on_panel_edit_mode_changed;


	}
	catch (e) {
		global.logError(e);
	}
	},

	on_panel_edit_mode_changed: function() {
	let reactive = !global.settings.get_boolean('panel-edit-mode');

	let b=this.buttons_style.split(':');
		for (let i=0; i < b.length; ++i ){

			this.button[b[i]].reactive=reactive;
	}
	},
	

    getCssPath: function(theme) {
    
        let cssPath = this.appletPath + '/themes/'+theme+'/style.css';
        return cssPath;
        
    },

    loadTheme: function(){
    	this.actor.set_style_class_name("window-buttons");
    	let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
    	theme.load_stylesheet(this.getCssPath(this.buttonsTheme));
    	this.oldTheme=this.buttonsTheme;
    	
    },
    
    createButtons: function(buttonsStyle) {
     buttonsStyle=buttonsStyle.split(':');
     	for (let i=0; i < buttonsStyle.length; ++i ){
     	
     		let buttonName=buttonsStyle[i]+"Button";
     	
     		 this[buttonName]();
     		
     	}
    
    },
    fontStyle: function() {
    
    		titleStyle="";
    	    if(this.titleFont){ titleStyle=titleStyle+'font-family:"' + this.titleFont+'";'}
    	    if(this.titleFontStyle){ titleStyle=titleStyle+ 'font-style:'+this.titleFontStyle+';'}
    	    if(this.titleFontColor){ titleStyle=titleStyle+ 'color:'+this.titleFontColor+';'}
    	    if(this.titleFontSize!=0){ titleStyle=titleStyle+ 'font-size:'+this.titleFontSize+'px;'}
    	    
    	    return titleStyle;
    },
    titleButton: function () {
    
    	        	    
    	    this.button['title'] = new St.Button({ name: 'titleButton',
    	    			     //get theme class for fix title label color
    	    		             style_class: 'window-list-item',
                                     style: this.titleWidthOption + this.titleWidth + 'px;' + this.fontStyle(),
   				     reactive: true });
                                     
           
            let label = new St.Label({ text : 'No Active Window', style_class: 'window-list-item'});
	       
            
            this.button['title'].set_child(label);
            this.actor.add(this.button['title']); 
           // this.updateWindowTitle();
            this.button['title'].connect('button-press-event', Lang.bind(this,function(actor,event){
            
             let button = event.get_button();
             
             if (button == 1) {
           	
           	if(this.titleButtonAction==1){
           		
           		this._scale();
           		this.showPanels();
           		return true;
           		
 		}
           	else if(this.titleButtonAction==2) {
           	
           		global.screen.toggle_desktop(global.get_current_time());
           		return true;
           	}
           	else if(this.titleButtonAction==3) {
           	
           		this._expo();
           		this.showPanels();
           		return true;
           	}
           	else if(this.titleButtonAction==4) {
           	
           		this._move();
           	        return true;
           	}

            else if(this.titleButtonAction==5) {
              this.maximizeWindow();
                    return true;
              // GLib.spawn_command_line_async('wmctrl -r :ACTIVE: -b toggle,maximized_vert,maximized_horz');
            }
           	else {
           		return true;
           	} 
           	
           }else if (button == 2) {
           	
           	if(this.titleMiddleButtonAction==1){
           		
           		this._scale();
           		this.showPanels();
           		return true;
           		
 		}
           	else if(this.titleMiddleButtonAction==2) {
           	
           		global.screen.toggle_desktop(global.get_current_time());
           		return true;
           	}
           	else if(this.titleMiddleButtonAction==3) {
           	
           		this._expo();
           		this.showPanels();
           		return true;
           	}
           	else if(this.titleMiddleButtonAction==4) {

           		this._move();
           		return true;
           		
           		
           	}
           	else {
           		return true;
           	} 
           	
         
           }else if(button==3){
            		this._applet_context_menu.toggle();
            	}
           
           return true;
            	
            }));
             
    
    },
    
    iconButton: function (){
    	    this.button['icon'] = new St.Button({ name: 'iconButton',
    	    			     style_class: 'window-list-item',
                                     //style : 'padding-left: 5px; padding-right:5px;', 
                                    
                                     reactive: true });
   
            this.actor.add(this.button['icon']);
            
            this.button['icon'].connect('button-press-event', Lang.bind(this,function(actor,event){
            let button = event.get_button();
             
             if (button == 1) {
             
            	if(this.iconButtonAction==1){
           		this._scale();
           		this.showPanels();
           		return true;
           	}
           	else if(this.iconButtonAction==2) {
           	
           		global.screen.toggle_desktop(global.get_current_time());
           		
           		return true;
           	}
           	else if(this.iconButtonAction==3) {
           	
           		this._expo();
           		this.showPanels();
           		return true;
           	}
           	else if(this.iconButtonAction==4) {
           		
	
           		this._move();
           		return true;
        
           	}
           	else {
           		return true;
           	} 
             }else if (button == 2) {
           	
           	if(this.iconMiddleButtonAction==1){
           		
           		this._scale();
           		this.showPanels();
           		return true;
           		
 		}
           	else if(this.iconMiddleButtonAction==2) {
           	
           		global.screen.toggle_desktop(global.get_current_time());
           		return true;
           	}
           	else if(this.iconMiddleButtonAction==3) {
           	
           		this._expo();
           		this.showPanels();
           		return true;
           	}
           	else if(this.iconMiddleButtonAction==4) {

           		this._move();
           		return true;
           		
           		
           	}
           	 
           	}else if(button==3){
            		this._applet_context_menu.toggle();
            	}
            	else{
           
           	return true;
           }
           
           return true;
            }));
            
            
    },
    
    minimizeButton:function () {      
    	
	    if(this.textMode==false){
            this.button['minimize'] = new St.Button({ name: 'windowButton',
                                     style_class: 'minimize window-button',
                                     reactive: true });
            }else{
            
		    this.button['minimize'] = new St.Button({ 
		    				name: 'windowButton',
						style_class: 'window-list-item-box',
						style: this.fontStyle(),
		                             reactive: true });
		    let label = new St.Label({ text : _('Minimize'), style_class: 'window-list-item'});
		       
		    this.button['minimize'].set_child(label);
            }
          //  let label = new St.Label({  });
            this.actor.add(this.button['minimize']);
            this.button['minimize'].connect('button-press-event', Lang.bind(this,function(actor,event){
            let button = event.get_button();
             
             if (button == 1) {
             
               	this.minimizeWindow();
            	return true;
            }else if(button==3){
            		this._applet_context_menu.toggle();
            	}
            return true;
            }));
      },
      
    minimizeWindow: function() {
    
     	let activeWindow = global.display.focus_window;
    
     	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(activeWindow);
        
	 if (!app) {
	 
          /*  let winactors = global.get_window_actors()
            let uppermost = winactors[winactors.length-1].get_meta_window()
            uppermost.minimize();    */
            return;
              
        }else{
		     activeWindow.minimize();
   
        }
        
      
      
    },
    
    maximizeButton: function () {    
    
    
		if(this.textMode==false){
             
		    this.button['maximize'] = new St.Button({ name: 'windowButton',
		                             style_class: 'maximize window-button',
		                             reactive: true });
		}else{
            
		    this.button['maximize'] = new St.Button({ 
		    				name: 'windowButton',
						style_class: 'window-list-item-box',
						style: this.fontStyle(),
					
		                             reactive: true });
		    let label = new St.Label({ text : _('Maximize'), style_class: 'window-list-item'});
		       
		    this.button['maximize'].set_child(label);
		} 
            /*let label = new St.Label({ });
            this.button['maximize'].set_child(label);*/
            this.actor.add(this.button['maximize']);
            
            this.button['maximize'].connect('button-press-event', Lang.bind(this,function(actor,event){
            
            let button = event.get_button();
             
             if (button == 1) {
            
            	this.maximizeWindow();
            	return true;
            	}else if(button==3){
            		this._applet_context_menu.toggle();
            	}
            	return true;
            }));
       },
       
    maximizeWindow: function() {
        let activeWindow = global.display.focus_window;
        if(activeWindow){
	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(activeWindow);
        if (!app) {

            return;
            
        }else{

        if (activeWindow.get_maximized()) {
	    
            activeWindow.unmaximize(3);
            
        }  else {
	   
            activeWindow.maximize(3);
            	
        }
	}
	}


    },
    closeButton: function () {     
            	if(this.textMode==false){
		
            this.button['close'] = new St.Button({ name: 'windowButton',
                                     style_class: 'close window-button',
                                     reactive: true });
                }else{
            
		    this.button['close'] = new St.Button({ 
		    				name: 'windowButton',
						style_class: 'window-list-item-box',
						style: this.fontStyle(),
					
		                             reactive: true });
		    let label = new St.Label({ text : _('Close'), style_class: 'window-list-item'});
		       
		    this.button['close'].set_child(label);
		} 
            /*
            let label = new St.Label({ });
            this.button['close'].set_child(label);*/
            this.actor.add(this.button['close']);
            
            this.button['close'].connect('button-press-event', Lang.bind(this,function(actor,event){
            
            let button = event.get_button();
             
             if (button == 1) {
            
            	this.closeWindow();
            	return true;
            	
            	}else if(button==3){
            		this._applet_context_menu.toggle();
            	}
            	return true;
            	
            }));
    },
    
    closeWindow: function() {
    
        let activeWindow = global.display.focus_window;
  
        
	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(activeWindow);
       	
        if (!app) {

           /* let winactors = global.get_window_actors()
            let uppermost = winactors[winactors.length-1].get_meta_window()
            uppermost.delete(global.get_current_time()); */
            if(this.onDesktopShutdown==true){

            	this._session.ShutdownRemote();

        	}
            return;
            
        }else{

	 activeWindow.delete(global.get_current_time());
	 }
	 
	
           
    },
    updateMaxButton: function(){
    
    	if(this.textMode==true){
    	
    	let activeWindow = global.display.focus_window;
        if(activeWindow){
        
	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(activeWindow);
       	
       	if(activeWindow.get_maximized()){
       	
       		this.button['maximize'].get_child().set_text(_('Restore'));
       	}else{
       	
       		this.button['maximize'].get_child().set_text(_('Maximize'));
       	}
       	
       	}
       	}
    
    },
    updateWindowTitle: function (){

    	   let activeWindow = global.display.focus_window;
        if(activeWindow){
	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(activeWindow);
       	if(app){

	
            
		    //this.button['title'].show();
		    let t = activeWindow.title;
		    //let label = new St.Label({ text: t });
		    this.button['title'].get_child().set_text("  " + t.toString());
		    //this.actor.add(this.button['title']);
		    
		    }else{
		     let t=_("Desktop");
		     this.button['title'].get_child().set_text("  " + t.toString());
		    
		    }
		    
		    
		    
		    }
            

    
    },
    
    updateWindowIcon: function() {
    
    	let activeWindow = global.display.focus_window;
        if(activeWindow){
	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(activeWindow);
       	if(app){
    
	  
			
			let icon=Cinnamon.WindowTracker.get_default().get_window_app(activeWindow).create_icon_texture(this.titleIconWidth);

			this.button['icon'].set_child(icon);
  
			    //this.actor.add(this.button['icon']);
			    
			    }else {

					let size=parseInt(this.titleIconWidth);
					size=size;
					size=size.toString();
					
					
					let icon = new St.Icon({ icon_name: 'video-display',
					
					
					icon_type: St.IconType.SYMBOLIC,

					style: 'icon-size:'+ size +'px;' });


			    	this.button['icon'].set_child(icon);
			    }
	}else{
	
					let size=parseInt(this.titleIconWidth);
					size=size;
					size=size.toString();
					
					
					let icon = new St.Icon({ icon_name: 'video-display',
					
					
					icon_type: St.IconType.SYMBOLIC,

					style: 'icon-size:'+ size +'px;' });


			    	this.button['icon'].set_child(icon);
	
	}
			  

	    
    },
    _scale: function() {

            if (!Main.overview.animationInProgress){
           	 Main.overview.toggle();
            }
        
    },
    
    _expo: function(){
    
            if (!Main.expo.animationInProgress){
           	 Main.expo.toggle();
            }
    },
    
    _windowChange: function() {
    
    
    	
	    	let buttons=this.buttons_style.split(':');
	    	
	    	if(this.checkButton(buttons,'maximize')){
	    	
	       		this.updateMaxButton();
	       		
			}
	    	
	    	if(this.checkButton(buttons,'title')){
	    	
	       		this.updateWindowTitle();
	       		
			}
	       
			if(this.checkButton(buttons,'icon')){
			
				this.updateWindowIcon();
			
			}
        
	
	    	if(this.onlyMaximized==true){
	    	
				this.onlyMaximize();
				
	       	}

			
 
    }, 
    
    on_settings_changed: function() {
   
        this.actor.destroy_all_children();
        
       	let buttons=this.buttons_style.split(':');
	    	if(this.checkButton(buttons,'maximize') || this.checkButton(buttons,'minimize') || this.checkButton(buttons,'close')){
	       		this.loadTheme();
		}
        this.button = [];
        this.createButtons(this.buttons_style);
        this._windowChange();

    	
    },	
    
   _move: function () {
   
   	let current_window = global.display.focus_window;
  	if(!current_window){
  	//if there isn't active window
  		return true;
  	}
	let tracker = Cinnamon.WindowTracker.get_default();
       	let app = tracker.get_window_app(current_window);
        if (!app) {
        	//if active window is Desktop
        	return true;
        	
        }else{
   	current_window.raise();
            Mainloop.idle_add(  function () {  
                    let pointer = Gdk.Display.get_default().get_device_manager().get_client_pointer(),
                        [scr,,] = pointer.get_position(),
                        rect    = current_window.get_outer_rect(),
                        x       = rect.x + rect.width / 2,
                        y       = rect.y;
                    //
                    /*if (!current_window.get_maximized()) {
		*/
		      pointer.warp(scr, x, y);
		    //}
		    
                    global.display.begin_grab_op(global.screen, current_window,
                        Meta.GrabOp.MOVING, false, true, 0, 0,
                        global.get_current_time(), x, y);
                        
                        
                    return false;
                });
                return true;
                }
         
     return true;
   
   },
   
    
    checkButton: function(arr, obj) {
    
	    for(var i=0; i<arr.length; i++) {
		if (arr[i] == obj){ 
		
			return true;

	    }
	 }
	 return null;

    },
    
    showPanels: function(){
    
    	if(this.show_panels==true){
    	  Main.enablePanels();
    	}
    
    },
    
    onlyMaximize: function(){
    
		
		 w=global.display.focus_window;
		let buttons=this.buttons_style.split(':');
		
		if(w.get_maximized()){
		
			
	    	
	    	 
			for (let i=0; i < buttons.length; ++i ){
     	
				this.button[buttons[i]].show();
     	
     		
			}
			
		}else{
		
			for (let i=0; i < buttons.length; ++i ){
     	
				this.button[buttons[i]].hide();
     	
     		
			}

			
		}
		
		
		
	},
    _cinnamonmaximus: function(){
    
    	Util.spawn(['firefox','http://cinnamon-spices.linuxmint.com/extensions/view/29']);
    
    }
   
  
    
};

function main(metadata,orientation, panelHeight,  instance_id) {  
    //appletPath = metadata.path; 
    let myApplet = new WindowButtonApplet(orientation,metadata, panelHeight, instance_id);
    return myApplet;      
}
