const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const CheckBox = imports.ui.checkBox;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;

const FileDialog = imports.misc.fileDialog;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Util = imports.misc.util;

const STICKY_DRAG_INTERVAL = 25;
const DESTROY_TIME = 0.5;
const PADDING = 10;
const EDGE_WIDTH = 10;
const MIN_HEIGHT = 75;
const MIN_WIDTH = 125;

const THEMES = {
    "green":    "Green",
    "aqua":     "Aqua",
    "blue":     "Blue",
    "brown":    "Brown",
    "orange":   "Orange",
    "pink":     "Pink",
    "purple":   "Purple",
    "red":      "Red",
    "sand":     "Sand",
    "teal":     "Teal",
    "yellow":   "Yellow"
}


let applet, noteBox;


function focusText(actor) {
    let currentMode = global.stage_input_mode;
    if ( currentMode == Cinnamon.StageInputMode.FOCUSED && actor.has_key_focus() ) return;
    // if ( !this.previousMode ) this.previousMode = currentMode;
    if ( currentMode != Cinnamon.StageInputMode.FOCUSED ) {
        global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
    }

    actor.grab_key_focus();
    if ( settings.raisedState ) {
        global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
    }
}


let settings;
function SettingsManager(uuid, instanceId) {
    this._init(uuid, instanceId);
}

SettingsManager.prototype = {
    _init: function(uuid, instanceId) {
        this.settings = new Settings.AppletSettings(this, uuid, instanceId);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "storedNotes", "storedNotes");
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "raisedState", "raisedState");
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "hideState", "hideState");
        this.settings.bindProperty(Settings.BindingDirection.IN, "theme", "theme");
        this.settings.bindProperty(Settings.BindingDirection.IN, "height", "height");
        this.settings.bindProperty(Settings.BindingDirection.IN, "width", "width");
        this.settings.bindProperty(Settings.BindingDirection.IN, "startState", "startState");
        this.settings.bindProperty(Settings.BindingDirection.IN, "boxShadow", "boxShadow", function() { this.emit("box-shadow-changed"); });
    },

    saveNotes:function(notes) {
        this.storedNotes = notes;
    }
}
Signals.addSignalMethods(SettingsManager.prototype);


function Menu(applet, orientation) {
    this._init(applet, orientation);
}

Menu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(applet, orientation) {
        PopupMenu.PopupMenu.prototype._init.call(this, applet.actor, 0.0, orientation, 0);
        this.actor.hide();
        this.applet = applet;
        applet.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
    },

    _connectItemSignals: function(menuItem) {
        menuItem._activeChangeId = menuItem.connect('active-changed', Lang.bind(this, function (menuItem, active) {
            if (active && this._activeMenuItem != menuItem) {
                if (this._activeMenuItem)
                    this._activeMenuItem.setActive(false);
                this._activeMenuItem = menuItem;
                this.emit('active-changed', menuItem);
            } else if (!active && this._activeMenuItem == menuItem) {
                this._activeMenuItem = null;
                this.emit('active-changed', null);
            }
        }));
        menuItem._sensitiveChangeId = menuItem.connect('sensitive-changed', Lang.bind(this, function(menuItem, sensitive) {
            if (!sensitive && this._activeMenuItem == menuItem) {
                if (!this.actor.navigate_focus(menuItem.actor,
                                               Gtk.DirectionType.TAB_FORWARD,
                                               true))
                    this.actor.grab_key_focus();
            } else if (sensitive && this._activeMenuItem == null) {
                if (global.stage.get_key_focus() == this.actor)
                    menuItem.actor.grab_key_focus();
            }
        }));
        menuItem.connect('destroy', Lang.bind(this, function(emitter) {
            menuItem.disconnect(menuItem._activeChangeId);
            menuItem.disconnect(menuItem._sensitiveChangeId);
            if (menuItem.menu) {
                menuItem.menu.disconnect(menuItem._subMenuActivateId);
                menuItem.menu.disconnect(menuItem._subMenuActiveChangeId);
                this.disconnect(menuItem._closingId);
            }
            if (menuItem == this._activeMenuItem)
                this._activeMenuItem = null;
            this.length--;
        }));
    },

    _onOrientationChanged: function(a, orientation) {
        this.setArrowSide(orientation);
    }
}


function NoteBase(info) {
    this._init(info);
}

