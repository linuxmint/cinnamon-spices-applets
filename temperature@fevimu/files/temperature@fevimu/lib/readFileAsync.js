//!/usr/bin/cjs
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Extension = imports.ui.extension;

var readFileAsync = function(file, opts = {utf8: true}) {
    const {utf8} = opts;
    return new Promise(function(resolve, reject) {
        if (typeof file === 'string' || file instanceof String) {
            file = Gio.File.new_for_path(file);
        }
        // A missing file makes load_contents_finish() throw NOT_FOUND, which rejects below.
        file.load_contents_async(null, function(object, result) {
            try {
                let [success, data] = file.load_contents_finish(result);
                if (!success) return reject(new Error('File cannot be read.'));
                if (utf8) {
                    if (data instanceof Uint8Array) data = ByteArray.toString(data);
                    else data = data.toString();
                }
                resolve(data);
            } catch(e) {
                reject(e);
            }
        });
    });
};

var readJSONAsync = function(file) {
    return readFileAsync(file).then(function(json) {
        return JSON.parse(json);
    });
};

if (!Extension.getCurrentExtension) {
    module.exports = { readFileAsync, readJSONAsync }
}
