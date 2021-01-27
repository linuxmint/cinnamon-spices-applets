"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationStore = void 0;
const events_1 = require("./events");
const logger_1 = require("./logger");
const notification_service_1 = require("./notification_service");
const utils_1 = require("./utils");
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
class LocationStore {
    constructor(app, config) {
        this.locations = [];
        this.app = null;
        this.config = null;
        this.currentIndex = 0;
        this.StoreChanged = new events_1.Event();
        this.app = app;
        this.config = config;
        this.locations = config._locationList;
    }
    OnLocationChanged(locs) {
        var _a;
        if (this.app.Locked())
            return;
        let currentEqual = this.IsEqual((_a = this.locations) === null || _a === void 0 ? void 0 : _a[this.currentIndex], locs === null || locs === void 0 ? void 0 : locs[this.currentIndex]);
        this.locations = locs;
        if (!currentEqual)
            this.app.RefreshAndRebuild();
    }
    IsChanged(newLocs) {
        var _a;
        for (let index = 0; index < newLocs.length; index++) {
            const element = newLocs[index];
            const oldElement = (_a = this.locations) === null || _a === void 0 ? void 0 : _a[index];
            if (!this.IsEqual(oldElement, element))
                return true;
        }
        return false;
    }
    IsSelectedChanged(newLocs) {
        var _a;
        const element = newLocs === null || newLocs === void 0 ? void 0 : newLocs[this.currentIndex];
        const oldElement = (_a = this.locations) === null || _a === void 0 ? void 0 : _a[this.currentIndex];
        return !this.IsEqual(oldElement, element);
    }
    IsEqual(oldLoc, newLoc) {
        if (oldLoc == null)
            return false;
        if (newLoc == null)
            return false;
        for (let key in Object.keys(newLoc)) {
            if (oldLoc[key] != newLoc[key]) {
                global.log(oldLoc[key]);
                global.log(newLoc[key]);
                return false;
            }
        }
        return true;
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
                    country: element.country,
                    city: element.city,
                    entryText: element.entryText,
                    lat: element.lat,
                    lon: element.lon,
                    timeZone: element.timeZone,
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
            country: this.locations[nextIndex].country,
            city: this.locations[nextIndex].city,
            entryText: this.locations[nextIndex].entryText,
            lat: this.locations[nextIndex].lat,
            lon: this.locations[nextIndex].lon,
            timeZone: this.locations[nextIndex].timeZone,
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
            country: this.locations[previousIndex].country,
            city: this.locations[previousIndex].city,
            entryText: this.locations[previousIndex].entryText,
            lat: this.locations[previousIndex].lat,
            lon: this.locations[previousIndex].lon,
            timeZone: this.locations[previousIndex].timeZone,
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
    InvokeStorageChanged() {
    }
    async SaveToFile() {
        this.config.SetLocationList(this.locations);
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