NoteBase.prototype = {
    _init: function(info) {
        this._dragging = false;
        this._dragOffset = [0, 0];
        this.hasBottom = false;
        this.hasSide = false;

        if ( info && info.theme ) this.theme = info.theme;
        else {
            if ( settings.theme == "random" ) {
                let keys = Object.keys(THEMES);
                this.theme = keys[Math.floor(Math.random()*keys.length)];
            }
            else this.theme = settings.theme;
        }

        let height = ( info && info.height ) ? info.height : settings.height;
        let width = ( info && info.width ) ? info.width : settings.width;

        this.actor = new St.BoxLayout({ vertical: true, reactive: true, track_hover: true, name: "NoteBox", style_class: this.theme, height: height, width: width });
        this.actor._delegate = this;
        if ( settings.boxShadow ) this.actor.add_style_pseudo_class("boxshadow");
        settings.connect("box-shadow-changed", Lang.bind(this, function() {
            if ( settings.boxShadow ) this.actor.add_style_pseudo_class("boxshadow");
            else this.actor.remove_style_pseudo_class("boxshadow");
        }));

        this.titleBox = new St.BoxLayout({ style_class: "sticky-titleBox" });
        this.actor.add_actor(this.titleBox);

        this.titleBin = new St.Bin({ x_align: St.Align.START });
        this.titleBox.add(this.titleBin, { expand: true });

        if ( info && info.title ) {
            this.title = info.title;
            this.titleBin.add_actor(new St.Label({ text: this.title, style_class: "sticky-title" }));
        }

        this.actor.connect("motion-event", Lang.bind(this, this._onMotionEvent));
        this.actor.connect("leave-event", Lang.bind(this, this._onLeave));
        this.actor.connect("button-release-event", Lang.bind(this, this.onButtonRelease));
        this.actor.connect("button-press-event", Lang.bind(this, this.checkResize));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.LEFT, 0);
        this.menuManager.addMenu(this.menu);
        Main.uiGroup.add_actor(this.menu.actor);
        this.menu.actor.hide();

        this.buildMenu();
    },

    buildMenu: function() {
        this.contentMenuSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.contentMenuSection);

        let themeSection = new PopupMenu.PopupSubMenuMenuItem(_("Change theme"));
        this.contentMenuSection.addMenuItem(themeSection);

        for ( let codeName in THEMES ) {
            let themeItem = new PopupMenu.PopupMenuItem(THEMES[codeName]);
            themeSection.menu.addMenuItem(themeItem);
            themeItem.connect("activate", Lang.bind(this, this.setTheme, codeName));
        }

        this.titleMenuItem = new PopupMenu.PopupMenuItem(this.title ? _("Edit title") : _("Add title"));
        this.contentMenuSection.addMenuItem(this.titleMenuItem);
        this.titleMenuItem.connect("activate", Lang.bind(this, this.editTitle));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let copy = new PopupMenu.PopupMenuItem(_("Copy"));
        this.menu.addMenuItem(copy);
        copy.connect("activate", Lang.bind(this, this.copy));

        let paste = new PopupMenu.PopupMenuItem(_("Paste"));
        this.menu.addMenuItem(paste);
        paste.connect("activate", Lang.bind(this, this.paste));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let about = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
        about.connect("activate", Lang.bind(applet, applet.openAbout));
        this.menu.addMenuItem(about);

        let configure = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
        configure.connect("activate", Lang.bind(this, function() {
            Util.spawnCommandLine("cinnamon-settings applets " + applet.metadata.uuid + " " + applet.instanceId);
        }));
        this.menu.addMenuItem(configure);

        let remove = new PopupMenu.PopupIconMenuItem(_("Remove this note"), "edit-delete", St.IconType.SYMBOLIC);
        remove.connect("activate", Lang.bind(this, function() {
            this.emit("destroy", this);
        }));
        this.menu.addMenuItem(remove);
    },

    setTheme: function(a, b, c, codeName) {
        this.theme = codeName;
        this.actor.style_class = codeName;
        this.emit("changed");
    },

    checkResize: function(actor, event) {
        // start resize if the mouse is in the right place
        if ( this.hasBottom || this.hasSide ) {
            this.isResizing = true;
            Clutter.grab_pointer(this.actor);
            global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
            if ( !this.eventId )
                this.eventId = this.actor.connect("event", Lang.bind(this, this.handleResizeEvent));
        }
        else this.onButtonPress(actor, event);
    },

    handleResizeEvent: function(actor, event) {
        // update size now to give visual feedback
        if ( event.type() == Clutter.EventType.MOTION ) {
            let [x, y] = event.get_coords();
            let [actorX, actorY] = this.actor.get_transformed_position();

            // determine new dimensions
            let newHeight, newWdith;
            if ( this.hasBottom ) {
                newHeight = Math.round(y - actorY);
                this.actor.height = (newHeight < MIN_HEIGHT) ? MIN_HEIGHT : newHeight;
            }
            if ( this.hasSide ) {
                newWdith = Math.round(x - actorX);
                this.actor.width = (newWdith < MIN_WIDTH) ? MIN_WIDTH : newWdith;
            }

            return true;
        }

        // end resize on button release
        if ( event.type() == Clutter.EventType.BUTTON_RELEASE ) {
            this.isResizing = false;
            Clutter.ungrab_pointer();
            global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
            this.actor.disconnect(this.eventId);
            this.eventId = null;
            if ( !this.actor.has_pointer ) global.unset_cursor();

            this.triggerUpdate();

            return true;
        }

        return false;
    },

    _onDragBegin: function() {
        if ( !this.previousMode ) this.previousMode = global.stage_input_mode;
        global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
    },

    _onDragEnd: function() {
        Main.popModal(this.actor, global.get_current_time());
        if ( this.previousMode ) {
            global.set_stage_input_mode(this.previousMode);
            this.previousMode = null;
        }
        this.trackMouse();
    },

    _onMotionEvent: function(actor, event) {
        if ( this.isResizing ) return;
        this.hasBottom = false;
        this.hasSide = false;
        let [x, y] = event.get_coords();
        let rightEdge = this.actor.x + this.actor.width;
        let bottomEdge = this.actor.y + this.actor.height;
        if ( x < rightEdge && rightEdge - x < EDGE_WIDTH ) this.hasSide = true;
        if ( y < bottomEdge && bottomEdge - y < EDGE_WIDTH ) this.hasBottom = true;

        this.draggable.inhibit = true;
        if ( this.hasBottom && this.hasSide ) global.set_cursor(Cinnamon.Cursor.RESIZE_BOTTOM_RIGHT);
        else if ( this.hasSide ) global.set_cursor(Cinnamon.Cursor.RESIZE_RIGHT);
        else if ( this.hasBottom ) global.set_cursor(Cinnamon.Cursor.RESIZE_BOTTOM);
        else if ( this.canSelect(x, y) ) global.set_cursor(Cinnamon.Cursor.TEXT);
        else {
            global.unset_cursor();
            this.draggable.inhibit = false;
        }
    },

    canSelect: function(x, y) { return false },

    _onLeave: function() {
        if ( !this.isResizing ) global.unset_cursor();
    },

    toggleMenu: function() {
        this.menu.toggle();

        //make sure menu is positioned correctly
        let rightEdge;
        for ( let i = 0; i < Main.layoutManager.monitors.length; i++ ) {
            let monitor = Main.layoutManager.monitors[i];

            if ( monitor.x <= this.actor.x &&
                 monitor.y <= this.actor.y &&
                 monitor.x + monitor.width > this.actor.x &&
                 monitor.y + monitor.height > this.actor.y ) {

                rightEdge = monitor.x + monitor.width;
                break;
            }
        }

        if ( this.actor.x + this.actor.width + this.menu.actor.width > rightEdge )
            this.menu.setArrowSide(St.Side.RIGHT);
        else this.menu.setArrowSide(St.Side.LEFT);
    },

    destroy: function(){
        this.onNoteRemoved();
        Tweener.addTween(this.actor, {
            opacity: 0,
            transition: "linear",
            time: DESTROY_TIME,
            onComplete: Lang.bind(this, function() {
                let parent = this.actor.get_parent();
                this.parent.remove_child(this.actor);
                this.actor.destroy();
            })
        });
        this.menu.destroy();

        this.menu = null;
        this.menuManager = null;
    },

    // implemented by individual note types
    onNoteRemoved: function() { },

    trackMouse: function() {
        if( !Main.layoutManager.isTrackingChrome(this.actor) ) {
            Main.layoutManager.addChrome(this.actor, { doNotAdd: true });
            this._isTracked = true;
        }
    },

    untrackMouse: function() {
        if( Main.layoutManager.isTrackingChrome(this.actor) ) {
            Main.layoutManager.untrackChrome(this.actor);
            this._isTracked = false;
        }
    },

    editTitle: function() {
        this.titleBin.remove_all_children();

        let text;
        if ( this.title ) text = this.title;
        else text = _("Title");
        this.titleEntry = new St.Entry({ text: text, style_class: "sticky-title" });
        this.titleBin.add_actor(this.titleEntry);
        if ( !this.previousMode ) this.previousMode = global.stage_input_mode;
        global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
        this.titleEntry.grab_key_focus();
        this.titleEntry.clutter_text.set_selection(0, -1);

        global.stage.connect("button-press-event", Lang.bind(this, function() { this.uneditTitle(true); }));
        this.titleEntry.clutter_text.connect("key-press-event", Lang.bind(this, function(actor, event) {
            switch ( event.get_key_symbol() ) {
                case Clutter.KEY_Escape:
                    this.uneditTitle(false);
                    return true;
                case Clutter.Return:
                case Clutter.KP_Enter:
                    this.uneditTitle(true);
                    this.emit("changed");
                    return true;
                default:
                    return false;
            }
        }));
    },

    uneditTitle: function(update) {
        if ( update ) {
            if ( this.titleEntry.text == "" ) this.title = undefined;
            else this.title = this.titleEntry.text;
        }

        this.titleBin.remove_actor(this.titleEntry);

        if ( this.title ) {
            this.titleBin.add_actor(new St.Label({ text: this.title, style_class: "sticky-title" }));
            this.titleMenuItem.label.text = "Edit title";
        }
        else this.titleMenuItem.label.text = "Add title";
    },

    triggerUpdate: function() {
        if ( !this.updateId ) Mainloop.idle_add(Lang.bind(this, function() {
            this.emit("changed");
            this.updateId = undefined;
        }))
    }
}
Signals.addSignalMethods(NoteBase.prototype);


