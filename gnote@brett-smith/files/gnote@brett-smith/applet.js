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

		this._setNormalIcons();

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        
		/* Search components. Pre-create these now, add them to menu later in loadNOtes() */
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

        /* Popup menu section */
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);
        
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
		global.log('GNote saved ' + uri);
		this._runRetry(Lang.bind(this, function() { 
			this._loadNotes()
		}));
	},

    onNoteAdded: function(source, no, uri) {
		global.log('GNote added ' + uri);
		this._runRetry(Lang.bind(this, function() { 
			this._loadNotes()
		}));
	},

    onNoteDeleted: function(source, no, uri, title) {
		global.log('GNote deleted ' + uri + ' "' + title + '"');
		this._runRetry(Lang.bind(this, function() { 
			this._loadNotes()
		}));
	},

	onBusAppeared: function() {
		try {
			global.log('GNote DBus appeared');
			let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null)
			this._gnote = new GnoteProxy(bus, dbus_name, dbus_path);

			// connect signals
			this._onNoteAddedId = this._gnote.connectSignal(
				'NodeAdded', Lang.bind(this, this.onNoteAdded));
			this._onNoteDeletedId = this._gnote.connectSignal(
				'NoteDeleted', Lang.bind(this, this.onNoteDeleted));
			this._onNoteSavedId = this._gnote.connectSignal(
					'NoteSaved', Lang.bind(this, this.onNoteSaved));
			
			this._setNormalIcons();
	        
			this._gnoteWasRunning = true;
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
		global.log('GNote DBus vanished');
		if (typeof this._onNoteAddedId !== "undefined") {
			this.mailnag.disconnectSignal(this._onNoteAddedId);
			this.mailnag.disconnectSignal(this._onNoteDeletedId);
			this.mailnag.disconnectSignal(this._onNoteSavedId);
			delete this._onNoteAddedId;
			delete this._onNoteDeletedId;
			delete this._onNoteSavedId;
			delete this._gnote;
		}

		this._loadNotes();

		if (this._gnoteWasRunning) {
			this.showError(_("Gnote stopped working!"));
		}
		else {
			this.showError(_("Gnote isn't running! Do you have it installed?"));
		}
		this._gnoteWasRunning = false;
	},
	
	//
	// Applet callbacks
	//

    on_applet_clicked: function() {
    	this.menu.toggle();
    	this._searchEntry.grab_key_focus();
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
			this._loadNotes()
		}));
    },
    
    //
    // Private Functions
    // 
    _setNormalIcons : function() {
        this.set_applet_tooltip(_("Gnote"));
        this.set_applet_icon_symbolic_path(this._metadata.path+"/icons/gnote-panel.svg");
    },

	_loadNotes: function() {

		global.log("Loading notes");

		if (typeof this._gnote !== "undefined") {
			let notes = this._fromDbusNoteList(this._gnote.ListAllNotesSync());
			if (notes)
				this._notes = notes;
        }
		else
			global.log("No GNote to load from");
		
		this.menu.removeAll();
		this.menuItems = {};
		

        // New Note
        let newNote = new PopupMenu.PopupIconMenuItem(_("New Note"), "add-note-symbolic", St.IconType.SYMBOLIC);
        newNote.connect('activate', Lang.bind(this, function() {
    		this._runRetry(Lang.bind(this, function() {
    			this._gnote.DisplayNoteSync(this._gnote.CreateNoteSync() + '');
    		}));
        }));

		global.log("Have " + this._notes.length + " notes");
		
		if(this._orientation == St.Side.BOTTOM) {
			/* Bottom */
	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	        if(this._notes.length > 0) {
				for each (var note in this._notes) {
		            this.menu.addMenuItem(this._makeMenuItem(note));
		        }
		        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			}
	        this.menu.addMenuItem(newNote);
	        /* TODO: Find way to make this actually be at the bottom */
	        //this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	        this.menu.addActor(this._searchArea);
		}
		else {
			/* Top, Left, Right */
	        this.menu.addActor(this._searchArea);
	        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	        this.menu.addMenuItem(newNote);
	        if(this._notes.length > 0) {
		        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
				for each (var note in this._notes) {
		            this.menu.addMenuItem(this._makeMenuItem(note));
		        }
			}
		}

		
	},
	
	_runRetry: function(cb, retries) {
		try {
			if(retries)
				global.log('Retrying ' + retries);
			cb();
		}
		catch(e) {
			if(!retries || retries < 5)
				Mainloop.timeout_add_seconds(1, Lang.bind(this, function (){
					/* TODO Investigate this a bit more. It seems we need a short delay, 
					 * as the RemoteControl interface appears a little later than the dbus name.
					 * There is probably a better way. 
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
		this.menu.removeAll();
		this.menu.addAction(_("Error: " + message));
        let retry = new PopupMenu.PopupIconMenuItem(_("Retry"), "refresh", St.IconType.SYMBOLIC);
        retry.connect('activate', Lang.bind(this, function() {
        	this.onBusAppeared();
        }));
		this.menu.addMenuItem(retry);
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
        	global.log('Showing note ' + note.id);
    		this._runRetry(Lang.bind(this, function() {
    			this._gnote.DisplayNoteSync(note.id + '');
            	global.log('Shown note ' + note.id);
    		}));
        }));
		this.menuItems[note.id] = ni;
		return ni;
    },

	_fromDbusNoteList: function(dbusList) {
		global.log("Converting DBus note URI list to objects");
		let notes = dbusList[0];
		let r = [];
		for each (var note in dbusList[0]) {
			let title = this._gnote.GetNoteTitleSync(note);
			r.push({id: note, title: title});
			global.log("    " + note+ " : " + title);
			if(r.length >= MAX_NOTES)
				break;
		}
		return r;
	},
};

//
// Main (entry point)
//

function main(metadata, orientation, panel_height, instance_id) {
    return new GnoteApplet(metadata, orientation, panel_height, instance_id);
}

