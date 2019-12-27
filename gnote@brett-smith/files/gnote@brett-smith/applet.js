/*
  Copyright © 2019 Brett Smith

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

//
// Constants
//

const MAX_NOTES = 15;
const UUID = "gnote@brett-smith";

//
// DBus Interface
//

const dbus_name = "org.gnome.Gnote";
const dbus_path = "/org/gnome/Gnote/RemoteControl";
const dbus_interface = "org.gnome.Gnote.RemoteControl";

const dbus_xml =
    "<node name=\"/org/gnome/Gnote/RemoteControl\"> \
    <interface name=\"org.gnome.Gnote.RemoteControl\"> \
    <method name=\"AddTagToNote\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"tag_name\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"CreateNamedNote\"> \
    <arg type=\"s\" name=\"linked_title\" direction=\"in\"/> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"CreateNote\"> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"DeleteNote\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"DisplayNote\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"DisplayNoteWithSearch\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"search\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"DisplaySearch\"> \
    </method> \
    <method name=\"DisplaySearchWithText\"> \
    <arg type=\"s\" name=\"search_text\" direction=\"in\"/> \
    </method> \
    <method name=\"FindNote\"> \
    <arg type=\"s\" name=\"linked_title\" direction=\"in\"/> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"FindStartHereNote\"> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetAllNotesWithTag\"> \
    <arg type=\"s\" name=\"tag_name\" direction=\"in\"/> \
    <arg type=\"as\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetNoteChangeDate\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"i\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetNoteCompleteXml\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetNoteContents\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetNoteContentsXml\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetNoteCreateDate\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"i\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetNoteTitle\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"GetTagsForNote\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"as\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"HideNote\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"ListAllNotes\"> \
    <arg type=\"as\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"NoteExists\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"RemoveTagFromNote\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"tag_name\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/>       \
    </method> \
    <method name=\"SearchNotes\"> \
    <arg type=\"s\" name=\"query\" direction=\"in\"/> \
    <arg type=\"b\" name=\"case_sensitive\" direction=\"in\"/> \
    <arg type=\"as\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <method name=\"SetNoteCompleteXml\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"xml_contents\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/>       \
    </method> \
    <method name=\"SetNoteContents\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"text_contents\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/>       \
    </method> \
    <method name=\"SetNoteContentsXml\"> \
    <arg type=\"s\" name=\"uri\" direction=\"in\"/> \
    <arg type=\"s\" name=\"xml_contents\" direction=\"in\"/> \
    <arg type=\"b\" name=\"ret\" direction=\"out\"/>       \
    </method> \
    <method name=\"Version\"> \
    <arg type=\"s\" name=\"ret\" direction=\"out\"/> \
    </method> \
    <signal name=\"NoteAdded\"> \
    <arg type=\"s\" name=\"uri\"/> \
    </signal> \
    <signal name=\"NoteDeleted\"> \
    <arg type=\"s\" name=\"uri\"/> \
    <arg type=\"s\" name=\"title\"/> \
    </signal> \
    <signal name=\"NoteSaved\"> \
    <arg type=\"s\" name=\"uri\"/> \
    </signal> \
    </interface> \
    </node>";

const GnoteProxy = Gio.DBusProxy.makeProxyWrapper(dbus_xml);

//
// I18n
//

const _ = function(str) {
    let translation = Gettext.gettext(str);
    if (translation !== str)
        return translation;
    return Gettext.dgettext(UUID, str);
}

//
// Applet Implementation
//

function GnoteApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

GnoteApplet.prototype = {
        __proto__: Applet.IconApplet.prototype,

        _init: function(metadata, orientation, panel_height, instance_id) {
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

            this._orientation = orientation;
            this._metadata = metadata;
            this._gnoteWasRunning = false;
            this._notes = [];
            this._searchArea = false;
            this._error = false;
            this._searchEntryText = false;

            this._setNormalIcons();

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            try {
                this.busWatcherId = Gio.bus_watch_name(
                        Gio.BusType.SESSION, dbus_name, Gio.BusNameOwnerFlags.NONE,
                        Lang.bind(this, this.onBusAppeared), Lang.bind(this, this.onBusVanished));
                this.onBusAppeared();
            }
            catch(e) {
                this._showError(e);
            }

        },

        //
        // DBus signal handlers
        //

        onNoteSaved: function(source, no, uri) {
            this._runRetry(Lang.bind(this, function() { 
                this._loadNotes()
            }));
        },

        onNoteAdded: function(source, no, uri) {
            this._runRetry(Lang.bind(this, function() { 
                this._loadNotes()
            }));
        },

        onNoteDeleted: function(source, no, uri, title) {
            this._runRetry(Lang.bind(this, function() { 
                this._loadNotes()
            }));
        },

        onBusAppeared: function() {
            try {
                this._connect();
                this._setNormalIcons();
                this._error = false;
                if(!this._gnoteWasRunning) {
                    this._runRetry(Lang.bind(this, function() { 
                        this._rebuildMenu();
                        this._gnoteWasRunning = true;
                    }));
                }
                else
                    this._runRetry(Lang.bind(this, function() { 
                        this._loadNotes();
                    }));			
            }
            catch(e) {
                global.logError(e);
                this._gnoteWasRunning = false;
            }
        },

        onBusVanished: function() {
            if (typeof this._onNoteAddedId !== "undefined") {
                this._gnote.disconnectSignal(this._onNoteAddedId);
                this._gnote.disconnectSignal(this._onNoteDeletedId);
                this._gnote.disconnectSignal(this._onNoteSavedId);
                delete this._onNoteAddedId;
                delete this._onNoteDeletedId;
                delete this._onNoteSavedId;
                delete this._gnote;
            }

            if (!this._gnoteWasRunning) {
                this._showError(_("Gnote isn't running! Do you have it installed?"));
            }
        },

        //
        // Applet callbacks
        //

        on_applet_clicked: function() {
            this.menu.toggle();
            if(this._searchEntryText)
                this._searchEntryText.grab_key_focus();
        },

        on_search_key_press: function(actor, event) {
            let symbol = event.get_key_symbol();
            if (symbol==Clutter.KEY_Return && this.menu.isOpen) {
                this._search();
                return true;
            }
        },

        on_orientation_changed: function (orientation) {
            this._orientation = orientation;
            this._runRetry(Lang.bind(this, function() { 
                this._rebuildMenu()
            }));
        },

        //
        // Private Functions
        // 
        _connect : function() {
            let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null)
            this._gnote = new GnoteProxy(bus, dbus_name, dbus_path);

            // connect signals
            this._onNoteAddedId = this._gnote.connectSignal(
                    'NodeAdded', Lang.bind(this, this.onNoteAdded));
            this._onNoteDeletedId = this._gnote.connectSignal(
                    'NoteDeleted', Lang.bind(this, this.onNoteDeleted));
            this._onNoteSavedId = this._gnote.connectSignal(
                    'NoteSaved', Lang.bind(this, this.onNoteSaved));
        },
        
        _setNormalIcons : function() {
            this.set_applet_tooltip(_("Gnote"));
            this.set_applet_icon_symbolic_name("gnote-panel");
        },

        _rebuildMenu: function() {
            if(this._searchArea) {
                this._searchArea.destroy();
                this._searchArea = false;
            }

            // Reset menu
            this.menu.removeAll();
            
            //
            if(this._error) {
                this.menu.addAction(_("Error: " + this._error));
                let retry = new PopupMenu.PopupIconMenuItem(_("Retry"), "refresh", St.IconType.SYMBOLIC);
                retry.connect('activate', Lang.bind(this, function() {
                    this._gnoteWasRunning = false;
                    this.onBusAppeared();
                }));
                this.menu.addMenuItem(retry);
                this._searchEntryText = false;
            }
            else {
                /* Popup menu section */
                this._contentSection = new PopupMenu.PopupMenuSection();
                this._loadNotes();
                
                // New Note
                let newNote = new PopupMenu.PopupIconMenuItem(_("New Note"), "add-note-symbolic", St.IconType.SYMBOLIC);
                newNote.connect('activate', Lang.bind(this, function() {
                    this._runRetry(Lang.bind(this, function() {
                        this._gnote.DisplayNoteSync(this._gnote.CreateNoteSync() + '');
                    }));
                }));
                
                this._searchArea = new St.BoxLayout({name: 'searchArea', style_class: 'popup-menu-item'});
                this._searchEntry = new St.Entry({ name: 'menu-search-entry',
                    hint_text: _("Type to search..."),
                    track_hover: true,
                    can_focus: true });
                this._searchEntry.set_secondary_icon( new St.Icon({ style_class: 'menu-search-entry-icon',
                    icon_name: 'edit-find',
                    icon_type: St.IconType.SYMBOLIC }));
                this._searchArea.add_actor(this._searchEntry);
                this._searchEntryText = this._searchEntry.clutter_text;
                this._searchEntryText.connect('key-press-event', Lang.bind(this, this.on_search_key_press));
    
                if(this._orientation == St.Side.BOTTOM) {
                    /* Bottom */
                    this.menu.addMenuItem(this._contentSection);
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    this.menu.addMenuItem(newNote);
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    this.menu.addActor(this._searchArea);
                }
                else {
                    /* Top, Left, Right */
                    this.menu.addActor(this._searchArea);
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    this.menu.addMenuItem(newNote);
                    this.menu.addMenuItem(this._contentSection);
                }
            }

        },

        _loadNotes: function() {
            this._contentSection.removeAll();
            this.menuItems = {};

            if (typeof this._gnote !== "undefined") {
                let notes = this._fromDbusNoteList(this._gnote.ListAllNotesSync());
                if (notes)
                    this._notes = notes;
            }

            if(this._notes.length > 0) {
                this._notes.forEach(Lang.bind(this, function(note) {
                    this._contentSection.addMenuItem(this._makeMenuItem(note));
                }));
            }            
        },

        _runRetry: function(cb, retries) {
            try {
                if(!this._gnote)
                    this._connect();
                cb();
            }
            catch(e) {
                if(!retries || retries < 5)
                    Mainloop.timeout_add_seconds(1, Lang.bind(this, function (){
                        /*
                         * TODO Investigate this a bit more. It seems we need a
                         * short delay, as the RemoteControl interface appears a
                         * little later than the dbus name. There is probably a
                         * better way.
                         */
                        this._runRetry(cb, retries ? retries + 1 : 1);
                        return false;
                    }));
                else {
                    this._showError(e);
                }
            }
        },

        _showError: function(message) {
            global.logError("GNote ERROR: " + message);
            if((''+message).indexOf('was not provided by') != -1)
                message = _('GNote DBus service not found. Is GNote installed?');
            this.set_applet_icon_symbolic_name("dialog-error-symbolic");
            this.set_applet_tooltip(_("Click to see error!"));
            this._error = message;
            this._rebuildMenu();
        },

        _search: function() {
            this.menu.toggle();
            this._runRetry(Lang.bind(this, function() {
                this._gnote.DisplaySearchWithTextSync(this._searchEntry.get_text());
            }));
        },

        _makeMenuItem: function(note)
        {
            let ni = new PopupMenu.PopupIconMenuItem('' + note.title, "note", St.IconType.SYMBOLIC);
            ni.connect('activate', Lang.bind(this, function() {
                this._runRetry(Lang.bind(this, function() {
                    this._gnote.DisplayNoteSync(note.id + '');
                }));
            }));
            this.menuItems[note.id] = ni;
            return ni;
        },

        _fromDbusNoteList: function(dbusList) {
            let notes = dbusList[0];
            let r = [];
            notes.forEach(Lang.bind(this, function(note) {
                if(r.length < MAX_NOTES) {
                    let title = this._gnote.GetNoteTitleSync(note);
                    r.push({id: note, title: title});
                }
            }));
            return r;
        },
};

//Main (entry point)
function main(metadata, orientation, panel_height, instance_id) {
    return new GnoteApplet(metadata, orientation, panel_height, instance_id);
}

