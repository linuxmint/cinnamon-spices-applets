
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;


class CinnamonVersionAdapter {

    constructor() {
        this._cinnamon_version = 0;

        this._init_cinnamon_version();
    }

    _init_cinnamon_version() {
        let version = GLib.getenv('CINNAMON_VERSION');
        version = version.substring(0, version.lastIndexOf("."));
        this._cinnamon_version = parseFloat(version);
    }

    byte_array_to_string(byte_array) {
        if(this._cinnamon_version <= 4.6) {
            return byte_array.toString();
        } else {
            return ByteArray.toString(byte_array);
        }
    }

}
