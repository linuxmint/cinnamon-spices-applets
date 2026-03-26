
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

let Compatibility;
if (typeof require !== 'undefined') {
    Compatibility = require('./compatibility');
} else {
    Compatibility = AppletDirectory.compatibility;
}

function _(str) {
    return Gettext.dgettext(uuid, str);
}




function File(path) {
    this._init(path);
};

File.prototype = {

    _init: function(path) {
        this.newline = "\n";
        this.regex_newline = /(?:[\n\r]+)/;
        this.cinnamon_version_adapter = new Compatibility.CinnamonVersionAdapter();

        this.path = path;
        this.file = Gio.file_new_for_path(this.path);
    },

    exists: function() {
        return GLib.file_test(this.path, GLib.FileTest.IS_REGULAR) && GLib.file_test(this.path, GLib.FileTest.EXISTS);
    },

    read: function() {
        let array_chars = this.read_chars();
        let string = this.cinnamon_version_adapter.byte_array_to_string(array_chars).trim();
        let array_strings = string.length == 0 ? [] : string.split(this.regex_newline);
        return array_strings;
    },

    read_chars: function() {
        let [success, array_chars] = GLib.file_get_contents(this.path);
        if(!success) {
             throw ("Unable to read file content. Path to the file: " + this.path);
        }
        return array_chars;
    },

    overwrite: function(array_strings) {
        let string = array_strings.join(this.newline);
        return GLib.file_set_contents(this.path, string);
    },

    create: function() {
        if(this.exists()) {
            return true;
        }
        if(!this.is_top_level()) {
            let directory = this.get_parent_directory();
            directory.create();
        }
        return this._create();
    },

    is_top_level: function() {
        return !this.file.has_parent(null);
    },

    get_parent_directory: function() {
        let parent = this.file.get_parent();
        let parent_path = parent.get_path();
        return new Directory(parent_path);
    },

    _create: function() {
        return this.overwrite([]);
    },

    remove: function() {
        return this.file.delete(null, null);
    }
};





function Directory(path) {
    this._init(path);
};

Directory.prototype = {

    _init: function(path) {
        this.separator = "/";
        this.path = path.endsWith(this.separator) ? path : path + this.separator;
        this.directory = Gio.file_new_for_path(this.path);
    },

    exists: function() {
        return GLib.file_test(this.path, GLib.FileTest.IS_DIR) && GLib.file_test(this.path, GLib.FileTest.EXISTS);
    },

    create: function() {
         if(this.exists()) {
             return true;
         }
         this.create_parent_directories();
         this._create();
    },

    create_parent_directories: function() {
        if(this.is_top_level()) {
            return;
        }
        let directories_stack = [];
        let parent = this.get_parent_directory();
        while(!parent.exists()) {
            directories_stack.push(parent);
            parent = parent.get_parent_directory();
        }
        for(let i = 0; i < directories_stack.length; ++i) {
            directories_stack[i].create();
        }
    },

    is_top_level: function() {
        return !this.directory.has_parent(null);
    },

    get_parent_directory: function() {
        let parent = this.directory.get_parent();
        let parent_path = parent.get_path();
        return new Directory(parent_path);
    },

    _create: function() {
        return this.directory.make_directory(null);
    },

    removeIfEmpty: function() {
        return this.directory.delete(null, null);
    }
};



