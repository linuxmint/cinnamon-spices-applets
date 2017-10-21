const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Signals = imports.signals;
const Tooltips = imports.ui.tooltips;

const Widgets = {

    HintedEntry: function(hintString) {
        this._init(hintString);
    },

    SearchBar: function(hintString) {
        this._init(hintString);
    },

    ModeButton: function() {
        this._init();
    },

    PopOver: function(launcher, orientation) {
        this._init(launcher, orientation);
    }
}

Widgets.HintedEntry.prototype = {

    _init: function(hintString) {

        this.actor = new St.Entry({
            style_class: 'entry'
        });

        this.hasClearIcon = false;

        this.actor.connect('secondary-icon-clicked', Lang.bind(this, function() {
            this.actor.text = '';
        }));

        this.actor.clutter_text.connect('text-changed', Lang.bind(this, function() {
            this.emit('changed');
        }));
        this.connect('changed', Lang.bind(this, this._manageIcon));

        this.actor.clutter_text.connect('activate', Lang.bind(this, function() {
            this.emit('activate');
        }));
    },

    _manageIcon: function() {
        if (this.hasClearIcon && this.actor.text != '') {
            let clearIcon = new St.Icon({
                icon_name: 'edit-clear',
                icon_size: 16,
                icon_type: St.IconType.SYMBOLIC
            });
            this.actor.set_secondary_icon(clearIcon);
        } else {
            this.actor.set_secondary_icon(null);
        }
    },

    get hintString() {
        return this.actor.get_hint_text();
    },
    set hintString(value) {
        this.actor.set_hint_text(value);
    },

    grabFocus: function() {
        global.stage.set_key_focus(this.actor);
    },

    hasFocus: function() {
        return this.actor.clutter_text.has_key_focus();
    }
}
Signals.addSignalMethods(Widgets.HintedEntry.prototype);

Widgets.SearchBar.prototype = {

    __proto__: Widgets.HintedEntry.prototype,

    _init: function(hintString) {
        Widgets.HintedEntry.prototype._init.call(this, hintString);

        this._timeoutId = 0;
        this.pauseDelay = 300;

        this.hasClearIcon = true;

        let searchIcon = new St.Icon({
            icon_name: 'edit-find',
            icon_size: 16,
            icon_type: St.IconType.SYMBOLIC
        });
        this.actor.set_primary_icon(searchIcon);

        this.actor.clutter_text.connect_after('text-changed', Lang.bind(this, this._onChanged));
        this.actor.connect('primary-icon-clicked', Lang.bind(this, this._onIconRelease));

        this.actor.connect('key-press-event', Lang.bind(this, function(actor, event) {
            switch (event.get_key_symbol()) {
                case Clutter.Escape:
                    this.actor.text = '';
                    return true;
            }
            return false;
        }));
    },

    _onIconRelease: function() {
        this.emit('search-icon-release');
    },

    _onChanged: function() {
        if (this._timeoutId > 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        this._timeoutId = Mainloop.timeout_add(this.pauseDelay, Lang.bind(this, this._emitTextChanged));
    },

    _emitTextChanged: function() {
        let terms = this.actor.get_text();
        this.emit('text-changed-pause', terms);

        Mainloop.source_remove(this._timeoutId);
        this._timeoutId = 0;

        return true;
    }
}

Widgets.ModeButton.prototype = {

    _init: function() {

        this.actor = new St.BoxLayout({
            can_focus: false,
            reactive: true
        });

        this._selected = -1;
        this._itemMap = [];

        this.actor.add_style_class_name(Gtk.STYLE_CLASS_LINKED);
        this.actor.add_style_class_name('raised');

        this.actor.connect('scroll-event', Lang.bind(this, function(actor, event) {
            global.log('scrolled');
            switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.UP:
                case Clutter.ScrollDirection.LEFT:
                    this.setActive(this.selected - 1);
                    break;
                case Clutter.ScrollDirection.DOWN:
                case Clutter.ScrollDirection.RIGHT:
                    this.setActive(this.selected + 1);
                    break;
            }
            return true;
        }));
    },

    append: function(w, tooltip) {
        let index = this._itemMap.length;

        let item = new St.Button({
            can_focus: false,
            style_class: 'button',
            toggle_mode: true
        });
        item.add_actor(w);

        if (tooltip != null)
            new Tooltips.Tooltip(item, tooltip);

        item.connect('clicked', Lang.bind(this, function(actor) {
            this.setActive(index);
            return true;
        }));

        this._itemMap[index] = item;

        this.actor.add_actor(item);

        this.emit('mode-added', index, w);
    },

    setActive: function(newActiveIndex) {
        let newItem = this._itemMap[newActiveIndex];

        if (newItem != null) {
            newItem.set_checked(true);

            if (this._selected == newActiveIndex)
                return;

            // Unselect the previous item
            let oldItem = this._itemMap[this._selected];
            if (oldItem != null)
                oldItem.set_checked(false);

            this._selected = newActiveIndex;

            this.emit('mode-changed', newItem.get_child());
        }
    },

    remove: function(index) {
        let item = this._itemMap[index];

        if (item != null) {
            this._itemMap.splice(index, 1);
            this.emit('mode-removed', index, item.get_child());
            item.destroy();
        }
    },

    clearChildren: function() {
        this.getChildren().forEach(function(button) {
            button.hide();
            if (button.get_parent() != null)
                this.actor.remove_actor(button);
        }, this);

        this._itemMap = [];

        this._selected = -1;
    },

    get selected() {
        return this._selected;
    },
    set selected(value) {
        this.setActive(value);
    },

    get nItems() {
        return this._itemMap.length;
    }
}
Signals.addSignalMethods(Widgets.ModeButton.prototype);

Widgets.PopOver.prototype = {

    __proto__: Applet.AppletPopupMenu.prototype,

    _init: function(launcher, orientation) {

        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

        this.actor.add_style_class_name('popover_bg');
        this.box.add_style_class_name('popover');
    },

    _onKeyPressEvent: function(actor, event) {
        return false;
    },
}
