const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Settings = imports.ui.settings;
const AppletDir = imports.ui.appletManager.applets['jalalical@alocersade.gmail'];
const Calendar = AppletDir.calendar;
const CinnamonDesktop = imports.gi.CinnamonDesktop;

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

function _onVertSepRepaint (area)
{
    let cr = area.get_context();
    let themeNode = area.get_theme_node();
    let [width, height] = area.get_surface_size();
    let stippleColor = themeNode.get_color('-stipple-color');
    let stippleWidth = themeNode.get_length('-stipple-width');
    let x = Math.floor(width/2) + 0.5;
    cr.moveTo(x, 0);
    cr.lineTo(x, height);
    Clutter.cairo_set_source_color(cr, stippleColor);
    cr.setDash([1, 3], 1); // Hard-code for now
    cr.setLineWidth(stippleWidth);
    cr.stroke();
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {    

            this.clock = new CinnamonDesktop.WallClock();

            this.settings = new Settings.AppletSettings(this, "jalalical@alocersade.gmail", this.instance_id);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            
            this._orientation = orientation;
            
            this._initContextMenu();
                                     
            this._calendarArea = new St.BoxLayout({name: 'calendarArea' });
            this.menu.addActor(this._calendarArea);

            // Fill up the first column

            let vbox = new St.BoxLayout({vertical: true});
            this._calendarArea.add(vbox);

            // Date
            this._date = new St.Label();
            this._date.style_class = 'datemenu-date-label';
            vbox.add(this._date);
           
            this._eventSource = null;
            this._eventList = null;

            // Calendar
            this._calendar = new Calendar.Calendar(this._eventSource, this.settings);       
            vbox.add(this._calendar.actor);

            let item = new PopupMenu.PopupMenuItem(_("Date and Time Settings"))
            item.connect("activate", Lang.bind(this, this._onLaunchSettings));
            //this.menu.addMenuItem(item);
            if (item) {
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                separator.setColumnWidths(1);
                vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

                item.actor.can_focus = false;
                global.reparentActor(item.actor, vbox);
            }

            // Track changes to clock settings
            this._dateFormatFull = _("%A %B %e, %Y");

            this.settings.bindProperty(Settings.BindingDirection.IN, "use-custom-format", "use_custom_format", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "custom-format", "custom_format", this.on_settings_changed, null);        

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            this._upClient.connect('notify-resume', this._updateClockAndDate);

            // Start the clock
            this.on_settings_changed();
            this._updateClockAndDatePeriodic();
     
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        //~ this.menu.toggle();
    },

    on_settings_changed: function() {        
        this._updateClockAndDate();
    },

    on_custom_format_button_pressed: function() {
        Util.spawnCommandLine("xdg-open http://www.foragoodstrftime.com/");
    },
    
    _onLaunchSettings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _updateClockAndDate: function() {
        let now = new Date();        
        
        // Applet label
        //~ if (this.use_custom_format) {
            //~ let label_string = now.toLocaleFormat(this.custom_format);
            //~ if (!label_string) {
                //~ global.logError("Calendar applet: bad time format string - check your string.");
                //~ label_string = "~CLOCK FORMAT ERROR~ " + now.toLocaleFormat("%l:%M %p");
            //~ }          
            //~ this.set_applet_label(label_string);   
        //~ }
        //~ else {
            //~ if (this.clock) { // We lose cinnamon-desktop temporarily during suspend
                //~ this.set_applet_label(this.clock.get_clock().capitalize());
            //~ }
        //~ }
        
        let label_string = this.jalali ( now ) ;
        this.set_applet_label ( label_string ) ;

        // Applet content
        let dateFormattedFull = now.toLocaleFormat(this._dateFormatFull).capitalize();
        if (dateFormattedFull !== this._lastDateFormattedFull) {
            this._date.set_text(dateFormattedFull);
            this.set_applet_tooltip(dateFormattedFull);
            this._lastDateFormattedFull = dateFormattedFull;
        }
    },

    _updateClockAndDatePeriodic: function() {
        this._updateClockAndDate();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDatePeriodic));
    },
    
    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    _initContextMenu: function () {
        if (this._calendarArea) this._calendarArea.unparent();
        if (this.menu) this.menuManager.removeMenu(this.menu);
        
        this.menu = new Applet.AppletPopupMenu(this, this._orientation);
        this.menuManager.addMenu(this.menu);
        
        if (this._calendarArea){
            this.menu.addActor(this._calendarArea);
            this._calendarArea.show_all();
        }
        
        // Whenever the menu is opened, select today
        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                let now = new Date();
                /* Passing true to setDate() forces events to be reloaded. We
                 * want this behavior, because
                 *
                 *   o It will cause activation of the calendar server which is
                 *     useful if it has crashed
                 *
                 *   o It will cause the calendar server to reload events which
                 *     is useful if dynamic updates are not supported or not
                 *     properly working
                 *
                 * Since this only happens when the menu is opened, the cost
                 * isn't very big.
                 */
                this._calendar.setDate(now, true);
                // No need to update this._eventList as ::selected-date-changed
                // signal will fire
            }
        }));
    },
    
    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },
    
    jalali: function ( now ) {
		var g_numDays_month = [0,31,59,90,120,151,181,212,243,273,304,334] ;
		var s_numDays_month = [0,31,62,93,124,155,186,216,246,276,306,336] ;
		var s_month_names = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivaar', 'Mehr','Aban','Azar','Dey','Bahman','Esfand'] ;
		var s_month_names_persian = ['\u0641\u0631\u0648\u0631\u062F\u06CC\u0646',
		'\u0627\u0631\u062F\u06CC\u0628\u0647\u0634\u062A','\u062E\u0631\u062F\u0627\u062F',
		'\u062A\u06CC\u0631','\u0645\u0631\u062F\u0627\u062F','\u0634\u0647\u0631\u06CC\u0648\u0631',
		'\u0645\u0647\u0631','\u0622\u0628\u0627\u0646','\u0622\u0630\u0631',
		'\u062F\u06CC','\u0628\u0647\u0645\u0646','\u0627\u0633\u0641\u0646\u062F'] ;
		var weekdays_persian_name = [ '\u06CC\u06A9\u0634\u0646\u0628\u0647'
		,'\u062F\u0648\u0634\u0646\u0628\u0647','\u0633\u0647\u0634\u0646\u0628\u0647',
		'\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647','\u067E\u0646\u062C\u0634\u0646\u0628\u0647',
		'\u062C\u0645\u0639\u0647','\u0634\u0646\u0628\u0647'] ;
		var g_year = now.getYear ( ) + 1900 ;
		var g_month = now.getMonth ( ) + 1 ;
		var g_day = now.getDate ( ) ;
		var s_year = 0
		var s_month = 0 ;
		var s_day = 0 ;
		var s_weekday ;
		var g_total_days = ( g_year * 365.2425 ) + g_numDays_month[g_month - 1] + g_day ;
		var s_total_days = g_total_days - 226896 ;
		s_year = Math.floor ( s_total_days / 365.2422 ) ;
		var remaining_days = Math.floor ( s_total_days % 365.2422 ) ;
		for ( var i = 11 ; i >= 0 ; i-- ) {
			if ( remaining_days > s_numDays_month[i] ) {
				s_day = remaining_days - s_numDays_month[i] + 1 ;
				s_month = i + 1 ;
				break ;
			}
		}
		var current_month_name = s_month_names_persian[i] ;
		s_weekday = now.getDay() ;
		var ttt = weekdays_persian_name[s_weekday] + " " + s_day.toString() + " " + current_month_name + " " + s_year.toString().substring(2) ;
		return ttt ;
	}
    
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
