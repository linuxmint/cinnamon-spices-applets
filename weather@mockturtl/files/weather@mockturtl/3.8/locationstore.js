"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationStore = void 0;
const events_1 = require("./events");
const io_lib_1 = require("./io_lib");
const logger_1 = require("./logger");
const notification_service_1 = require("./notification_service");
const utils_1 = require("./utils");
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
class LocationStore {
    constructor(app) {
        this.path = null;
        this.file = null;
        this.locations = [];
        this.app = null;
        this.currentIndex = 0;
        this.StoreChanged = new events_1.Event();
        this.app = app;
        this.path = this.GetConfigPath() + "/weather-mockturtl/locations.json";
        logger_1.Log.Instance.Debug("location store path is: " + this.path);
        this.file = Gio.File.new_for_path(this.path);
        this.LoadSavedLocations();
    }
    SwitchToLocation(loc) {
        let index = this.FindIndex(loc);
        if (index == -1)
            return false;
        this.currentIndex = index;
    }
    FindLocation(entryText) {
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.entryText == entryText)
                return {
                    address_string: element.address_string,
                    country: element.country,
                    city: element.city,
                    entryText: element.entryText,
                    lat: element.lat,
                    lon: element.lon,
                    mobile: element.mobile,
                    timeZone: element.timeZone,
                    locationSource: element.locationSource,
                };
        }
        return null;
    }
    GetNextLocation(currentLoc) {
        logger_1.Log.Instance.Debug("Current location: " + JSON.stringify(currentLoc, null, 2));
        if (this.locations.length == 0)
            return currentLoc;
        let nextIndex = null;
        if (this.InStorage(currentLoc)) {
            nextIndex = this.FindIndex(currentLoc) + 1;
            logger_1.Log.Instance.Debug("Current location found in storage at index " + (nextIndex - 1).toString() + ", moving to the next index");
        }
        else {
            nextIndex = this.currentIndex++;
        }
        if (nextIndex > this.locations.length - 1) {
            nextIndex = 0;
            logger_1.Log.Instance.Debug("Reached end of storage, move to the beginning");
        }
        logger_1.Log.Instance.Debug("Switching to index " + nextIndex.toString() + "...");
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
    GetPreviousLocation(currentLoc) {
        if (this.locations.length == 0)
            return currentLoc;
        if (this.locations.length == 0)
            return currentLoc;
        let previousIndex = null;
        if (this.InStorage(currentLoc)) {
            previousIndex = this.FindIndex(currentLoc) - 1;
            logger_1.Log.Instance.Debug("Current location found in storage at index " + (previousIndex + 1).toString() + ", moving to the next index");
        }
        else {
            previousIndex = this.currentIndex--;
        }
        if (previousIndex < 0) {
            previousIndex = this.locations.length - 1;
            logger_1.Log.Instance.Debug("Reached start of storage, move to the end");
        }
        logger_1.Log.Instance.Debug("Switching to index " + previousIndex.toString() + "...");
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
    ShouldShowLocationSelectors(currentLoc) {
        let threshold = this.InStorage(currentLoc) ? 2 : 1;
        if (this.locations.length >= threshold)
            return true;
        else
            return false;
    }
    async SaveCurrentLocation(loc) {
        if (this.app.Locked()) {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Warning") + " - " + utils_1._("Location Store"), utils_1._("You can only save correct locations when the applet is not refreshing"), true);
            return;
        }
        if (loc == null) {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Warning") + " - " + utils_1._("Location Store"), utils_1._("You can't save an incorrect location"), true);
            return;
        }
        if (this.InStorage(loc)) {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("Location is already saved"), true);
            return;
        }
        this.locations.push(loc);
        this.currentIndex = this.locations.length - 1;
        this.InvokeStorageChanged();
        await this.SaveToFile();
        notification_service_1.NotificationService.Instance.Send(utils_1._("Success") + " - " + utils_1._("Location Store"), utils_1._("Location is saved to library"), true);
    }
    async DeleteCurrentLocation(loc) {
        if (this.app.Locked()) {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("You can't remove a location while the applet is refreshing"), true);
            return;
        }
        if (loc == null) {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("You can't remove an incorrect location"), true);
            return;
        }
        if (!this.InStorage(loc)) {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Info") + " - " + utils_1._("Location Store"), utils_1._("Location is not in storage, can't delete"), true);
            return;
        }
        let index = this.FindIndex(loc);
        this.locations.splice(index, 1);
        this.currentIndex = this.currentIndex--;
        if (this.currentIndex < 0)
            this.currentIndex = this.locations.length - 1;
        if (this.currentIndex < 0)
            this.currentIndex = 0;
        notification_service_1.NotificationService.Instance.Send(utils_1._("Success") + " - " + utils_1._("Location Store"), utils_1._("Location is deleted from library"), true);
        this.InvokeStorageChanged();
    }
    GetConfigPath() {
        let configPath = GLib.getenv('XDG_CONFIG_HOME');
        if (configPath == null)
            configPath = GLib.get_home_dir() + "/.config";
        return configPath;
    }
    InvokeStorageChanged() {
        this.StoreChanged.Invoke(this, this.locations.length);
    }
    async LoadSavedLocations() {
        let content = null;
        try {
            content = await io_lib_1.LoadContents(this.file);
        }
        catch (e) {
            let error = e;
            if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                logger_1.Log.Instance.Print("Location store does not exist, skipping loading...");
                return true;
            }
            logger_1.Log.Instance.Error("Can't load locations.json, error: " + error.message);
            return false;
        }
        if (content == null)
            return false;
        try {
            let locations = JSON.parse(content);
            this.locations = locations;
            logger_1.Log.Instance.Print("Saved locations are loaded in from location store at: '" + this.path + "'");
            logger_1.Log.Instance.Debug("Locations loaded: " + JSON.stringify(this.locations, null, 2));
            this.InvokeStorageChanged();
            return true;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Error loading locations from store: " + e.message);
            notification_service_1.NotificationService.Instance.Send(utils_1._("Error") + " - " + utils_1._("Location Store"), utils_1._("Failed to load in data from location storage, please see the logs for more information"));
            return false;
        }
    }
    async SaveToFile() {
        let writeFile = (await io_lib_1.OverwriteAndGetIOStream(this.file)).get_output_stream();
        await io_lib_1.WriteAsync(writeFile, JSON.stringify(this.locations, null, 2));
        await io_lib_1.CloseStream(writeFile);
    }
    InStorage(loc) {
        return this.FindIndex(loc) != -1;
    }
    FindIndex(loc) {
        if (loc == null)
            return -1;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.entryText == loc.entryText)
                return index;
        }
        return -1;
    }
}
exports.LocationStore = LocationStore;
