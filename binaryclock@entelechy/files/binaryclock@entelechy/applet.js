// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*
 * A replacement for the Cinnamon calendar applet
 * - Displays the time in binary in the panel
 * - Displays the time in decimal upon hovering the mouse
 *
 * Copyright 2012 Entelechy
 * With code adapted from the Gnome-Shell extension BinaryClock@zdyb.tk,
 *     by Aleksander Zdyb
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const Cairo = imports.cairo;
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

const LINE_WIDTH = 1;
const MARGIN = 2;

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

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);

            this._orientation = orientation;

            //Set up binary clock stuff
            this._displayTime = [-1, -1, -1];
            this._panelLabel = new St.Label({style_class: 'applet-label' });
            this.actor.add(this._panelLabel, { y_align: St.Align.MIDDLE, y_fill: false });
            this._binaryClock = new St.DrawingArea();
            this.bs = 6;
            this._binaryClock.width=6*this.bs+5*LINE_WIDTH + MARGIN*4;
            this._binaryClock.height=3*this.bs+2*LINE_WIDTH + MARGIN*2;
            this.actor.add(this._binaryClock, { y_align: St.Align.MIDDLE, y_fill: false });
            this._binaryClock.connect('repaint', Lang.bind(this, this._onBinaryClockRepaint));
 
            this._initContextMenu();
                                     
            this._calendarArea = new St.BoxLayout({name: 'calendarArea' });
            this.cal_menu.addActor(this._calendarArea);

            //Fill up the first column

            let vbox = new St.BoxLayout({vertical: true});
            this._calendarArea.add(vbox);

            //Date
            this._date = new St.Label();
            this._date.style_class = 'datemenu-date-label';
            vbox.add(this._date);
           
            this._eventSource = null;
            this._eventList = null;

            //Calendar
            this._calendar = new Calendar.Calendar(this._eventSource);
            vbox.add(this._calendar.actor);

            item = this.cal_menu.addSettingsAction(_("Date and Time Settings"), 'gnome-datetime-panel.desktop');
            if (item) {
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                separator.setColumnWidths(1);
                vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

                item.actor.can_focus = false;
                item.actor.reparent(vbox);
            }

            //Done with hbox for calendar and event list

            //Track changes to clock settings
            this._calendarSettings = new Gio.Settings({ schema: 'org.cinnamon.calendar' });
            this._calendarSettings.connect('changed', Lang.bind(this, this._updateClockAndDate));

            //https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            this._upClient.connect('notify-resume', Lang.bind(this, this._updateClockAndDate));

            //Start the clock
            this._updateClockAndDate();

        }

        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.cal_menu.toggle();
    },

    _updateClockAndDate: function() {
        let dateFormat = this._calendarSettings.get_string('date-format');
        let dateFormatFull = this._calendarSettings.get_string('date-format-full');
        let dateFormatPanel = '%a %b %e';//hardcoding for now; add to schema?
        let displayDate = new Date();

        //Now pull things for the binary part.
        this._displayTime = [displayDate.getHours(), displayDate.getMinutes(), displayDate.getSeconds()];
        this._panelLabel.set_text(displayDate.toLocaleFormat(dateFormatPanel));
        this._binaryClock.queue_repaint();

        this._date.set_text(displayDate.toLocaleFormat(dateFormatFull));
        this.set_applet_tooltip(_(displayDate.toLocaleFormat(dateFormat)));

        Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDate));
        return false;
    },

    _onBinaryClockRepaint: function(area) {
        let cr = area.get_context();
        let themeNode = this._binaryClock.get_theme_node();
        let [area_width, area_height] = area.get_surface_size();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.setLineWidth(LINE_WIDTH);
        cr.rectangle(MARGIN, MARGIN, area_width - MARGIN * 2, area_height - MARGIN * 2);
        cr.fill();

        cr.setOperator(Cairo.Operator.OVER);
        cr.setLineWidth(LINE_WIDTH);
        Clutter.cairo_set_source_color(cr, themeNode.get_foreground_color());
        cr.moveTo(2*MARGIN - LINE_WIDTH/2, MARGIN);
        cr.lineTo(2*MARGIN - LINE_WIDTH/2, area_height - MARGIN);
        cr.stroke();
        for (let p in this._displayTime) {
            for (let i=0; i<6; ++i) {
                cr.moveTo((i+1)*(this.bs + LINE_WIDTH/2) + i*(LINE_WIDTH/2) + MARGIN*2, MARGIN);
                cr.lineTo((i+1)*(this.bs + LINE_WIDTH/2) + i*(LINE_WIDTH/2) + MARGIN*2, area_height - MARGIN);
                cr.stroke();
                if ((this._displayTime[p] & (1 << (5-i)))) {
                    cr.rectangle(LINE_WIDTH + (this.bs + LINE_WIDTH)*i + MARGIN*2, LINE_WIDTH + (this.bs + LINE_WIDTH)*p + MARGIN, this.bs-2*LINE_WIDTH, this.bs-LINE_WIDTH);
                    cr.fill();
                }
            }
        }
    },

    _initContextMenu: function () {
        if (this._calendarArea) this._calendarArea.unparent();
        if (this.cal_menu) this.menuManager.removeMenu(this.cal_menu);
        
        this.cal_menu = new Applet.AppletPopupMenu(this, this._orientation);
        this.menuManager.addMenu(this.cal_menu);
        
        if (this._calendarArea){
            this.cal_menu.addActor(this._calendarArea);
            this._calendarArea.show_all();
        }
        
        //Whenever the menu is opened, select today
        this.cal_menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
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
                //No need to update this._eventList as ::selected-date-changed
                //signal will fire
            }
        }));
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    } 
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