function Note(info) {
    this._init(info);
}

Note.prototype = {
    __proto__: NoteBase.prototype,

    _init: function(info) {
        NoteBase.prototype._init.call(this, info);

        this.switching = false;

        this.scrollBox = new St.ScrollView();
        this.actor.add_actor(this.scrollBox);
        this.scrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        this.textBin = new St.BoxLayout();
        this.scrollBox.add_actor(this.textBin);

        this.textWrapper = new Cinnamon.GenericContainer();
        this.textBin.add_actor(this.textWrapper);

        this.textBox = new St.Entry({  });
        this.textWrapper.add_actor(this.textBox);
        if ( info ) this.textBox.text = info.text;

        this.text = this.textBox.clutter_text;
        this.text.set_single_line_mode(false);
        this.text.set_activatable(false);
        this.text.ellipsize = Pango.EllipsizeMode.NONE;
        this.text.line_wrap = true;
        this.text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.text.set_selectable(true);

        this.textWrapper.connect("allocate", Lang.bind(this, this.allocate));
        this.textWrapper.connect("get-preferred-height", Lang.bind(this, this.getPreferedHeight));
        this.textWrapper.connect("get-preferred-width", Lang.bind(this, this.getPreferedWidth));
        this.text.connect("button-release-event", Lang.bind(this, this.onButtonRelease));
        this.text.connect("button-press-event", Lang.bind(this, this.onButtonPress));
        this.text.connect("text-changed", Lang.bind(this, function() { this.emit("changed"); }));
        this.text.connect("cursor-event", Lang.bind(this, this.handleScrollPosition));
        this.text.connect("key-focus-in", Lang.bind(this, this.onTextFocused));

        let padding = new St.Bin({ reactive: true });
        this.actor.add(padding, { y_expand: true, y_fill: true, x_expand: true, x_fill: true });

        let switchTypeMenuItem = new PopupMenu.PopupMenuItem(_("Switch to check list"));
        this.contentMenuSection.addMenuItem(switchTypeMenuItem);
        switchTypeMenuItem.connect("activate", Lang.bind(this, this.switchType));
    },

    allocate: function(actor, box, flags) {
        let childBox = new Clutter.ActorBox();

        childBox.x1 = box.x1;
        childBox.x2 = box.x2;
        childBox.y1 = box.y1;
        childBox.y2 = box.y2;
        this.textBox.allocate(childBox, flags);
    },

    getPreferedHeight: function(actor, forWidth, alloc) {
        let [minWidth, natWidth] = actor.get_preferred_width(0);
        let [minHeight, natHeight] = this.text.get_preferred_height(natWidth);

        alloc.min_size = minHeight;
        alloc.natural_size = natHeight;
    },

    getPreferedWidth: function(actor, forHeight, alloc) {
        let sbWidth = this.scrollBox.vscroll.width;
        let sNode = this.actor.get_theme_node();
        let width = sNode.adjust_for_width(this.actor.width);
        alloc.min_size = width - sbWidth;
        alloc.natural_size = width - sbWidth;
    },

    onNoteRemoved: function() {
        this.unfocusText();
    },

    onButtonRelease: function(actor, event) {
        if ( event.get_button() == 3 ) return true;

        if ( this.pointerGrabbed ) {
            global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
            Clutter.ungrab_pointer();
            this.pointerGrabbed = false;
            return false;
        }

        let [x, y] = event.get_coords();
        if ( event.get_source() != this.text && this.canSelect(x, y) ) {
            this.text.cursor_position = this.text.selection_bound = this.text.text.length;
            focusText(this.text);
        }

        return false;
    },

    onButtonPress: function(actor, event) {
        if ( event.get_button() == 3 ) {
            this.toggleMenu();
            return true;
        }

        if ( this.menu.isOpen ) this.menu.close();

        if ( actor == this.text ) {
            if ( !this.previousMode ) this.previousMode = global.stage_input_mode;
            global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
            Clutter.grab_pointer(this.text);
            this.pointerGrabbed = true;
        }

        return false;
    },

    canSelect: function(x, y) {
        if ( y >= this.scrollBox.get_transformed_position()[1] &&
             x > this.text.get_transformed_position()[0] &&
             x < (this.text.get_transformed_position()[0] + this.text.width) ) return true;

        return false;
    },

    handleScrollPosition: function(text, geometry) {
        let textHeight = this.textBox.height;
        let scrollHeight = this.scrollBox.height;

        if ( textHeight <= scrollHeight ) return;

        let adjustment = this.textBin.vadjustment;
        let cursorY = geometry.y;
        let startY = adjustment.value;
        let endY = scrollHeight + startY;

        if ( cursorY < startY + geometry.height*2 ) {
            let desiredPosition = cursorY - geometry.height*2;
            adjustment.set_value(( desiredPosition > 0 ? desiredPosition : 0 ));
        }
        else if ( cursorY > endY - geometry.height*3 ) {
            let desiredPosition = cursorY + geometry.height*3;
            adjustment.set_value(( desiredPosition < textHeight ? desiredPosition : textHeight ) - scrollHeight);
        }
    },

    onTextFocused: function() {
        if ( !this.unfocusId ) this.unfocusId = this.text.connect("key-focus-out", Lang.bind(this, this.unfocusText));
        this.actor.add_style_pseudo_class("focus");
    },

    unfocusText: function() {
        if ( this.unfocusId ) {
            this.text.disconnect(this.unfocusId);
            this.unfocusId = null;
        }
        if ( global.stage_input_mode == Cinnamon.StageInputMode.FOCUSED ) {
            if ( this.previousMode ) {
                global.set_stage_input_mode(this.previousMode);
                this.previousMode = null;
            }
            else global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
        }
        this.previousMode = null;
        this.actor.remove_style_pseudo_class("focus");
    },

    getInfo: function() {
        let info = { x: this.actor.x, y: this.actor.y, height: this.actor.height, width: this.actor.width, theme: this.theme };
        if ( this.title ) info.title = this.title;

        if ( this.switching ) {
            info.type = "checklist";
            info.items = [];
            let lines = this.textBox.text.split("\n");
            for ( let line of lines ) {
                if ( line == "" ) continue;
                let item = {};
                if ( line[0] == "+" ) {
                    item.completed = true;
                    item.text = line.slice(1);
                }
                else {
                    item.completed = false;
                    if ( ["-", "*"].indexOf(line[0]) != -1 ) {
                        line = line.slice(1);
                    }
                    item.text = line;
                }
                info.items.push(item);
            }
        }
        else {
            info.type = "note";
            info.text = this.textBox.text;
        }

        return info;
    },

    copy: function() {
        let cursor = this.text.get_cursor_position();
        let selection = this.text.get_selection_bound();
        let text;
        if ( cursor == selection ) text = this.text.get_text();
        else text = this.text.get_selection();
        St.Clipboard.get_default().set_text(text);
    },

    paste: function() {
        St.Clipboard.get_default().get_text(Lang.bind(this, function(cb, text) {
            let cursor = this.text.get_cursor_position();
            let selection = this.text.get_selection_bound();
            if ( cursor != selection ) this.text.delete_selection();
            this.text.insert_text(text, this.text.get_cursor_position());
        }));
    },

    switchType: function() {
        this.switching = true;
        this.emit("changed", true);
    }
}


