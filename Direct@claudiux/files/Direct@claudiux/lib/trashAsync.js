//!/usr/bin/cjs
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Extension = imports.ui.extension;

var trashAsync = function() {
    const uri = "trash:///";
    const file = Gio.File.new_for_path(uri);
    var count = 0;
    var enumerator = null;
    return new Promise(function(resolve, reject) {
        if (!file.query_exists(null)) reject(new Error('File does not exist.'));
        file.enumerate_children_async('standard::name',
        Gio.FileQueryInfoFlags.NONE,
        GLib.PRIORITY_DEFAULT,
        null,
        function(object, result) {
            try {
                enumerator = file.enumerate_children_finish(result);
                if (enumerator == null) {
                    //~ reject(new Error('Trash file cannot be read.'));
                    count = -1;
                } else {

                }
                resolve(data);
            } catch(e) {
                reject(e);
            }
        },
        null);
    });
};

var readTrashAsync = function() {
    return readFileAsync(file).then(function(json) {
        return JSON.parse(json);
    });
};

if (!Extension.getCurrentExtension) {
    module.exports = { readFileAsync, readJSONAsync }
}
