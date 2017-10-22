const Lang = imports.lang;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "a4techTool@mous";
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
 
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

/* TextImageMenuItem taken from sound@cinnamon.org applet */
let icon_path = "/usr/share/cinnamon/theme/";

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, image, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.actor.add_style_pseudo_class('active');
        if (icon) {
            this.icon = new St.Icon({icon_name: icon});
        }
        if (image) {
            this.icon = new St.Bin();
            this.icon.set_child(this._getIconImage(image));
        }
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setText: function(text) {
        this.text.text = text;
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },

    setImage: function(image) {
        this.icon.set_child(this._getIconImage(image));
    },

    // retrieve an icon image
    _getIconImage: function(icon_name) {
         let icon_file = icon_path + icon_name + ".svg";
         let file = Gio.file_new_for_path(icon_file);
         let icon_uri = file.get_uri();
 
         return St.TextureCache.get_default().load_uri_sync(1, icon_uri, 16, 16);
    },
}
/* end of TextImageMenuItem */
 
MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,
 
    _init: function(orientation){
        Applet.Applet.prototype._init.call(this, orientation);
 
        try {
			this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
			this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;        	
			this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });
			this._applet_label.set_style_class_name("battery-label");
 
			this._applet_label.set_text(" N/A% ");
            this.set_applet_tooltip(_("Remaining battery: N/A%, Profile: N/A"));
			
			//Menu
			
			this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);
            
			this._brightnessTitle = new TextImageMenuItem(_("Sleep Time:"), "none", false, "right", "sound-volume-menu-item");
            
            this._brightnessSlider = new PopupMenu.PopupSliderMenuItem(10);
            this._brightnessSlider.connect('value-changed', Lang.bind(this, this._sliderChanged));
            
			//GetSleepTime_start

			let sleeptime = GLib.spawn_command_line_sync('a4_tool sleep get');
			let sleepstr = sleeptime[1].toString();
			//global.logError('DEBUG sleepstr ' + sleepstr);
			let sleepslice = sleepstr.slice(13,15);

			//GetSleepTime_end
			this._updateBrightnessLabel(sleepslice/10);
			this._brightnessSlider.setValue(sleepslice/10);
			

			this.menu.addMenuItem(this._brightnessTitle);
            this.menu.addMenuItem(this._brightnessSlider); 
			//Other menu actions
			
			this._batteryItem = new PopupMenu.PopupMenuItem(_("Signal:"), { reactive: false });
            this._primaryPercentage = new St.Label();
            this._batteryItem.addActor(this._primaryPercentage, { align: St.Align.END });
            this.menu.addMenuItem(this._batteryItem);
			
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


            this.menu.addAction(_("Dump memory to file"), Lang.bind(this, function() {
				let today = new Date();
				let dd = today.getDate();
				let mm = today.getMonth()+1;

				let yyyy = today.getFullYear();
				if(dd<10){dd='0'+dd} if(mm<10){mm='0'+mm} today = dd+':'+mm+':'+yyyy;
				GLib.spawn_command_line_sync('a4_tool dump dump_' + today + ".txt");                
            }));

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			// SwitchMenu for move/click to wake

			let editMode = true;		
			let editModeCmd = GLib.spawn_command_line_sync('a4_tool sleep get');
			let editModeStr = editModeCmd[1].toString();

			//global.logError('DEBUG editModeStr ' + editModeStr);
			if( /move\n$/.test(editModeStr) ) editMode = true;
			else editMode = false;
			
            let panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Move to wake"), editMode);
            panelEditMode.connect('toggled', function(item) {
				if(item.state){
					let sleepSetCommand = "a4_tool sleep set move " + sleepslice;
					GLib.spawn_command_line_sync("a4_tool sleep set move " + sleepslice);	
				}                
				else GLib.spawn_command_line_sync("a4_tool sleep set click " + sleepslice);		
            });
            this.menu.addMenuItem(panelEditMode);
			//global.logError('DEBUG changed editModeStr ' + editModeStr.toString(16));

			//update            
			this._update_bat();
        }
        catch (e) {
            global.logError(e);
        }

     },
 
    _update_bat: function() {
        let text = GLib.spawn_command_line_sync('a4_tool bat');
		let profile = GLib.spawn_command_line_sync('a4_tool profile get');
		let percent = text[1].toString();
		let prof = profile[1].toString();
		let check = percent.slice(11,14);
		if(text[0] == true){
			this._applet_label.set_text(" " + check + "%");
			if(check < 50){
				GLib.spawn_command_line_sync('notify-send -u low "mouse battery" "battery level is geting low"');
				this._applet_label.set_style_class_name("battery-label_50");
			}
			else if(check < 20){
				GLib.spawn_command_line_sync('notify-send -u normal "mouse battery" "battery level is geting really low"');
				this._applet_label.set_style_class_name("battery-label_20");
			}								
			else if(check < 10){
				GLib.spawn_command_line_sync('notify-send -u critical "mouse battery" "battery level is geting super low"');
				this._applet_label.set_style_class_name("battery-label_20");
			}
        	//this.set_applet_label(" " + percent.slice(11,14) + "%");
        	this.set_applet_tooltip(_("Remaining mouse battery: " + check + _("%, Profile: ") + prof.charAt(17)));
		}
		else{
			this._applet_label.set_text(" N/A% ");
			//this.set_applet_label(" N/A% ");
			this.set_applet_tooltip(_("Remaining battery: N/A%"));
		}        
		Mainloop.timeout_add(1800000, Lang.bind(this, this._update_bat));
    },

	on_applet_clicked: function(event) {
		let signal = GLib.spawn_command_line_sync("a4_tool siglevel");
		let signalstr = signal.toString();
		let signalslice = signalstr.slice(19,21);

		this._primaryPercentage.text =(signalslice + "%");
        let text = GLib.spawn_command_line_sync('a4_tool bat');
		let profile = GLib.spawn_command_line_sync('a4_tool profile get');
		let percent = text[1].toString();
		let prof = profile[1].toString();
		if(text[0] == true){
			this._applet_label.set_text(" " + percent.slice(11,14) + "%");
        	//this.set_applet_label(" " + percent.slice(11,14) + "%");
        	this.set_applet_tooltip(_("Remaining mouse battery: ") + percent.slice(11,14) + _("%, Profile: ") + prof.charAt(17));
		}
		else{
			this._applet_label.set_text(" N/A% ");
			//this.set_applet_label(" N/A% ");
			this.set_applet_tooltip(_("Remaining battery: N/A%"));
		}
		this.menu.toggle();               
    },

   
	 _getBrightnessForcedUpdate: function() {
			let sleeptime = GLib.spawn_command_line_sync('a4_tool sleep get');
			let sleepstr = sleeptime[1].toString();
			let sleepslice = sleepstr.slice(13,15);
            this._updateBrightnessLabel(sleepslice);
            this._brightnessSlider.setValue(sleepslice);
		
    },

	_sliderChanged: function(slider, value) {
		this._updateBrightnessLabel(value);
    },

	_updateBrightnessLabel: function(value) {
		let editMode = GLib.spawn_command_line_sync('a4_tool sleep get');
		let editModeStr = editMode[1].toString();
		//global.logError('DEBUG brightness editMode ' + editModeStr);

		if( /move\n$/.test(editModeStr) ){
			editMode = "move";
		}
			else editMode = "click";

        this._brightnessTitle.setText(_("Sleep time") + ": " + Math.round(value*10) + _("min"));
        let result = GLib.spawn_command_line_sync("a4_tool sleep set "+ editMode + " " + Math.round(value*10));
		
		//DEBUG and ERRORs
		//if(!result[0]) global.logError('DEBUG change failed');
		//else global.logError('DEBUG changed ' + editMode + " " + Math.round(value*10));

    }

};
 
function main(metadata, orientation){
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
