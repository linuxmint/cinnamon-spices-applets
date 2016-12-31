// Popup Menu Extension for Cinnamon Applet
// Contains a Popup Menu Item with an icon to the left, the text to the right and a command associated to the menu
// And a Popup SubMenu Item with an icon to the left, the text to the right
// Developed by Nicolas LLOBERA <nllobera@gmail.com>
// version: 2.0 (11-09-2013)
// License: GPLv3
// Copyright © 2013 Nicolas LLOBERA

const Lang = imports.lang;

const PopupMenu = imports.ui.popupMenu;

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

// Redefine a PopupImageMenuItem to get a colored image to the left side
function PopupImageLeftMenuItem() {
    this._init.apply(this, arguments);
}

PopupImageLeftMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (displayName, iconName, command, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        // useful to use application in the connect method
        this.command = command;
        
        this._icon = this._createIcon(iconName);
        this.addActor(this._icon);
        
        this.label = new St.Label({ text: displayName });
        this.addActor(this.label);
    },
    
    _createIcon: function(iconName) {
        // if the iconName is a path to an icon
        if (iconName[0] === '/') {
            var file = Gio.file_new_for_path(iconName);
            var iconFile = new Gio.FileIcon({ file: file });
            
            return new St.Icon({ gicon: iconFile, icon_size: 24 });
        }
        else // use a themed icon
            return new St.Icon({ icon_name: iconName, icon_size: 24, icon_type: St.IconType.FULLCOLOR });
    }
};


// Redefine a PopupSubMenuMenuItem to get a colored image to the left side
function PopupLeftImageSubMenuMenuItem() {
    this._init.apply(this, arguments);
}

PopupLeftImageSubMenuMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function (displayName, iconName, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        
        this.actor.add_style_class_name('popup-submenu-menu-item');
        
        this._icon = this._createIcon(iconName);
        this.addActor(this._icon);
        
        this.label = new St.Label({ text: displayName });
        this.addActor(this.label);
        
        if (this.actor.get_direction() == St.TextDirection.RTL) {
            this._triangle = new St.Label({ text: '\u25C2' });
        }
        else {
            this._triangle = new St.Label({ text: '\u25B8' });
        }

        this.addActor(this._triangle, { align: St.Align.END });
        
        this.menu = new PopupMenu.PopupSubMenu(this.actor, this._triangle);
        this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
    },
    
    _createIcon: function(iconName) {
        // if the iconName is a path to an icon
        if (iconName[0] === '/') {
            var file = Gio.file_new_for_path(iconName);
            var iconFile = new Gio.FileIcon({ file: file });
            
            return new St.Icon({ gicon: iconFile, icon_size: 24 });
        }
        else // use a themed icon
            return new St.Icon({ icon_name: iconName, icon_size: 24, icon_type: St.IconType.FULLCOLOR });
    }
};
