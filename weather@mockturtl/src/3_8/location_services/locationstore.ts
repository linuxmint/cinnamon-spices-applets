import { Config } from "config";
import { Event } from "lib/events";
import { Log } from "lib/logger";
import { WeatherApplet } from "main";
import { NotificationService } from "lib/notification_service";
import { LocationData } from "types";
import { _ } from "utils";
export class LocationStore {
	private locations: LocationData[] = [];
	private app: WeatherApplet = null;
	private config: Config = null;

	/**
	 * Current head on locationStore array.
	 * Retains position even if user changes to location
	 * not in the store. It gets moved to the end of array if user
	 * saves a new location. On deletion it moves to the next index
	 */
	private currentIndex = 0;

	/**
	 * event callback for applet when location storage is modified
	 */
	public readonly StoreChanged = new Event<LocationStore, number>();

	constructor(app: WeatherApplet, config: Config) {
		this.app = app;
		this.config = config;
		this.locations = config._locationList;
	}

	public OnLocationChanged(locs: LocationData[]) {
		// this is called 4 times in a row, try to prevent that
		if (this.app.Locked())
			return;

		// Ensure Entry text is not empty
		for (let index = 0; index < locs.length; index++) {
			const element = locs[index];
			if (!element.entryText) {
				locs[index] = this.EnsureSearchEntry(element);
			}
		}

		let currentIndex = this.FindIndex(this.config.CurrentLocation);
		let newIndex = this.FindIndex(this.config.CurrentLocation, locs);
		let currentlyDisplayedChanged = false;
		let currentlyDisplayedDeleted = false;
		// no need to do anything, not using locationstore atm
		if (newIndex == -1 && currentIndex == -1) {
			let tmp: LocationData[] = [];
			this.locations = locs.concat(tmp);
			this.InvokeStorageChanged();
			return;
		}
		else if (newIndex == currentIndex)
			currentlyDisplayedChanged = !this.IsEqual(this.locations?.[currentIndex], locs?.[currentIndex])
		else if (newIndex == -1)
			currentlyDisplayedDeleted = true;
		// currenlty displayed position's changed
		// even tho this seems to happen automatically, 
		// probably beacause I'm using object references somewhere
		else if (newIndex != currentIndex)
			this.currentIndex = newIndex

		let tmp: LocationData[] = [];
		this.locations = locs.concat(tmp);

		if (currentlyDisplayedChanged || currentlyDisplayedDeleted) {
			Log.Instance.Debug("Currently used location was changed or deleted from locationstore, triggering refresh.")
			this.app.RefreshAndRebuild()
		}
		this.InvokeStorageChanged();
	}

	/**
	 * Switch to a location if it's in storage. DOES NOT
	 * UPDATE THE CONFIG, NEVER USE IT DIRECTLY.
	 * Use Config.SwitchToNextLocation or Config.SwitchToPreviousLocation.
	 * @param loc preferably obtained from storage
	 */
	public SwitchToLocation(loc: LocationData): boolean {
		let index = this.FindIndex(loc);
		if (index == -1) return false;

		this.currentIndex = index;
	}

