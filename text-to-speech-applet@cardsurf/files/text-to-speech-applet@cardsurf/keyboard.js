
const Lang = imports.lang;
const Main = imports.ui.main;





function KeyBind(id, keys) {
    this._init(id, keys);
};

KeyBind.prototype = {

    _init: function(id, keys) {
        this.id = id;
        this.keys = keys;
        this.is_binded = false;
        this.callback_object = null;
        this.callback_key_pressed = null;
    },

    update_binding: function(keys) {
        this.keys = keys;
        let is_defined = this.is_defined();
        if(is_defined){
            this.update();
        }
        else {
            this.remove();
        }
    },

    is_defined: function () {
        let is_defined = this.keys.length > 0;
        return is_defined;
    },

    update: function() {
        this.remove();
        this.add();
    },

    remove: function() {
        if(this.is_binded) {
            Main.keybindingManager.removeHotKey(this.id);
            this.is_binded = false;
        }
    },

    add: function() {
        if(!this.is_binded) {
            Main.keybindingManager.addHotKey(this.id, this.keys,
                                             Lang.bind(this, this._invoke_key_pressed_function));
            this.is_binded = true;
        }
    },

    set_callback_key_pressed: function(callback_object, callback_key_pressed) {
        this.callback_object = callback_object;
        this.callback_key_pressed = callback_key_pressed;
    },

    _invoke_key_pressed_function: function() {
        if(this.callback_key_pressed != null) {
            this.callback_key_pressed.call(this.callback_object);
        }
    },

};



