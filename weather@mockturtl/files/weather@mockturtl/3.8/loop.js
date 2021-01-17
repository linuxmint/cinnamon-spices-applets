"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherLoop = void 0;
const services_1 = require("./services");
const utils_1 = require("./utils");
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
var weatherAppletGUIDs = {};
class WeatherLoop {
    constructor(app, instanceID) {
        this.lastUpdated = new Date(0);
        this.pauseRefresh = false;
        this.LOOP_INTERVAL = 15;
        this.appletRemoved = false;
        this.errorCount = 0;
        this.app = app;
        this.instanceID = instanceID;
        this.GUID = uuidv4();
        weatherAppletGUIDs[instanceID] = this.GUID;
    }
    IsDataTooOld() {
        if (!this.lastUpdated)
            return true;
        let oldDate = this.lastUpdated;
        oldDate.setMinutes(oldDate.getMinutes() + (this.app.config._refreshInterval * 2));
        return (this.lastUpdated > oldDate);
    }
    async Start() {
        while (true) {
            try {
                if (this.IsStray())
                    return;
                if (this.app.encounteredError == true)
                    this.IncrementErrorCount();
                this.ValidateLastUpdate();
                if (this.pauseRefresh) {
                    services_1.Logger.Debug("Configuration error, updating paused");
                    await utils_1.delay(this.LoopInterval());
                    continue;
                }
                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    services_1.Logger.Debug("Refresh triggered in main loop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    let state = await this.app.refreshWeather(false);
                    if (state == "locked")
                        services_1.Logger.Print("App is currently refreshing, refresh skipped in main loop");
                    if (state == "success" || state == "locked")
                        this.lastUpdated = new Date();
                }
                else {
                    services_1.Logger.Debug("No need to update yet, skipping");
                }
            }
            catch (e) {
                services_1.Logger.Error("Error in Main loop: " + e);
                this.app.encounteredError = true;
            }
            await utils_1.delay(this.LoopInterval());
        }
    }
    ;
    IsStray() {
        if (this.appletRemoved == true)
            return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            services_1.Logger.Debug("Applet GUID: " + this.GUID);
            services_1.Logger.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            services_1.Logger.Print("GUID mismatch, terminating applet");
            return true;
        }
        return false;
    }
    IncrementErrorCount() {
        this.app.encounteredError = false;
        this.errorCount++;
        services_1.Logger.Debug("Encountered error in previous loop");
        if (this.errorCount > 60)
            this.errorCount = 60;
    }
    NextUpdate() {
        return new Date(this.lastUpdated.getTime() + this.app.config._refreshInterval * 60000);
    }
    ValidateLastUpdate() {
        if (this.lastUpdated > new Date())
            this.lastUpdated = new Date(0);
    }
    LoopInterval() {
        return (this.errorCount > 0) ? this.LOOP_INTERVAL * this.errorCount * 1000 : this.LOOP_INTERVAL * 1000;
    }
    Stop() {
        this.appletRemoved = true;
    }
    Pause() {
        this.pauseRefresh = true;
    }
    Resume() {
        this.pauseRefresh = false;
    }
    ResetErrorCount() {
        this.errorCount = 0;
    }
    GetSecondsUntilNextRefresh() {
        return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    }
}
exports.WeatherLoop = WeatherLoop;
