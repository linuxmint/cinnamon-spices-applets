/**
 * Code from the download-and-upload-speed@cardsurf applet.
 * Many thanks to @cardsurf!
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

const {to_string} = require("./lib/to-string");

/** Constants
 */
const {
    UUID,
    HOME_DIR,
    APPLET_DIR,
    SCRIPTS_DIR,
    ICONS_DIR,
    IFACES_DIR,
    SOUNDS_DIR,
    DEFAULT_SYMBOLIC_ICON,
    _,
    exists,
    DEBUG,
    RELOAD,
    log,
    logError
} = require("./lib/constants");

/**
 * class File
 */
class File {

    constructor (path) {
        this.newline = "\n";
        this.regex_newline = /(?:[\n\r]+)/;
        this.path = path;
        this.file = Gio.file_new_for_path(this.path);
    }

    exists () {
        return GLib.file_test(this.path, GLib.FileTest.IS_REGULAR) && GLib.file_test(this.path, GLib.FileTest.EXISTS);
    }

    read () {
        let array_chars = to_string(this.read_chars());
        let string = array_chars.trim();
        let array_strings = string.length == 0 ? [] : string.split(this.regex_newline);
        return array_strings;
    }

    read_chars () {
        let [success, array_chars] = GLib.file_get_contents(this.path);
        if(!success) {
             throw ("Unable to read file content. Path to the file: " + this.path);
        }
        return array_chars;
    }

    overwrite (array_strings) {
        let string = array_strings.join(this.newline);
        return GLib.file_set_contents(this.path, string);
    }

    create () {
        if(this.exists()) {
            return true;
        }
        if(!this.is_top_level()) {
            let directory = this.get_parent_directory();
            directory.create();
        }
        return this._create();
    }

    is_top_level () {
        return !this.file.has_parent(null);
    }

    get_parent_directory () {
        let parent = this.file.get_parent();
        let parent_path = parent.get_path();
        return new Directory(parent_path);
    }

    _create () {
        return this.overwrite([]);
    }

    remove () {
        return this.file.delete(null, null);
    }
};



/**
 * class Directory
 */
class Directory {

    constructor (path) {
        this.separator = "/";
        this.path = path.endsWith(this.separator) ? path : path + this.separator;
        this.directory = Gio.file_new_for_path(this.path);
    }

    exists () {
        return GLib.file_test(this.path, GLib.FileTest.IS_DIR) && GLib.file_test(this.path, GLib.FileTest.EXISTS);
    }

    create () {
         if(this.exists()) {
             return true;
         }
         this.create_parent_directories();
         this._create();
    }

    create_parent_directories () {
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
    }

    is_top_level () {
        return !this.directory.has_parent(null);
    }

    get_parent_directory () {
        let parent = this.directory.get_parent();
        let parent_path = parent.get_path();
        return new Directory(parent_path);
    }

    _create () {
        return this.directory.make_directory(null, null);
    }

    removeIfEmpty () {
        return this.directory.delete(null, null);
    }
};



