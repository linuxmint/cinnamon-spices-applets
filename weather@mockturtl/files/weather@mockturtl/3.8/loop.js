"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherLoop = void 0;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
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
        this.GUID = utils_1.Guid();
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
                    logger_1.Log.Instance.Debug("Configuration error, updating paused");
                    await utils_1.delay(this.LoopInterval());
                    continue;
                }
                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    logger_1.Log.Instance.Debug("Refresh triggered in main loop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    let state = await this.app.RefreshWeather(false);
                    if (state == "error")
                        logger_1.Log.Instance.Print("App is currently refreshing, refresh skipped in main loop");
                    if (state == "success" || "locked")
                        this.lastUpdated = new Date();
                }
                else {
                    logger_1.Log.Instance.Debug("No need to update yet, skipping");
                }
            }
            catch (e) {
                logger_1.Log.Instance.Error("Error in Main loop: " + e);
                this.app.encounteredError = true;
            }
            await utils_1.delay(this.LoopInterval());
        }
    }
    ;
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
    IsStray() {
        if (this.appletRemoved == true)
            return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            logger_1.Log.Instance.Debug("Applet GUID: " + this.GUID);
            logger_1.Log.Instance.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            logger_1.Log.Instance.Print("GUID mismatch, terminating applet");
            return true;
        }
        return false;
    }
    IncrementErrorCount() {
        this.app.encounteredError = false;
        this.errorCount++;
        logger_1.Log.Instance.Debug("Encountered error in previous loop");
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
}
exports.WeatherLoop = WeatherLoop;
