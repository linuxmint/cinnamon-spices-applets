"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationStore = void 0;
const services_1 = require("./services");
const utils_1 = require("./utils");
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
class LocationStore {
    constructor(app, onStoreChanged) {
        this.path = null;
        this.file = null;
        this.locations = [];
        this.app = null;
        this.currentIndex = 0;
        this.StoreChanged = null;
        this.app = app;
        this.path = this.GetConfigPath() + "/weather-mockturtl/locations.json";
        services_1.Logger.Debug("location store path is: " + this.path);
        this.file = Gio.File.new_for_path(this.path);
        if (onStoreChanged != null)
            this.StoreChanged = onStoreChanged;
        this.LoadSavedLocations();
    }
    GetConfigPath() {
        let configPath = GLib.getenv('XDG_CONFIG_HOME');
        if (configPath == null)
            configPath = GLib.get_home_dir() + "/.config";
        return configPath;
    }
    NextLocation(currentLoc) {
        services_1.Logger.Debug("Current location: " + JSON.stringify(currentLoc, null, 2));
        if (this.locations.length == 0)
            return currentLoc;
        let nextIndex = null;
        if (this.InStorage(currentLoc)) {
            nextIndex = this.FindIndex(currentLoc) + 1;
            services_1.Logger.Debug("Current location found in storage at index " + (nextIndex - 1).toString() + ", moving to the next index");
        }
        else {
            nextIndex = this.currentIndex++;
        }
        if (nextIndex > this.locations.length - 1) {
            nextIndex = 0;
            services_1.Logger.Debug("Reached end of storage, move to the beginning");
        }
        services_1.Logger.Debug("Switching to index " + nextIndex.toString() + "...");
        this.currentIndex = nextIndex;
        return {
            address_string: this.locations[nextIndex].address_string,
            country: this.locations[nextIndex].country,
            city: this.locations[nextIndex].city,
            entryText: this.locations[nextIndex].entryText,
            lat: this.locations[nextIndex].lat,
            lon: this.locations[nextIndex].lon,
            mobile: this.locations[nextIndex].mobile,
            timeZone: this.locations[nextIndex].timeZone,
            locationSource: this.locations[nextIndex].locationSource,
        };
    }
    PreviousLocation(currentLoc) {
        if (this.locations.length == 0)
            return currentLoc;
        if (this.locations.length == 0)
            return currentLoc;
        let previousIndex = null;
        if (this.InStorage(currentLoc)) {
            previousIndex = this.FindIndex(currentLoc) - 1;
            services_1.Logger.Debug("Current location found in storage at index " + (previousIndex + 1).toString() + ", moving to the next index");
        }
        else {
            previousIndex = this.currentIndex--;
        }
        if (previousIndex < 0) {
            previousIndex = this.locations.length - 1;
            services_1.Logger.Debug("Reached start of storage, move to the end");
        }
        services_1.Logger.Debug("Switching to index " + previousIndex.toString() + "...");
        this.currentIndex = previousIndex;
        return {
            address_string: this.locations[previousIndex].address_string,
            country: this.locations[previousIndex].country,
            city: this.locations[previousIndex].city,
            entryText: this.locations[previousIndex].entryText,
            lat: this.locations[previousIndex].lat,
            lon: this.locations[previousIndex].lon,
            mobile: this.locations[previousIndex].mobile,
            timeZone: this.locations[previousIndex].timeZone,
            locationSource: this.locations[previousIndex].locationSource,
        };
    }
    InStorage(loc) {
        if (loc == null)
            return false;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.lat.toString() == loc.lat.toString() && element.lon.toString() == loc.lon.toString())
                return true;
        }
        return false;
    }
    ShouldShowLocationSelectors(currentLoc) {
        let threshold = this.InStorage(currentLoc) ? 2 : 1;
        if (this.locations.length >= threshold)
            return true;
        else
            return false;
    }
    async SaveCurrentLocation(loc) {
        if (this.app.Locked()) {
            this.app.sendNotification(utils_1._("Warning") + " - " + utils_1._("Location Store"), utils_1._("You can only save correct locations when the applet is not refreshing"), true);
            return;
        }
        if (loc == null) {
            this.app.sendNotification(utils_1._("Warning") + " - " + utils_1._("Location Store"), utils_1._("You can't save an incorrect location"), true);
            return;
        }
        if (this.InStorage(loc)) {
            this.app.sendNotification(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("Location is already saved"), true);
            return;
        }
        this.locations.push(loc);
        this.currentIndex = this.locations.length - 1;
        this.InvokeStorageChanged();
        await this.SaveToFile();
        this.app.sendNotification(utils_1._("Success") + " - " + utils_1._("Location Store"), utils_1._("Location is saved to library"), true);
    }
    async DeleteCurrentLocation(loc) {
        if (this.app.Locked()) {
            this.app.sendNotification(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("You can't remove a location while the applet is refreshing"), true);
            return;
        }
        if (loc == null) {
            this.app.sendNotification(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("You can't remove an incorrect location"), true);
            return;
        }
        if (!this.InStorage(loc)) {
            this.app.sendNotification(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("Location is not in storage, can't delete"), true);
            return;
        }
        let index = this.FindIndex(loc);
        this.locations.splice(index, 1);
        this.currentIndex = this.currentIndex--;
        if (this.currentIndex < 0)
            this.currentIndex = this.locations.length - 1;
        if (this.currentIndex < 0)
            this.currentIndex = 0;
        this.app.sendNotification(utils_1._("Success") + " - " + utils_1._("Location Store"), utils_1._("Location is deleted from library"), true);
        this.InvokeStorageChanged();
    }
    InvokeStorageChanged() {
        if (this.StoreChanged == null)
            return;
        this.StoreChanged(this.locations.length);
    }
    async LoadSavedLocations() {
        let content = null;
        try {
            content = await this.LoadContents(this.file);
        }
        catch (e) {
            let error = e;
            if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                services_1.Logger.Print("Location store does not exist, skipping loading...");
                return true;
            }
            services_1.Logger.Error("Can't load locations.json, error: " + error.message);
            return false;
        }
        if (content == null)
            return false;
        try {
            let locations = JSON.parse(content);
            this.locations = locations;
            services_1.Logger.Print("Saved locations are loaded in from location store at: '" + this.path + "'");
            services_1.Logger.Debug("Locations loaded: " + JSON.stringify(this.locations, null, 2));
            this.InvokeStorageChanged();
            return true;
        }
        catch (e) {
            services_1.Logger.Error("Error loading locations from store: " + e.message);
            this.app.sendNotification(utils_1._("Error") + " - " + utils_1._("Location Store"), utils_1._("Failed to load in data from location storage, please see the logs for more information"));
            return false;
        }
    }
    async SaveToFile() {
        let writeFile = (await this.OverwriteAndGetIOStream(this.file)).get_output_stream();
        await this.WriteAsync(writeFile, JSON.stringify(this.locations, null, 2));
        await this.CloseStream(writeFile);
    }
    FindIndex(loc) {
        if (loc == null)
            return -1;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.lat.toString() == loc.lat.toString() && element.lon.toString() == loc.lon.toString())
                return index;
        }
        return -1;
    }
    async GetFileInfo(file) {
        return new Promise((resolve, reject) => {
            file.query_info_async("", Gio.FileQueryInfoFlags.NONE, null, null, (obj, res) => {
                let result = file.query_info_finish(res);
                resolve(result);
                return result;
            });
        });
    }
    async FileExists(file, dictionary = false) {
        try {
            return file.query_exists(null);
        }
        catch (e) {
            services_1.Logger.Error("Cannot get file info for '" + file.get_path() + "', error: ");
            global.log(e);
            return false;
        }
    }
    async LoadContents(file) {
        return new Promise((resolve, reject) => {
            file.load_contents_async(null, (obj, res) => {
                let result, contents = null;
                try {
                    [result, contents] = file.load_contents_finish(res);
                }
                catch (e) {
                    reject(e);
                    return e;
                }
                if (result != true) {
                    resolve(null);
                    return null;
                }
                if (contents instanceof Uint8Array)
                    contents = ByteArray.toString(contents);
                resolve(contents.toString());
                return contents.toString();
            });
        });
    }
    async DeleteFile(file) {
        let result = await new Promise((resolve, reject) => {
            file.delete_async(null, null, (obj, res) => {
                let result = null;
                try {
                    result = file.delete_finish(res);
                }
                catch (e) {
                    let error = e;
                    if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                        resolve(true);
                        return true;
                    }
                    services_1.Logger.Error("Can't delete file, reason: ");
                    global.log(e);
                    resolve(false);
                    return false;
                }
                resolve(result);
                return result;
            });
        });
        return result;
    }
    async OverwriteAndGetIOStream(file) {
        if (!this.FileExists(file.get_parent()))
            file.get_parent().make_directory_with_parents(null);
        return new Promise((resolve, reject) => {
            file.replace_readwrite_async(null, false, Gio.FileCreateFlags.NONE, null, null, (source_object, result) => {
                let ioStream = file.replace_readwrite_finish(result);
                resolve(ioStream);
                return ioStream;
            });
        });
    }
    async WriteAsync(outputStream, buffer) {
        let text = ByteArray.fromString(buffer);
        if (outputStream.is_closed())
            return false;
        return new Promise((resolve, reject) => {
            outputStream.write_bytes_async(text, null, null, (obj, res) => {
                let ioStream = outputStream.write_bytes_finish(res);
                resolve(true);
                return true;
            });
        });
    }
    async CloseStream(stream) {
        return new Promise((resolve, reject) => {
            stream.close_async(null, null, (obj, res) => {
                let result = stream.close_finish(res);
                resolve(result);
                return result;
            });
        });
    }
}
exports.LocationStore = LocationStore;