function CheckList(info) {
    this._init(info);
}

CheckList.prototype = {
    __proto__: NoteBase.prototype,

    _init: function(info) {
        NoteBase.prototype._init.call(this, info);

        this.switching = false;
        this.items = [];

        this.scrollBox = new St.ScrollView();
        this.actor.add_actor(this.scrollBox);

        this.itemBox = new St.BoxLayout({ vertical: true, style_class: "sticky-checkList-itemBox" });
        this.scrollBox.add_actor(this.itemBox);

        if ( info && info.items && info.items.length > 0 ) {
            for ( let item of info.items ) {
                this.addItem(item);
            }
        }
        else {
            this.newItem();
        }

        let switchTypeMenuItem = new PopupMenu.PopupMenuItem(_("Switch to regular note"));
        this.contentMenuSection.addMenuItem(switchTypeMenuItem);
        switchTypeMenuItem.connect("activate", Lang.bind(this, this.switchType));

        let removeCompleteMenuItem = new PopupMenu.PopupMenuItem(_("Remove completed items"));
        this.contentMenuSection.addMenuItem(removeCompleteMenuItem);
        removeCompleteMenuItem.connect("activate", Lang.bind(this, this.removeComplete));
    },

    addItem: function(itemInfo, insertAfter) {
        let item = new CheckListItem(itemInfo);

        this.itemBox.add_actor(item.actor);
        if ( insertAfter ) {
            item.actor.raise(insertAfter.actor);
            this.items.splice(this.items.indexOf(insertAfter)+1, 0, item);
        }
        else this.items.push(item);

        item.clutterText.connect("key-press-event", Lang.bind(this, this.handleKeyPress));
        item.clutterText.connect("button-press-event", Lang.bind(this, this.onButtonPress));
        item.clutterText.connect("button-release-event", Lang.bind(this, this.onButtonRelease));
        item.checkBox.actor.connect("clicked", Lang.bind(this, function() { this.emit("changed"); }));
        item.clutterText.connect("key-focus-in", Lang.bind(this, this.onFocusIn));

        this.emit("changed");
        return item;
    },

    newItem: function(insertAfter, text) {
        let info;
        if ( text ) info = { text: text, completed: false };
        let item = this.addItem(info, insertAfter);

        return item;
    },

    removeItem: function(item) {
        if ( !item.actor ) return;

        let text = item.clutterText;
        if ( text.focusId ) text.disconnect(text.focusId);
        item.actor.destroy();
        this.items.splice(this.items.indexOf(item), 1);
    },

    removeComplete: function() {
        for ( let i = 0; i < this.items.length; ) {
            if ( this.items[i].completed ) this.removeItem(this.items[i]);
            else i++;
        }

        if ( this.items.length == 0 ) this.newItem();
        this.emit("changed");
    },

    getInfo: function() {
        let info = { x: this.actor.x, y: this.actor.y, height: this.actor.height, width: this.actor.width, theme: this.theme };
        if ( this.title ) info.title = this.title;

        if ( this.switching ) {
            info.type = "note";
            let text = "";
            for ( let item of this.items ) {
                if ( item.text == "" ) continue;
                text += (item.completed) ? "+" : "-";
                text += item.text + "\n";
            }
            info.text = text;
        }
        else {
            info.type = "checklist";
            info.items = [];
            for ( let item of this.items ) {
                if ( item.text != "" ) info.items.push({ completed: item.completed, text: item.text });
            }
        }

        return info;
    },

    onButtonRelease: function(actor, event) {
        if ( event.get_button() == 3 ) return true;

        // clean up from onButtonPress
        if ( this.pointerGrabbed ) {
            global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
            Clutter.ungrab_pointer();
            this.pointerGrabbed = false;
            return false;
        }

        // make sure the text actually gets focus
        for ( let item of this.items ) {
            if ( event.get_source() == item.clutterText ) {
                focusText(item.clutterText);
                return false;
            }
        }

        // Dont do anything if we click on the title
        let [eventX, eventY] = event.get_coords();
        if ( eventY < this.itemBox.get_transformed_position()[1] ) return false;

        // if we miss all the clutter text, it still makes more sense to grab the nearest one
        for ( let item of this.items ) {
            let [itemX, itemY] = item.entry.get_transformed_position();
            if ( eventY < (itemY + item.entry.height) ) {
                // we don't want to select if the pointer is left of the text
                if ( eventX >= itemX ) focusText(item.clutterText);
                return true;
            }
        }

        // if we are below the last entry, create a new one (or focus the last one if it is empty)
        let lastItem = this.items[this.items.length-1];
        if ( lastItem.entry.text == "" ) {
            focusText(lastItem.clutterText);
        }
        else {
            let newItem = this.newItem();
            focusText(newItem.clutterText);
        }

        return true;
    },

    onButtonPress: function(actor, event) {
        if ( event.get_button() == 3 ) {
            this.toggleMenu();
            return true;
        }

        if ( this.menu.isOpen ) this.menu.close();

        if ( actor instanceof Clutter.Text ) {
            if ( !this.previousMode ) this.previousMode = global.stage_input_mode;
            global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);
            Clutter.grab_pointer(actor);
            this.pointerGrabbed = true;
        }

        return false;
    },

    canSelect: function(x, y) {
        let firstItem = this.items[0];
        if ( y < this.scrollBox.get_transformed_position()[1] ||
             x > this.itemBox.get_transformed_position()[0] + this.itemBox.width ) return false;

        for ( let item of this.items ) {
            let [itemX, itemY] = item.entry.get_transformed_position();
            if ( y < (itemY + item.entry.height) && x >= itemX ) return true;
        }

        let lastItem = this.items[this.items.length-1];
        if ( y > (lastItem.entry.get_transformed_position()[1] + lastItem.entry.height) ) return true;

        return false;
    },

    handleKeyPress: function(actor, event) {
        let item = actor._delegate;
        let index = this.items.indexOf(item);
        let keyCode = event.get_key_symbol();
        let position = item.clutterText.cursor_position;
        let blockEvent = false;
        let changed = false;
        switch ( keyCode ) {
            case Clutter.Return:
            case Clutter.KP_Enter:
                if ( item.entry.text.length == 0 ) return true;
                let newItemText = "";
                if ( position != -1 ) {
                    newItemText = String(item.entry.text.slice(position));
                    item.entry.text = item.entry.text.slice(0, position);
                }
                let newItem = this.newItem(item, newItemText);
                focusText(newItem.clutterText);
                newItem.clutterText.position = newItem.clutterText.selection_bound = 0;

                changed = true;
                blockEvent = true;
                break;
            case Clutter.BackSpace:
                if ( index != 0 && ( position == item.clutterText.selection_bound ) &&
                     (position == 0 || (position == -1 && item.text.length == 0)) ) {
                    let prevItem = this.items[index-1];
                    let text = item.text;
                    let pos = (text.length == 0) ? -1 : prevItem.entry.text.length;
                    prevItem.entry.text += text;
                    this.removeItem(item);
                    focusText(prevItem.clutterText);
                    prevItem.clutterText.position = prevItem.clutterText.selection_bound = pos;

                    blockEvent = true;
                }
                changed = true;
                break;
            case Clutter.Delete:
                if ( index < this.items.length - 1 && ( position == item.clutterText.selection_bound ) &&
                     (position == -1) ) {
                    let newPos = item.entry.text.length;
                    let nextItem = this.items[index+1];
                    let text = nextItem.text;
                    this.removeItem(nextItem);
                    item.entry.text += text;
                    item.clutterText.position = item.clutterText.selection_bound = newPos;

                    blockEvent = true;
                }
                changed = true;
                break;
            case Clutter.Up:
                if ( index > 0 ) {
                    focusText(this.items[index-1].clutterText);
                    this.items[index-1].clutterText.position = this.items[index-1].clutterText.selection_bound = position;

                    blockEvent = true;
                }
                break;
            case Clutter.Down:
                if ( index < this.items.length - 1 ) {
                    focusText(this.items[index+1].clutterText);
                    this.items[index+1].clutterText.position = this.items[index+1].clutterText.selection_bound = position;

                    blockEvent = true;
                }
                break;
            case Clutter.Left:
                if ( position == 0 && index > 0 ) {
                    focusText(this.items[index-1].clutterText);
                    this.items[index-1].clutterText.position = this.items[index-1].clutterText.selection_bound = -1;

                    blockEvent = true;
                }
                break;
            case Clutter.Right:
                if ( position == -1 && index < this.items.length - 1 ) {
                    focusText(this.items[index+1].clutterText);
                    this.items[index+1].clutterText.position = this.items[index+1].clutterText.selection_bound = 0;

                    blockEvent = true;
                }
                break;
            default:
                changed = true;
                break;
        }

        if ( !this.idleId )
            this.idleId = Mainloop.idle_add(Lang.bind(this, this.updateScrollPosition));
        if ( changed ) this.triggerUpdate();
        return blockEvent;
    },

    onFocusIn: function(actor) {
        if ( !this.idleId )
            this.idleId = Mainloop.idle_add(Lang.bind(this, this.updateScrollPosition));
        if ( !actor.focusId ) actor.focusId = actor.connect("key-focus-out", Lang.bind(this, this.onFocusOut));
    },

    onFocusOut: function(actor) {
        if ( actor.text.length == 0 && this.items.length > 1 ) this.removeItem(actor._delegate);
        actor.disconnect(actor.focusId);
        actor.focusId = null;
    },

    updateScrollPosition: function() {
        this.idleId = null;

        let focusedItem;
        for ( let item of this.items ) {
            if ( item.clutterText.has_key_focus() ) {
                focusedItem = item;
                break;
            }
        }
        if ( !focusedItem ) return;

        let scrollHeight = this.scrollBox.allocation.get_height();
        let adjustment = this.itemBox.vadjustment;
        let actorStart = focusedItem.actor.allocation.y1;
        let actorEnd = focusedItem.actor.allocation.y2;

        if ( actorStart < adjustment.value ) adjustment.set_value(actorStart);
        else if ( actorEnd > adjustment.value + scrollHeight ) adjustment.set_value(actorEnd - scrollHeight);
    },

    copy: function() {
        let text = "";
        for ( let item of this.items ) {
            let selectedText = item.clutterText.get_selection();
            if ( selectedText != "" ) {
                text = selectedText;
                break;
            }
        }
        if ( text == "" ) {
            for ( item of this.items ) text += item.entry.text + "\n";
        }

        St.Clipboard.get_default().set_text(text);
    },

    paste: function() {
        St.Clipboard.get_default().get_text(Lang.bind(this, function(cb, text) {
            if ( this.items.slice(-1).text == "" ) this.items.pop();
            let list = text.split("\n");
            for ( let newText of list ) {
                if ( newText == "" ) continue;
                this.addItem({ text: newText, completed: false });
            }
            this.emit("changed");
        }));
    },

    switchType: function() {
        this.switching = true;
        this.emit("changed", true);
    }
}


