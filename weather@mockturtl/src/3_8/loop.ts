import { Logger } from "./lib/services/logger";
import type { WeatherApplet } from "./main";
import type { LocationData} from "./types";
import { RefreshState } from "./types";
import { _, delay, Guid } from "./utils";
const { NetworkMonitor, NetworkConnectivity } = imports.gi.Gio;

/** Stores applet instance's ID's globally,
 * Checked to make sure that instance is
 * running for one applet ID
 */
const weatherAppletGUIDs: GUIDStore = {};


export interface RefreshOptions {
	/** default false */
	rebuild?: boolean,
	/**
	 *  default undefined
	 */
	location?: LocationData | undefined,
	/**
	 * default true
	 */
	immediate?: boolean
}

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

	private runningRefresh: imports.gi.Gio.Cancellable | null = null;

	private refreshingResolver: (() => void) | null = null;
	private refreshing: Promise<void> | null = null;
	public get Refreshing(): Promise<void> {
		if (this.refreshing == null)
			return Promise.resolve();

		return this.refreshing;
	}

	private get Online(): boolean {
		return NetworkMonitor.get_default().connectivity != NetworkConnectivity.LOCAL;
	}

	constructor(app: WeatherApplet, instanceID: number) {
		this.app = app;
		this.instanceID = instanceID;
		this.GUID = Guid();
		weatherAppletGUIDs[instanceID] = this.GUID;
		NetworkMonitor.get_default().connect("notify::connectivity", this.OnNetworkConnectivityChanged);
	}

	public IsDataTooOld(): boolean {
		if (!this.lastUpdated) return true;
		const oldDate = this.lastUpdated;
		// If data is at least twice as old as refreshInterval, return true
		oldDate.setMinutes(oldDate.getMinutes() + (this.app.config._refreshInterval * 2));
		return (this.lastUpdated > oldDate);
	}

	private OnNetworkConnectivityChanged = () => {
		switch (NetworkMonitor.get_default().connectivity) {
			case NetworkConnectivity.FULL:
			case NetworkConnectivity.LIMITED:
			case NetworkConnectivity.PORTAL: {
				const name =
					NetworkMonitor.get_default().connectivity == NetworkConnectivity.FULL ? "FULL" :
					(NetworkMonitor.get_default().connectivity == NetworkConnectivity.LIMITED ? "LIMITED"
					: "PORTAL");

				Logger.Info(`Internet access "${name} (${NetworkMonitor.get_default().connectivity})" now available, initiating refresh.`);
				this.Resume();
				break;
			}
			case NetworkConnectivity.LOCAL:
				Logger.Info(`Internet access now down with "${NetworkMonitor.get_default().connectivity}".`);
				break;
		}
	}

	/** Main loop */
	public async Start(): Promise<void> {
		Logger.Info("Main Loop started.")
		while (true) {
			if (this.IsStray()) {
				Logger.Info("Applet removed, stopping loop.")
				return;
			}
			await this.DoCheck({immediate: false});
			await delay(this.LoopInterval());
		}
		Logger.Error("Main Loop stopped.")
	};

	private DoCheck = async (options: RefreshOptions = {}) => {
		Logger.Debug("Main loop check started.");
		if (this.IsStray())
			return;

		const {
			rebuild = false,
			location = null,
			immediate = true
		} = options;

		if (!this.Online) {
			Logger.Info("No network connection, skipping this cycle.");
			return;
		}

		// We are in the middle of an update, just skip
		if (this.runningRefresh && !immediate) {
			Logger.Debug("Refresh in progress and this request is not forced, skipping cycle.")
			return;
		}

		try {
			this.runningRefresh?.cancel();
			this.runningRefresh = new imports.gi.Gio.Cancellable();
			this.refreshing = new Promise<void>((resolve) => {
				this.refreshingResolver = resolve;
			});

			this.ValidateLastUpdateTime();

			if (this.pauseRefresh) {
				Logger.Debug("Configuration or network error, updating paused")
				return;
			}

			const needToUpdate = this.errorCount > 0 || this.NextUpdate() < new Date();
			if (!needToUpdate && !immediate) {
				Logger.Debug("No need to update yet, skipping.")
				return;
			}


			Logger.Debug("Refresh triggered in main loop with these values: lastUpdated " + this.lastUpdated.toLocaleString()
				+ ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
				+ " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");


			const state = await Promise.race([
				this.app["RefreshWeather"](rebuild, location, this.runningRefresh),
				delay(30000).then(() => null)
			]);

			switch (state) {
				case null:
					Logger.Info("Refreshing timed out, skipping this cycle.");
					break;
				case RefreshState.Error:
				case RefreshState.DisplayFailure:
					this.IncrementErrorCount();
					Logger.Info("Critical Error while refreshing weather.");
					break;
				case RefreshState.Success:
					this.ResetErrorCount();
					this.lastUpdated = new Date();
					Logger.Info("Weather Information refreshed");
					break;
				case RefreshState.NoLocation:
					this.IncrementErrorCount();
					this.app.ShowError({
						type: "hard",
						detail: "no location",
						userError: true,
						message: _("Make sure you entered a location or use Automatic location instead.")
					});
					break;
				case RefreshState.NoWeather:
					Logger.Error("Could not refresh weather, data could not be obtained.");
					this.app.ShowError({
						type: "soft",
						detail: "no api response",
						message: "API did not return data"
					})
					break;
				case RefreshState.NoKey:
					Logger.Error("No API Key given");
					this.Pause();
					this.app.ShowError({
						type: "hard",
						userError: true,
						detail: "no key",
						message: _("This provider requires an API key to operate")
					});
					break;
			}

		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("Error in Main loop: " + e.message, e);
		}
		finally {
			this.refreshingResolver?.();
			this.refreshingResolver = null;
			this.runningRefresh?.cancel();
			this.runningRefresh = null;
		}
	}

	/** Stops loop. If called, the loop cannot be started again. */
	public Stop(): void {
		this.appletRemoved = true;
	}

	/** Pauses periodic refreshing of weather data. */
	public Pause(): void {
		this.pauseRefresh = true;
	}

	public Resume(): void {
		this.pauseRefresh = false;
		void this.DoCheck({immediate: true});
	}

	/**
	 * Will Resume the loop and immediately call for a refresh check.
	 * @param options
	 * @returns
	 */
	public async Refresh(options?: RefreshOptions): Promise<void> {
		this.pauseRefresh = false;
		await this.DoCheck(options);
	}

	/** Used after a successful weather refresh. */
	private ResetErrorCount(): void {
		this.errorCount = 0;
	}

	/** Gets how many seconds are between the last and next refresh. */
	public GetSecondsUntilNextRefresh(): number {
		return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
	}

	private IsStray(): boolean {
		if (this.appletRemoved == true) return true;
		if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
			Logger.Debug("Applet GUID: " + this.GUID);
			Logger.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
			Logger.Info("GUID mismatch, terminating applet")
			return true;
		}
		return false;
	}

	private IncrementErrorCount(): void {
		this.errorCount++;
		Logger.Debug("Encountered error in previous loop");
		// Limiting count so timeout does not expand forever
		if (this.errorCount > 60)
			this.errorCount = 60;
	}

	private NextUpdate(): Date {
		return new Date(this.lastUpdated.getTime() + this.app.config._refreshInterval * 60000);
	}

	/**
	 * On timezone changes for the system it can occur that the lastUpdated timestamp
	 * moves to the future (when switching back an hour on DST boundary).
	 *
	 * In that case we invalidate the timestamp because it's not trustworthy.
	 * Keeping it would mean there is a chance we don't update for an hour or more.
	 */
	private ValidateLastUpdateTime(): void {
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