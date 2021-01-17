import { Logger } from "./logger";
import { WeatherApplet } from "./main";
import { GUIDStore } from "./types";
import { delay } from "./utils";

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/** Stores applet instance's ID's globally,
 * Checked to make sure that instance is 
 * running for one applet ID
 */
var weatherAppletGUIDs: GUIDStore = {};

export class WeatherLoop {
    /** To check if data is up-to-date based on user-set refresh settings */
    private lastUpdated: Date = new Date(0);

	/** true on errors when user interaction is required.
	 * (usually on settings misconfiguration), every settings change clears it.
	 */
    private pauseRefresh: boolean = false;


    /** in seconds */
    private readonly LOOP_INTERVAL: number = 15;
    private app: WeatherApplet;
    private appletRemoved = false;
    private GUID: string;
    private instanceID: number;
	/** Slows main loop down on consecutive errors.
	 * loop seconds are multiplied by this value on errors.
	 */
    private errorCount: number = 0;

    constructor(app: WeatherApplet, instanceID: number) {
        this.app = app;
        this.instanceID = instanceID;
        this.GUID = uuidv4();
        weatherAppletGUIDs[instanceID] = this.GUID;
    }

    public IsDataTooOld(): boolean {
        if (!this.lastUpdated) return true;
        let oldDate = this.lastUpdated;
        // If data is at least twice as old as refreshInterval, return true
        oldDate.setMinutes(oldDate.getMinutes() + (this.app.config._refreshInterval * 2));
        return (this.lastUpdated > oldDate);
    }

    /** Main loop */
    public async Start(): Promise<void> {
        while (true) {
            try {
                if (this.IsStray()) return;
                if (this.app.encounteredError == true) this.IncrementErrorCount();
                this.ValidateLastUpdate();

                if (this.pauseRefresh) {
                    Logger.Debug("Configuration error, updating paused")
                    await delay(this.LoopInterval());
                    continue;
                }

                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    Logger.Debug("Refresh triggered in main loop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    // loop can skip 1 cycle if needed 
                    let state = await this.app.refreshWeather(false);
                    if (state == "locked") Logger.Print("App is currently refreshing, refresh skipped in main loop");
                    if (state == "success" || state == "locked") this.lastUpdated = new Date();
                }
                else {
                    Logger.Debug("No need to update yet, skipping")
                }
            } catch (e) {
                Logger.Error("Error in Main loop: " + e);
                this.app.encounteredError = true;
            }

            await delay(this.LoopInterval());
        }
    };

    private IsStray(): boolean {
        if (this.appletRemoved == true) return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            Logger.Debug("Applet GUID: " + this.GUID);
            Logger.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            Logger.Print("GUID mismatch, terminating applet")
            return true;
        }
        return false;
    }

    private IncrementErrorCount(): void {
        this.app.encounteredError = false;
        this.errorCount++;
        Logger.Debug("Encountered error in previous loop");
        // Limiting count so timeout does not expand forever
        if (this.errorCount > 60) this.errorCount = 60;
    }

    private NextUpdate(): Date {
        return new Date(this.lastUpdated.getTime() + this.app.config._refreshInterval * 60000);
    }

    private ValidateLastUpdate(): void {
        // System time was probably changed back, reset lastUpdated value
        if (this.lastUpdated > new Date()) this.lastUpdated = new Date(0);
    }

	/**
	 * @returns milliseconds
	 */
    private LoopInterval(): number {
        return (this.errorCount > 0) ? this.LOOP_INTERVAL * this.errorCount * 1000 : this.LOOP_INTERVAL * 1000; // Increase loop timeout linearly with the number of errors
    }

    public Stop(): void {
        this.appletRemoved = true;
    }

    public Pause(): void {
        this.pauseRefresh = true;
    }

    public Resume(): void {
        this.pauseRefresh = false;
    }

    public ResetErrorCount(): void {
        this.errorCount = 0;
    }

    public GetSecondsUntilNextRefresh(): number {
        return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    }
}