/*Copyright 2012 Mordant23
This file is a part of Panel Separator (Theme) applet.

This applet is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. This applet is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details. You should have received a copy of the GNU General Public License along
with this program. If not, see <http://www.gnu.org/licenses/>. */

const St = imports.gi.St;
const Lang = imports.lang;
const Gettext = imports.gettext.domain('cinnamon-applets');

const Applet = imports.ui.applet;
const _ = Gettext.gettext;

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {
        Applet.Applet.prototype._init.call(this, orientation);

        try {  
            this.set_applet_tooltip(_("Panel Separator"));
            this.createSeparator();
        }
        catch (e) {
            global.logError(e);
        }
     },
     
     createSeparator: function (){
        this.separator = new St.Bin ( { name: 'panelSeparator',
                                 style_class: 'panel-separator',
                                 reactive: true});
        this.actor.add(this.separator);
     },
};

function main(orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