function CheckListItem(info) {
    this._init(info);
}

CheckListItem.prototype = {
    _init: function(info) {
        this.actor = new Cinnamon.GenericContainer();
        this.actor._delegate = this;

        this.actor.connect("allocate", Lang.bind(this, this.allocate));
        this.actor.connect("get-preferred-height", Lang.bind(this, this.getPreferedHeight));
        this.actor.connect("get-preferred-width", Lang.bind(this, this.getPreferedWidth));

        this.checkBox = new CheckBox.CheckBox("", { style_class: "sticky-checkBox" });
        this.actor.add_actor(this.checkBox.actor);
        this.entry = new St.Entry({ style_class: "sticky-checkList-entry" });
        this.actor.add_actor(this.entry);

        this.clutterText = this.entry.clutter_text;
        this.clutterText._delegate = this;
        this.clutterText.ellipsize = Pango.EllipsizeMode.NONE;
        this.clutterText.set_single_line_mode(false);
        this.clutterText.line_wrap = true;
        this.clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

        if ( info ) {
            this.checkBox.actor.checked = info.completed;
            this.entry.text = info.text;
        }

        this.checkBox.actor.connect("clicked", Lang.bind(this, this.updateCheckedState));
        this.updateCheckedState();
    },

    updateCheckedState: function() {
        if ( this.checkBox.actor.checked ) this.entry.add_style_pseudo_class("checked");
        else this.entry.remove_style_pseudo_class("checked");
    },

    allocate: function(actor, box, flags) {
        let height = box.y2 - box.y1;

        let cbBox = new Clutter.ActorBox();
        let cbHeight = this.checkBox.actor.get_preferred_height(0)[1];

        cbBox.x1 = box.x1;
        cbBox.x2 = box.x1 + this.checkBox.actor.get_preferred_width(0)[1];
        if ( height <= cbHeight ) {
            cbBox.y1 = box.y1;
            cbBox.y2 = box.y2;
        }
        else {
            cbBox.y1 = box.y1 + (height - cbHeight) / 2;
            cbBox.y2 = cbBox.y1 + cbHeight;
        }

        let eBox = new Clutter.ActorBox();
        let eHeight = this.entry.get_preferred_height(box.x2 - cbBox.x2 + 1)[1];

        eBox.x1 = cbBox.x2 + 1;
        eBox.x2 = box.x2;
        if ( height <= eHeight ) {
            eBox.y1 = box.y1;
            eBox.y2 = box.y2;
        }
        else {
            eBox.y1 = box.y1 + (height - eHeight) / 2;
            eBox.y2 = eBox.y1 + eHeight;
        }

        this.checkBox.actor.allocate(cbBox, flags);
        this.entry.allocate(eBox, flags);
    },

    getPreferedHeight: function(actor, forWidth, alloc) {
        let checkBoxWidth = this.checkBox.actor.get_preferred_width(0)[1];
        let [entryMin, entryNat] = this.entry.get_preferred_height(forWidth - checkBoxWidth);
        let [checkBoxMin, checkBoxNat] = this.checkBox.actor.get_preferred_height(forWidth);

        alloc.min_size = Math.max(checkBoxMin, entryMin);
        alloc.natural_size = Math.max(checkBoxNat, entryNat);
    },

    getPreferedWidth: function(actor, forHeight, alloc) {
        let [checkBoxMin, checkBoxNat] = this.checkBox.actor.get_preferred_width(0);
        let [entryMin, entryNat] = this.entry.get_preferred_width(0);

        alloc.min_size = checkBoxMin + entryMin;
        alloc.natural_size = checkBoxNat + entryNat;
    },

    get completed() {
        return this.checkBox.actor.checked;
    },

    get text() {
        return this.entry.text;
    }
}


