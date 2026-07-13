const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Channels = imports.channels;

const UUID = "FM-Radio@hilyxx";
const extPath = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID;

const FILE_NAME = "prefs.json";
const DIR_NAME = ".fm-radio";

function readFile(filepath) {
    let file = Gio.file_new_for_path(filepath);
    let [success, contents] = file.load_contents(null);
    if (success) {
        return imports.byteArray.toString(contents);
    }
    return null;
}

function load() {
    let dir_path = GLib.get_home_dir() + "/" + DIR_NAME;
    
    const defaultData = {
        lastChannel: 0,
        lastVol: 1,
    };

    create(dir_path);
    let file_path = GLib.get_home_dir() + "/" + DIR_NAME + "/" + FILE_NAME;
    let content;
    let channelList;

    content = readFile(file_path);
    
    if (!content) {
        global.logError("FM Radio: Unable to read JSON file.");
        return defaultData;
    }

    try {
        channelList = JSON.parse(content);
    } catch (e) {
        global.logError("FM Radio: Failed to parse json: " + e);
        return defaultData;
    }
    return channelList;
}

function getLastChannel() {
	return Channels.getChannel(load().lastChannel) ?? Channels.getChannel(0);
}

function getLastVol() {
	return load().lastVol;
}

function create(dir_path) {
    let dir = Gio.file_new_for_path(dir_path);
    let file_path = dir_path + "/" + FILE_NAME;

    if (!dir.query_exists(null)) {
        try {
            dir.make_directory(null);
        } catch (e) {
            global.logError("FM Radio: Failed to create directory! " + e);
            return;
        }
    }

    let file = Gio.file_new_for_path(file_path);
    if (!file.query_exists(null)) {
        const defaultJson = JSON.stringify(
            { lastChannel: 0, lastVol: 1 },
            null,
            4,
        );
        try {
            GLib.file_set_contents(file_path, defaultJson);
        } catch (e) {
            global.logError("FM Radio: Failed to create default prefs file! " + e);
        }
    }
}

function save(lastChannel, lastVol) {
    let filepath = GLib.get_home_dir() + "/" + DIR_NAME + "/" + FILE_NAME;
    
    // Ensure lastVol is a number (toFixed returns a string)
    let volumeToSave = typeof lastVol === "number" && isFinite(lastVol) ? parseFloat(lastVol.toFixed(2)) : 1;

    const saveData = {
        lastChannel: lastChannel ? lastChannel.getNum() : 0,
        lastVol: volumeToSave,
    };

    try {
        let text = JSON.stringify(saveData, null, 4);
        GLib.file_set_contents(filepath, text);
    } catch (e) {
        global.logError("FM Radio: Failed to save preferences: " + e);
    }
}