	/**
	 * Tries to find a location in storage based on the entryText
	 * @param entryText 
	 */
	public FindLocation(entryText: string): LocationData {
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

	private EnsureSearchEntry(loc: LocationData): LocationData {
		if (!loc.entryText)
			loc.entryText = `${loc.lat},${loc.lon}`;

		return loc;
	}

	/** Only gets the location, if you want to switch between locations, use 
	 * Config.SwitchToNextLocation function
	 */
	public GetNextLocation(currentLoc: LocationData): LocationData {
		Log.Instance.Debug("Current location: " + JSON.stringify(currentLoc, null, 2));
		if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
		let nextIndex = null;
		if (this.InStorage(currentLoc)) { // if location is stored move to the one next to it
			nextIndex = this.FindIndex(currentLoc) + 1;
			Log.Instance.Debug("Current location found in storage at index " + (nextIndex - 1).toString() + ", moving to the next index")
		}
		else { // move to the location next to the last used location
			nextIndex = this.currentIndex++;
		}

		// Rotate if reached end of array
		if (nextIndex > this.locations.length - 1) {
			nextIndex = 0;
			Log.Instance.Debug("Reached end of storage, move to the beginning")
		}

		Log.Instance.Debug("Switching to index " + nextIndex.toString() + "...");
		this.currentIndex = nextIndex;
		// Return copy, not original so nothing interferes with fileStore
		return {
			country: this.locations[nextIndex].country,
			city: this.locations[nextIndex].city,
			entryText: this.locations[nextIndex].entryText,
			lat: this.locations[nextIndex].lat,
			lon: this.locations[nextIndex].lon,
			timeZone: this.locations[nextIndex].timeZone,
		}
	}

	/** Only gets the location, if you want to switch between locations, use 
	 * Config.SwitchToPreviousLocation function
	 */
	public GetPreviousLocation(currentLoc: LocationData): LocationData {
		if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
		let previousIndex = null;
		if (this.InStorage(currentLoc)) { // if location is stored move to the previous one
			previousIndex = this.FindIndex(currentLoc) - 1;
			Log.Instance.Debug("Current location found in storage at index " + (previousIndex + 1).toString() + ", moving to the next index")
		}
		else { // move to the location previous to the last used location
			previousIndex = this.currentIndex--;
		}

		// Rotate if reached end of array
		if (previousIndex < 0) {
			previousIndex = this.locations.length - 1;
			Log.Instance.Debug("Reached start of storage, move to the end")
		}

		Log.Instance.Debug("Switching to index " + previousIndex.toString() + "...");
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

	public ShouldShowLocationSelectors(currentLoc: LocationData): boolean {
		let threshold = this.InStorage(currentLoc) ? 2 : 1;
		if (this.locations.length >= threshold)
			return true;
		else
			return false;
	}

	public async SaveCurrentLocation(loc: LocationData) {
		if (this.app.Locked()) {
			NotificationService.Instance.Send(_("Warning") + " - " + _("Location Store"), _("You can only save correct locations when the applet is not refreshing"), true);
			return;
		}
		if (loc == null) {
			NotificationService.Instance.Send(_("Warning") + " - " + _("Location Store"), _("You can't save an incorrect location"), true);
			return;
		}
		if (this.InStorage(loc)) {
			NotificationService.Instance.Send(_("Info") + " - " + _("Location Store"), _("Location is already saved"), true);
			return;
		}
		loc.timeZone = this.app.config.Timezone;
		this.locations.push(loc);
		this.currentIndex = this.locations.length - 1; // head to saved location
		this.InvokeStorageChanged();
		this.SaveBackLocations();
	}

	private InvokeStorageChanged() {
		this.StoreChanged.Invoke(this, this.locations.length);
	}

	private SaveBackLocations() {
		this.config.SetLocationList(this.locations);
	}

	private InStorage(loc: LocationData): boolean {
		return this.FindIndex(loc) != -1;
	}

	private FindIndex(loc: LocationData, locations: LocationData[] = null): number {
		if (loc == null) return -1;
		if (locations == null) locations = this.locations
		for (let index = 0; index < locations.length; index++) {
			const element = locations[index];
			if (element.entryText == loc.entryText) return index;
		}
		return -1;
	}

	/**
	 * Checks if 2 locations are completely equal
	 * @param oldLoc 
	 * @param newLoc 
	 */
	private IsEqual(oldLoc: LocationData, newLoc: LocationData): boolean {
		if (oldLoc == null)
			return false;
		if (newLoc == null)
			return false;
		for (let key in newLoc) {
			if ((oldLoc as any)[key] != (newLoc as any)[key]) {
				return false
			}
		}
		return true;
	}
}