function NoteBox(menu) {
    this._init(menu);
}

NoteBox.prototype = {
    _init: function(menu) {
        this.menu = menu;
        this.notes = [];
        this.last_x = -1;
        this.last_y = -1;
        this.mouseTrackEnabled = false;
        this.isModal = false;
        this.stageEventIds = [];

        this.actor = new Clutter.Group();
        Main.uiGroup.add_actor(this.actor);
        this.actor._delegate = this;

        this.actor.add_actor(menu.actor);
        this.menuManager = new PopupMenu.PopupMenuManager(this);

        if ( settings.startState == 2 || ( settings.startState == 3 && settings.hideState ) ) {
            this.hideNotes();
            this.actor.hide();
            settings.hideState = true;
        }
        else {
            if ( settings.startState == 0 ) settings.hideState = false;
            if ( settings.startState == 1 || ( settings.startState == 3 && settings.raisedState ) ) this.raiseNotes();
            else this.lowerNotes();
        }

        this.dragPlaceholder = new St.Bin({ style_class: "desklet-drag-placeholder" });
        this.dragPlaceholder.hide();

        this.initializeNotes();
    },

    destroy: function() {
        this.actor.destroy();
        this.dragPlaceholder.destroy();
    },

    addNote: function(type, info) {
        let note;
        switch ( type ) {
            case "note":
                note = new Note(info);
                break;
            case "checklist":
                note = new CheckList(info);
                break;
            default:
                return null;
        }

        let x, y;
        if ( info ) {
            x = info.x;
            y = info.y;
        }
        else [x, y] = this.getAvailableCoordinates();
        this.notes.push(note);
        this.actor.add_actor(note.actor);
        note.actor.x = x;
        note.actor.y = y;

        note.connect("destroy", Lang.bind(this, this.removeNote));
        note.connect("changed", Lang.bind(this, this.update));

        note.draggable = DND.makeDraggable(note.actor, { restoreOnSuccess: true }, this.actor);
        note.draggable.connect("drag-begin", Lang.bind(note, note._onDragBegin));
        note.draggable.connect("drag-end", Lang.bind(note, note._onDragEnd));
        note.draggable.connect("drag-cancelled", Lang.bind(note, note._onDragEnd));

        if ( this.mouseTrackEnabled ) note.trackMouse();
        else note.untrackMouse();

        return note;
    },

    newNote: function() {
        let note = this.addNote("note", null);
        this.update();
        this.raiseNotes();
        focusText(note.textBox);
    },

    newCheckList: function() {
        let note = this.addNote("checklist", null);
        this.update();
        this.raiseNotes();
        focusText(note.items[0].entry)
    },

    removeNote: function(note) {
        for ( let i = 0; i < this.notes.length; i++ ) {
            if ( this.notes[i] == note ) {
                this.notes[i].destroy();
                this.notes.splice(i,1);
                break;
            }
        }
        if ( this.notes.length == 0 && settings.raisedState ) {
            this.lowerNotes();
        }
        this.update();
    },

    removeAll: function() {
        for ( let note of this.notes ) note.destroy();
        this.notes = [];
    },

    update: function(item, refresh) {
        let notesData = [];
        for ( let i = 0; i < this.notes.length; i++ )
            notesData.push(this.notes[i].getInfo());
        settings.saveNotes(notesData);
        if ( refresh ) this.initializeNotes();
    },

    initializeNotes: function() {
        this.removeAll();
        for ( let noteInfo of settings.storedNotes ) {
            let type;
            //make sure it doesn't break anything on upgrade from older version
            if ( !noteInfo.type ) type = "note";
            else type = noteInfo.type;
            this.addNote(type, noteInfo);
        }
    },

    hasActor: function(actor) {
        // listen to contents of the box
        if ( this.actor.contains(actor) ) return true;

        // we want to listen to the applet events still for raising and lowering purposes
        if ( applet.actor == actor || applet.actor.contains(actor) ) return true;

        // the notes have thier own menus and we need to treat them the same
        for ( let note of this.notes ) {
            if ( actor == note.menu.actor || note.menu.actor.contains(actor) ) return true;
        }

        return false;
    },

    raiseNotes: function() {
        this.unpinNotes();
        this.menu.open();
        this.actor.raise_top();
        if ( settings.hideState ) {
            this.actor.show();
            settings.hideState = false;
        }

        settings.raisedState = true;
        this.enableMouseTracking(false);
        this.setModal();
    },

    lowerNotes: function() {
        this.unpinNotes();
        this.menu.close();
        this.actor.lower(global.window_group);
        if ( settings.hideState ) {
            this.actor.show();
            settings.hideState = false;
        }

        settings.raisedState = false;
        this.unsetModal();
        this.enableMouseTracking(true);
    },

    hideNotes: function() {
        this.unpinNotes();
        this.menu.close();
        this.actor.hide();
        settings.raisedState = false;
        settings.hideState = true;
        this.unsetModal();
        this.enableMouseTracking(false);
    },

    pinNotes: function() {
        if ( this.pinned ) return;

        if ( this.menu.isOpen ) this.menu.close();

        // since we're pinning the notes, the the main actor is no longer modal so we'll manage the menu
        // with it's own menu manager
        this.menuManager.addMenu(this.menu);

        this.unsetModal();
        this.enableMouseTracking(true);
        this.pinned = true;
        this.emit("pin-changed");
    },

    unpinNotes: function() {
        if ( !this.pinned ) return;

        // if we've pinned the notes, the menu is managed by it's own manager so we need to remove it now
        this.menu.close()
        this.menuManager.removeMenu(this.menu);

        this.pinned = false;
        this.emit("pin-changed");
    },

    setModal: function() {
        if ( this.isModal ) return;

        this.stageEventIds.push(global.stage.connect("captured-event", Lang.bind(this, this.handleStageEvent)));
        this.stageEventIds.push(global.stage.connect("enter-event", Lang.bind(this, this.handleStageEvent)));
        this.stageEventIds.push(global.stage.connect("leave-event", Lang.bind(this, this.handleStageEvent)));

        if ( Main.pushModal(this.actor) ) this.isModal = true;
    },

    unsetModal: function() {
        if ( !this.isModal ) return;

        for ( let i = 0; i < this.stageEventIds.length; i++ ) global.stage.disconnect(this.stageEventIds[i]);
        this.stageEventIds = [];
        Main.popModal(this.actor);
        this.isModal = false;
    },

    handleStageEvent: function(actor, event) {
        if ( this.pinned ) return false;

        let target = event.get_source();

        if ( this.hasActor(target) ) return false;

        let type = event.type();
        if ( type == Clutter.EventType.BUTTON_PRESS ) return true;
        if ( type == Clutter.EventType.BUTTON_RELEASE ) {
            this.lowerNotes();
            return false;
        }

        return false;
    },

    handleDragOver: function(source, actor, x, y, time) {
        if ( !this.dragPlaceholder.get_parent() ) Main.uiGroup.add_actor(this.dragPlaceholder);

        this.dragPlaceholder.show();

        let interval = STICKY_DRAG_INTERVAL;
        if ( this.last_x == -1 && this.last_y == -1 ) {
            this.last_x = actor.get_x();
            this.last_y = actor.get_y();
        }

        let x_next = Math.abs(actor.get_x() - this.last_x) > interval / 2;
        let y_next = Math.abs(actor.get_y() - this.last_y) > interval / 2;

        if ( actor.get_x() < this.last_x ) {
            if ( x_next ) {
                x = Math.floor(actor.get_x()/interval) * interval;
            }
            else {
                x = Math.ceil(actor.get_x()/interval) * interval;
            }
        }
        else {
            if ( x_next ) {
                x = Math.ceil(actor.get_x()/interval) * interval;
            }
            else {
                x = Math.floor(actor.get_x()/interval) * interval;
            }
        }

        if ( actor.get_y() < this.last_y ) {
            if ( y_next ) {
                y = Math.floor(actor.get_y()/interval) * interval;
            }
            else {
                y = Math.ceil(actor.get_y()/interval) * interval;
            }
        }
        else {
            if ( y_next ) {
                y = Math.ceil(actor.get_y()/interval) * interval;
            }
            else {
                y = Math.floor(actor.get_y()/interval) * interval;
            }
        }

        this.dragPlaceholder.set_position(x,y);
        this.dragPlaceholder.set_size(actor.get_width(), actor.get_height());
        this.last_x = x;
        this.last_y = y;
        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if ( !(source instanceof NoteBase) ) return false;

        Main.uiGroup.remove_actor(actor);
        this.actor.add_actor(actor);

        this.dragPlaceholder.hide();
        this.last_x = -1;
        this.last_y = -1;

        this.mouseTrackEnabled = -1;
        this.checkMouseTracking();

        this.update();

        return true;
    },

    cancelDrag: function(source, actor) {
        if ( !(source instanceof NoteBase) ) return false;

        Main.uiGroup.remove_actor(actor);
        this.actor.add_actor(actor);

        this.mouseTrackEnabled = -1;
        this.checkMouseTracking();

        this.dragPlaceholder.hide();

        this.last_x = -1;
        this.last_y = -1;

        return true;
    },

    checkMouseTracking: function() {
        let enable = false;
        if ( this.pinned ) enable = true;
        else if ( !this.hideState && !this.raisedState ) {
            let window = global.screen.get_mouse_window(null);
            let hasMouseWindow = window && window.window_type != Meta.WindowType.DESKTOP;
            enable = !hasMouseWindow;
        }

        if ( enable ) for ( let i = 0; i < this.notes.length; i++ ) this.notes[i].trackMouse();
        else for ( let i = 0; i < this.notes.length; i++ ) this.notes[i].untrackMouse();

        return true;
    },

    enableMouseTracking: function(enable) {
        if( enable && !this.mouseTrackTimoutId )
            this.mouseTrackTimoutId = Mainloop.timeout_add(500, Lang.bind(this, this.checkMouseTracking));
        else if ( !enable && this.mouseTrackTimoutId ) {
            Mainloop.source_remove(this.mouseTrackTimoutId);
            this.mouseTrackTimoutId = null;
            for ( let i = 0; i < this.notes.length; i++ ) {
                this.notes[i].untrackMouse();
            }
        }

        this.checkMouseTracking();
    },

    getAvailableCoordinates: function() {
        //determine boundaries
        let monitor = Main.layoutManager.primaryMonitor;
        let startX = PADDING + monitor.x;
        let startY = PADDING + monitor.y;
        if ( Main.desktop_layout != Main.LAYOUT_TRADITIONAL ) startY += Main.panel.actor.height;
        let width = monitor.width - PADDING;
        let height = monitor.height - Main.panel.actor.height - PADDING;
        if ( Main.desktop_layout == Main.LAYOUT_CLASSIC ) height -= Main.panel2.actor.height;

        //calculate number of squares
        let rowHeight = settings.height + PADDING;
        let columnWidth = settings.width + PADDING;
        let rows = Math.floor(height/rowHeight);
        let columns = Math.floor(width/columnWidth);

        for ( let n = 0; n < columns; n++ ) {
            for ( let m = 0; m < rows; m++ ) {
                let x = n * columnWidth + startX;
                let y = m * rowHeight + startY;
                let x2 = x + columnWidth;
                let y2 = y + rowHeight;

                let hasX = false;
                let hasY = false;
                for ( let i = 0; i < this.notes.length; i++ ) {
                    let allocation = this.notes[i].actor.get_allocation_box();
                    if ( ( allocation.x1 > x && allocation.x1 < x2 ) ||
                         ( allocation.x2 > x && allocation.x2 < x2 ) ) hasX = true;
                    else hasX = false;
                    if ( ( allocation.y1 > y && allocation.y1 < y2 ) ||
                         ( allocation.y2 > y && allocation.y2 < y2 ) ) hasY = true;
                    else hasY = false;
                    if ( hasX && hasY ) break;
                }
                if ( hasX && hasY ) continue;
                else return [x, y];
            }
        }

        return [startX, startY];
    }
}
Signals.addSignalMethods(NoteBox.prototype);


