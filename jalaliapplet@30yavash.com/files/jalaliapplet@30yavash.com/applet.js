//
// Jalali Calendar - Cinnamon Applet v0.4 - 29 Sep 2013
//
// The Solar Hijri calendar is the official calendar of Iran and Afghanistan.
//
// based on Ehsan Tabari and Cinnamon calendar applet
//
// -Siavash Salemi
// 30yavash [at] gmail [dot] com
//
const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Calendar = imports.ui.calendar;
const UPowerGlib = imports.gi.UPowerGlib;

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

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height) {        
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height);
        
        try {                 
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
            this._calendar = new Calendar.Calendar(this._eventSource);       
            vbox.add(this._calendar.actor);

            let item = new PopupMenu.PopupMenuItem(_("Date and Time Settings"))
            item.connect("activate", Lang.bind(this, this._onLaunchSettings));
            //this.menu.addMenuItem(item);
            if (item) {
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                separator.setColumnWidths(1);
                vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

                item.actor.can_focus = false;
                item.actor.reparent(vbox);
            }

            // Done with hbox for calendar and event list

            // Track changes to clock settings        
            this._calendarSettings = new Gio.Settings({ schema: 'org.cinnamon.calendar' });
            this._dateFormat = null;
            this._dateFormatFull = null;
            let getCalendarSettings = Lang.bind(this, function() {
                this._dateFormat = this._calendarSettings.get_string('date-format');
                this._dateFormatFull = this._calendarSettings.get_string('date-format-full');
                this._updateClockAndDate();
            });
            this._calendarSettings.connect('changed', getCalendarSettings);

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            this._upClient.connect('notify-resume', getCalendarSettings);

            // Start the clock
            getCalendarSettings();
            this._updateClockAndDatePeriodic();
     
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    
    _onLaunchSettings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _updateClockAndDate: function() {
        let displayDate = new Date();
        let dateFormattedFull = displayDate.toLocaleFormat(this._dateFormatFull);
//        this.set_applet_label(displayDate.toLocaleFormat(this._dateFormat));
// -----Hijri
	let jalali = new JalaliDate(displayDate);
	this.set_applet_label(FarsiNumbers( jalali.toLocaleFormat(this._dateFormat) ));


        if (dateFormattedFull !== this._lastDateFormattedFull) {
            this._date.set_text(dateFormattedFull);
//            this._date.set_text("Hi");
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
    }
    
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}


//+++++++++++++++++++++++++++++++++++++++++
String.prototype.charRefToUnicode = function()
{
return this.replace(
/&#(([0-9]{1,7})|(x[0-9a-f]{1,6}));?/gi,
function(match, p1, p2, p3, offset, s)
{
return String.fromCharCode(p2 || ("0" + p3));
});
}

String.prototype.replaceAll = function (find, replace) {
    var str = this;
    return str.replace(new RegExp(find, 'g'), replace);
};

function FarsiNumbers(strText)
{
let engNum=new Array("0","1","2","3","4","5","6","7","8","9");
let farNum=new Array("&#1776;","&#1777;","&#1778;","&#1779;","&#1780;","&#1781;","&#1782;","&#1783;","&#1784;","&#1785;");
	for(let i=0;i<engNum.length;i++)
		strText=strText.replaceAll(engNum[i],farNum[i].charRefToUnicode());
return strText;
}


function JalaliDate(dateObject)
{
this.toLocaleFormat=function(strFormat){


let FarsiDayNamesFull = new Array (
"&#1588;&#1606;&#1576;&#1607;",
"&#1740;&#1705;&#1588;&#1606;&#1576;&#1607;",
"&#1583;&#1608;&#1588;&#1606;&#1576;&#1607;",
"&#1587;&#1607;&#8204;&#1588;&#1606;&#1576;&#1607;",
"&#1670;&#1607;&#1575;&#1585;&#1588;&#1606;&#1576;&#1607;",
"&#1662;&#1606;&#1580;&#8204;&#1588;&#1606;&#1576;&#1607;",
"&#1580;&#1605;&#1593;&#1607;"
);
let FarsiMonthNames = new Array ("",
"&#1601;&#1585;&#1608;&#1585;&#1583;&#1740;&#1606;",
"&#1575;&#1585;&#1583;&#1740;&#1576;&#1607;&#1588;&#1578;",
"&#1582;&#1585;&#1583;&#1575;&#1583;",
"&#1578;&#1740;&#1585;",
"&#1605;&#1585;&#1583;&#1575;&#1583;",
"&#1588;&#1607;&#1585;&#1740;&#1608;&#1585;",
"&#1605;&#1607;&#1585;",
"&#1570;&#1576;&#1575;&#1606;",
"&#1570;&#1584;&#1585;",
"&#1583;&#1740;",
"&#1576;&#1607;&#1605;&#1606;",
"&#1575;&#1587;&#1601;&#1606;&#1583;");
let FarsiMonthNamesShort = new Array ("",
"&#1601;&#1585;&#1608;",
"&#1575;&#1585;&#1583;",
"&#1582;&#1585;&#1583;",
"&#1578;&#1740;&#1585;",
"&#1605;&#1585;&#1583;",
"&#1588;&#1607;&#1585;",
"&#1605;&#1607;&#1585;",
"&#1570;&#1576;&#1575;",
"&#1570;&#1584;&#1585;",
"&#1583;&#1740;",
"&#1576;&#1607;&#1605;",
"&#1575;&#1587;&#1601;");

	let dateResult = strFormat;
	dateResult=dateResult.replace("%Y",this.year.toString());
	dateResult=dateResult.replace("%y",this.year.toString().substr(2));
	dateResult=dateResult.replace("%d",this.date.toString());
	dateResult=dateResult.replace("%e",this.date.toString());
	dateResult=dateResult.replace("%m",this.month.toString());
	dateResult=dateResult.replace("%B",FarsiMonthNames[this.month].charRefToUnicode());
	dateResult=dateResult.replace("%b",FarsiMonthNamesShort[this.month].charRefToUnicode());
	dateResult=dateResult.replace("%A",FarsiDayNamesFull[this.day].charRefToUnicode());
	dateResult=dateObject.toLocaleFormat(dateResult);


	return dateResult;
}

function Months_C(Y, M) {
    switch (M) {
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12: return 31;
        case 2: if (Y % 4 == 0) return 29;
            else return 28;
        default: return 30;
    }
}


function DaysInMonth(Year, Month) {
    if (Month == 0) {
        Month = 12;
        Year = Year - 1;
    }
    else if (Month == 13) {
        Month = 1;
        Year = Year + 1;
    }
    else if (Month < 0 || Month>13)
        return -10000;

    if (Month >= 1 && Month <= 6)
        return 31;
    else if (Month == 12) {
        if ((((Year % 4) == 2) && (Year < 1374)) || (((Year % 4) == 3) && (Year >= 1374)))
            return 30;
        else
            return 29;
    }
    else return 30;
}

   let AYear4=dateObject.getYear();
   if (AYear4 < 1000)
      AYear4+=1900;
   let ADay=dateObject.getDate();
   let AMonth=dateObject.getMonth()+1; // Check [HINT]
    
    let Yd = ADay;
    let M = AMonth;
    for (let i = 1; i < M; i++)
        Yd = Yd + Months_C(AYear4, i);

    AYear4 -= 621;
    Yd -= (DaysInMonth(AYear4 - 1, 12) + DaysInMonth(AYear4 - 1, 11) + 20);

    if (DaysInMonth(AYear4 - 1, 12) == 30)
        Yd++;

    if (Yd > 0) {
        AMonth = 1;
        while (Yd > DaysInMonth(AMonth, AMonth)) {
            Yd -= DaysInMonth(AYear4, AMonth);
            AMonth++;
        }
        ADay = Yd;
    }
    else if (Yd <= 0) {
        AYear4--;
        AMonth = 12;
        while (-Yd >= DaysInMonth(AYear4, AMonth)) {
            Yd += DaysInMonth(AYear4, AMonth);
            AMonth--;
        }
        ADay = DaysInMonth(AYear4, AMonth) + Yd;
    }

    let d = dateObject.getDay();
    if (d==6) d=0;
    else d++;


    this.date = ADay;
    this.month = AMonth;
    this.year=AYear4;
    this.day = d;

}// end of class


