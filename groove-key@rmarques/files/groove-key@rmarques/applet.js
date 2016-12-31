/*
 * Grooveshark applet for cinnamon
 *
 * Grab the keyboard media keys to control Grooveshark running on the browser
 *
 * - Requires keySharky firefox add-on with the API server running (https://addons.mozilla.org/en-US/firefox/addon/keysharky/)
 * - Click the applet to grab the keyboard media keys
 * - Click the applet to release the keyboard media keys
 *
 * Author
 *  Rodolphe Marques <marques.rodolphe@gmail.com>
 *
 */

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;
const DBus = imports.dbus;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;

const EXTENSION_PATH = GLib.get_home_dir() + "/.local/share/cinnamon/applets/groove-key@rmarques"
const ICON_PATH = EXTENSION_PATH + "/icon.png"
const ICON_ALT_PATH = EXTENSION_PATH + "/icon_alt.png"
const EXTENSION_PREFS = '{ "port": 8800}';

const MediaKeysIface = {
    name: 'org.gnome.SettingsDaemon.MediaKeys',
    properties: [],
    methods: [
        {name: 'GrabMediaPlayerKeys', inSignature: 'su', outSignature: ''},
        {name: 'ReleaseMediaPlayerKeys', inSignature: 's', outSignature: ''}
    ],
    signals: [
        {name: 'MediaPlayerKeyPressed', inSignature: '', outSignature: 'ss'}
    ]
};

let MediaKeys = DBus.makeProxyClass(MediaKeysIface);

function MyApplet(orientation) {
    this._init(orientation);
};

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);
        this.capture = 0;
        this._prefs = null;
        if(!this.readprefs(EXTENSION_PATH)){
            this._prefs = JSON.parse(EXTENSION_PREFS);
            this.writeprefs(EXTENSION_PATH);
        }
        this.api_url = 'http://localhost:' + this._prefs.port + '/';

        this.session = new Soup.SessionAsync();
        this.mediaKeysProxy = new MediaKeys(DBus.session, 'org.gnome.SettingsDaemon', '/org/gnome/SettingsDaemon/MediaKeys');
        this.mediaKeysProxy.connect('MediaPlayerKeyPressed', Lang.bind(this, this._onMediaPlayerKeyPressed));
       
        try {
            this.set_applet_icon_path(ICON_PATH);
            this.set_applet_tooltip(_("Click here to capture media keys"));
        }
        catch(e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        if(this.capture == 0) {
            this.set_applet_icon_path(ICON_ALT_PATH);
            this.set_applet_tooltip(_("Click here to release media keys"));
            this.capture = 1
            this.mediaKeysProxy.GrabMediaPlayerKeysRemote('groovekey', 0);
        }
        else if(this.capture == 1) {
            this.set_applet_icon_path(ICON_PATH);
            this.set_applet_tooltip(_("Click here to capture media keys"));
            this.capture = 0;
            this.mediaKeysProxy.ReleaseMediaPlayerKeysRemote('groovekey');
        }
    },

    _onMediaPlayerKeyPressed: function(object, app_name, key) {
        switch(key) {
            case 'Play':
                this._api_request('play');
                break;
            case 'Stop':
                this._api_request('stop');
                break;
            case 'Previous':
                this._api_request('previous');
                break;
            case 'Next':
                this._api_request('next');
                break;
            default:
                break;
        }
    },

    _api_request: function(command) {
        url = this.api_url + command;
        let message = Soup.Message.new('GET', url);
        let session = this.session;
        session.queue_message(message, function(session, message) {
        });
    },

    readprefs: function(path) {
        let dir = Gio.file_new_for_path(path);
        let prefsFile = dir.get_child('prefs.json');
        if (!prefsFile.query_exists(null)) {
            global.log('No prefs.json found');
            return false;
        }
        let prefsContent;
        try {
            prefsContent = Cinnamon.get_file_contents_utf8_sync(prefsFile.get_path());
        }
        catch(e) {
            global.log('Failed to load prefs.json: ' + e);
            return false;
        }
        this._prefs = JSON.parse(prefsContent);
    },

    writeprefs: function(path) {
        let f = Gio.file_new_for_path(path + '/prefs.json');
        let raw = f.replace(null, false,
                            Gio.FileCreateFlags.NONE,
                            null);
        let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out, JSON.stringify(this._prefs));
        out.close(null);
    }

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    
    return myApplet;
}
