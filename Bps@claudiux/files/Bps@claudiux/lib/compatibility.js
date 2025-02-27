
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;



function CinnamonVersionAdapter() {
    this._init();
};

CinnamonVersionAdapter.prototype = {

    _init: function() {
        this._cinnamon_version = 0;

        this._init_cinnamon_version();
    },

    _init_cinnamon_version: function () {
        let version = GLib.getenv('CINNAMON_VERSION');
        version = version.substring(0, version.lastIndexOf("."));
        this._cinnamon_version = parseFloat(version);
    },

    byte_array_to_string: function(byte_array) {
        if(this._cinnamon_version <= 4.6) {
            return byte_array.toString();
        } else {
            return ByteArray.toString(byte_array);
        }
    },

};
