const Gdk   = imports.gi.Gdk;
const Gtk   = imports.gi.Gtk;
const Lang  = imports.lang;
const Pango = imports.gi.Pango;

const SelectItem = function (properties) {

    this.id = properties.id;
    this.selectingMode = true;
    this.text = properties.text;
    this.widget = this.getWidget(properties.image, properties.text);
    this.signals = { };
};

SelectItem.prototype.setSelectingMode = function(selection) {

    this.selectingMode = selection;
    if (selection) {
        this.box.show();
    } else {
        this.box.hide();
    }
};

SelectItem.prototype.getWidget = function (image, text) {

    let css, overlay, widget, event;

    this.image = new Gtk.Image ({ file: image });

    css = new Gtk.CssProvider();
    css.load_from_data(' * { background-color: rgba(0, 0, 0, 0.3); border-radius: 5px; }');

    this.box = new Gtk.Box({halign: Gtk.Align.END, margin: 10, valign: Gtk.Align.END});
    this.box.get_style_context().add_provider(css, 0);
    this.box.set_size_request(25, 25);

    this.check = new Gtk.CheckButton({ halign: Gtk.Align.END, margin:5, valign: Gtk.Align.END});
    this.box.add(this.check);    
    this.check.connect('toggled', Lang.bind(this, function(widget) { 
        if (this.signals.selectionChanged) {
            this.signals.selectionChanged(this.id, widget.get_active());
        }
    }));

    overlay = new Gtk.Overlay();
    overlay.set_size_request(125, 150);
    overlay.add(this.image);
    overlay.add_overlay(this.box);

    this.label = new Gtk.Label({ halign: Gtk.Align.CENTER, label: text, valign: Gtk.Align.START });
    this.label.set_size_request(100, -1);
    this.label.set_ellipsize(Pango.EllipsizeMode.END);
    this.label.set_max_width_chars(10);
    this.label.set_line_wrap(true);
    this.label.set_justify(Gtk.Justification.CENTER);
    this.label.set_lines(2);

    widget = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    widget.add(overlay);
    widget.add(this.label);

    // Set the action for this widget
    event = new Gtk.EventBox();
    event.add(widget);
    event.connect('button-press-event',  Lang.bind(this, function() { 
        if (this.selectingMode) {
            this.check.set_active(!this.check.get_active());
        } else {
            if (this.signals.action) {
                this.signals.action(this.id);
            }
        }
    }));

    return event;
};

SelectItem.prototype.connect = function(type, func) {

    if (type === 'selection-changed') {
        this.signals.selectionChanged = func;
    }
    if (type === 'action') {
        this.signals.action = func;
    }
};

const SelectFlow = function () {

    this.counter = -1;
    this.pointers = {};
    this.filterText = '';
    this.widget = this.getWidget();
    this.signals = { };
    this.selected = [];
};

SelectFlow.prototype.getWidget = function() {

    this.flow = new Gtk.FlowBox({ vexpand: true, selection_mode: Gtk.SelectionMode.NONE });
    this.flow.set_filter_func(Lang.bind (this, this.filter));
    return this.flow;
};

SelectFlow.prototype.insert = function(image, text) {

    this.counter = this.counter + 1;
    this.pointers[this.counter] = new SelectItem({ id: this.counter, image: image, text: text });
    this.pointers[this.counter].connect('selection-changed', Lang.bind (this, function (id, active) {

        let pos;
        if (this.signals.selectionChanged) {

            pos = this.selected.indexOf(id)
            if (active) {
                if (pos === -1) {
                    this.selected.push(id);
                }
            } else {
                if (pos !== -1) {
                    this.selected.splice(pos, 1);
                }
            }
            this.signals.selectionChanged();
        }
    }));
    this.pointers[this.counter].connect('action', Lang.bind (this, function (id) {
        if (this.signals.action) {
            this.signals.action(id);
        }
    }));
    
    this.flow.insert(this.pointers[this.counter].widget, -1);

    return this.counter;
};

SelectFlow.prototype.filter = function (item) {

    let widget = this.getWidgetFromItem(item);

    if (this.filterText !== '') {
        if (widget.text.indexOf(this.filterText) !== -1) {
            return true;
        } else {
            return false;
        }
    } else {

        return true;
    }
}

SelectFlow.prototype.setSelectingMode = function(selection) {

    let counter, keys;

    keys = Object.keys(this.pointers);
    for (counter = 0; counter < keys.length; counter = counter + 1) {
        this.pointers[keys[counter]].setSelectingMode(selection);
    }
};

SelectFlow.prototype.getWidgetFromItem = function(item) {

    let counter, keys, child, ref;

    child = item.get_child();

    keys = Object.keys(this.pointers);
    for (counter = 0; counter < keys.length; counter = counter + 1) {
        ref = this.pointers[keys[counter]];
        if (child === ref.widget) {
            return ref;
        }
    }

    return null;
};

SelectFlow.prototype.getWidgetFromId = function(id) {

    let counter, keys, ref;

    keys = Object.keys(this.pointers);
    for (counter = 0; counter < keys.length; counter = counter + 1) {
        ref = this.pointers[keys[counter]];
        if (id === ref.id) {
            return ref;
        }
    }

    return null;
};

SelectFlow.prototype.deleteSelected = function () {

    let counter, id, ref;

    for (counter = 0; counter < this.selected.length; counter = counter + 1) {

        id = this.selected[counter];
        ref = this.getWidgetFromId(id);

        this.flow.remove(ref.widget.get_parent());
        delete this.pointers[id];
    }

    this.selected = [];
    if (this.signals.selectionChanged) {
        this.signals.selectionChanged();
    }
};

SelectFlow.prototype.connect = function(type, func) {

    if (type === 'selection-changed') {
        this.signals.selectionChanged = func;
    }
    if (type === 'action') {
        this.signals.action = func;
    }
};

