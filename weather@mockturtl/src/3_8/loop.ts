import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { RefreshState } from "./types";
import { delay, Guid } from "./utils";

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
        this.GUID = Guid();
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
                    Log.Instance.Debug("Configuration error, updating paused")
                    await delay(this.LoopInterval());
                    continue;
                }

                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    Log.Instance.Debug("Refresh triggered in main loop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    // loop can skip 1 cycle if needed 
                    let state = await this.app.RefreshWeather(false);
                    if (state == RefreshState.Error) Log.Instance.Print("App is currently refreshing, refresh skipped in main loop");
                    if (state == RefreshState.Success || RefreshState.Locked) this.lastUpdated = new Date();
                }
                else {
                    Log.Instance.Debug("No need to update yet, skipping")
                }
            } catch (e) {
                Log.Instance.Error("Error in Main loop: " + e);
                this.app.encounteredError = true;
            }

            await delay(this.LoopInterval());
        }
    };

    /** Stops loop. If called, the loop cannot be started again. */
    public Stop(): void {
        this.appletRemoved = true;
    }

    /** Pauses periodic refreshing of weather data. */
    public Pause(): void {
        this.pauseRefresh = true;
    }

    /** Resumes periodic refreshing, call after Pause. */
    public Resume(): void {
        this.pauseRefresh = false;
    }

    /** Used after a successful weather refresh. */
    public ResetErrorCount(): void {
        this.errorCount = 0;
    }

    /** Gets how many seconds are between the last and next refresh. */
    public GetSecondsUntilNextRefresh(): number {
        return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    }

    private IsStray(): boolean {
        if (this.appletRemoved == true) return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            Log.Instance.Debug("Applet GUID: " + this.GUID);
            Log.Instance.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            Log.Instance.Print("GUID mismatch, terminating applet")
            return true;
        }
        return false;
    }

    private IncrementErrorCount(): void {
        this.app.encounteredError = false;
        this.errorCount++;
        Log.Instance.Debug("Encountered error in previous loop");
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
}

type GUIDStore = {
    [key: number]: string
}