// l10n/translation
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
let UUID;

function _(str) {
   let customTranslation = Gettext.dgettext(UUID, str);
   if(customTranslation != str) {
      return customTranslation;
   }
   return Gettext.gettext(str);
};

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        applet = this;
        this.metadata = metadata;
        this.instanceId = instanceId;
        this.orientation = orientation;

        Applet.IconApplet.prototype._init.call(this, this.orientation, panelHeight, instanceId);

        // l10n/translation
        UUID = metadata.uuid;
        Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

        this.set_applet_icon_symbolic_path(this.metadata.path+"/icons/sticky-symbolic.svg");

        this.menu = new Menu(this, this.orientation);

        noteBox = new NoteBox(this.menu);
        noteBox.connect("pin-changed", Lang.bind(this, this.stateChanged));

        this.buildMenus();
    },

    on_applet_clicked: function() {
        if ( noteBox.pinned ) this.menu.toggle();
        else if ( settings.raisedState ) noteBox.lowerNotes();
        else noteBox.raiseNotes();
    },

    on_applet_removed_from_panel: function() {
        if ( settings.raisedState ) noteBox.lowerNotes();
        noteBox.destroy();
    },

    buildMenus: function() {
        // main menu
        let newNoteMenuItem = new PopupMenu.PopupIconMenuItem(_("New note"), "add-note-symbolic", St.IconType.SYMBOLIC);
        this.menu.addMenuItem(newNoteMenuItem);
        newNoteMenuItem.connect("activate", Lang.bind(noteBox, noteBox.newNote));

        let newCheckListMenuItem = new PopupMenu.PopupIconMenuItem(_("New check-list"), "add-checklist-symbolic", St.IconType.SYMBOLIC);
        this.menu.addMenuItem(newCheckListMenuItem);
        newCheckListMenuItem.connect("activate", Lang.bind(noteBox, noteBox.newCheckList));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.pinMenuItem = new PopupMenu.PopupIconMenuItem(_("Pin notes (keep on top)"), "pin-symbolic", St.IconType.SYMBOLIC);
        this.menu.addMenuItem(this.pinMenuItem);
        this.pinMenuItem.connect("activate", Lang.bind(this, function() {
            if ( noteBox.pinned ) noteBox.raiseNotes();
            else noteBox.pinNotes();
        }));

        let hideMenuItem = new PopupMenu.PopupIconMenuItem(_("Hide notes"), "hide-symbolic", St.IconType.SYMBOLIC);
        this.menu.addMenuItem(hideMenuItem);
        hideMenuItem.connect("activate", Lang.bind(noteBox, noteBox.hideNotes));

        // context menu
        let backupItem = new PopupMenu.PopupMenuItem(_("Back up notes"));
        this._applet_context_menu.addMenuItem(backupItem);
        backupItem.connect("activate", Lang.bind(this, this.backupNotes));

        let restoreBackupItem = new PopupMenu.PopupMenuItem(_("Restore from backup"));
        this._applet_context_menu.addMenuItem(restoreBackupItem);
        restoreBackupItem.connect("activate", Lang.bind(this, this.loadBackup));
    },

    stateChanged: function() {
        if ( noteBox.pinned ) this.pinMenuItem.label.text = "Unpin notes (lower on click)";
        else this.pinMenuItem.label.text = "Pin notes (keep on top)";
    },

    backupNotes: function() {
        params = { directory: "~/", name: "notes-" + new Date().toJSON() + " .json" };
        FileDialog.save(Lang.bind(this, function(path) {
            let file = Gio.file_new_for_path(path.slice(0,-1));
            if ( !file.query_exists(null) ) file.create(Gio.FileCreateFlags.NONE, null);
            file.replace_contents(JSON.stringify(settings.storedNotes), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        }), params);
    },

    loadBackup: function() {
        params = { directory: "~/" };
        new ModalDialog.ConfirmDialog(_("This will permanently remove all existing notes. Are you sure you want to continue?"), Lang.bind(this, function() {
            FileDialog.open(Lang.bind(this, function(path) {
                let file = Gio.file_new_for_path(path.slice(0,-1));
                if ( !file.query_exists(null) ) return;
                let [a, contents, b] = file.load_contents(null);
                settings.saveNotes(JSON.parse(contents));
                noteBox.initializeNotes();
            }), params);
        })).open();
    }
}


function main(metadata, orientation, panelHeight, instanceId) {
    settings = new SettingsManager(metadata.uuid, instanceId);
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}
