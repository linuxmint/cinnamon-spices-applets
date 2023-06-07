import { Config } from "../config";
import { Event } from "../lib/events";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { NotificationService } from "../lib/notification_service";
import { LocationData } from "../types";
import { ValidTimezone, _ } from "../utils";
import { DateTime } from "luxon";
export class LocationStore {
	private locations: LocationData[] = [];
	private app: WeatherApplet;
	private config: Config;

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
		// currently displayed position's changed
		// even tho this seems to happen automatically,
		// probably because I'm using object references somewhere
		else if (newIndex != currentIndex)
			this.currentIndex = newIndex

		let tmp: LocationData[] = [];
		this.locations = locs.concat(tmp);

		if (currentlyDisplayedChanged || currentlyDisplayedDeleted) {
			Logger.Debug("Currently used location was changed or deleted from locationstore, triggering refresh.")
			this.app.Refresh();
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
		const index = this.FindIndex(loc);
		if (index == -1) return false;

		this.currentIndex = index;
		return true;
	}

	/**
	 * Tries to find a location in storage based on the entryText
	 * @param entryText
	 */
	public FindLocation(entryText: string): LocationData | null {
		for (const location of this.locations) {
			if (location.entryText == entryText)
				return {
					country: location.country,
					city: location.city,
					entryText: location.entryText,
					lat: location.lat,
					lon: location.lon,
					timeZone: this.NormalizeTZ(location.timeZone),
				};
		}
		return null;
	}

	private NormalizeTZ(tz: string): string {
		const valid = ValidTimezone(tz) ? tz : DateTime.local().zoneName;
		if (!valid)
			Logger.Info(`Timezone '${tz}' is not valid for saved location, switching for local tz '${DateTime.local().zoneName}'`)
		return valid;
	}

	private EnsureSearchEntry(loc: LocationData): LocationData {
		if (!loc.entryText)
			loc.entryText = `${loc.lat},${loc.lon}`;

		return loc;
	}

	/** Only gets the location, if you want to switch between locations, use
	 * Config.SwitchToNextLocation function
	 */
	public GetNextLocation(currentLoc: LocationData | null): LocationData | null {
		if (currentLoc == null)
			return null;

		Logger.Debug("Current location: " + JSON.stringify(currentLoc, null, 2));
		if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
		let nextIndex = null;
		if (this.InStorage(currentLoc)) { // if location is stored move to the one next to it
			nextIndex = this.FindIndex(currentLoc) + 1;
			Logger.Debug("Current location found in storage at index " + (nextIndex - 1).toString() + ", moving to the next index")
		}
		else { // move to the location next to the last used location
			nextIndex = this.currentIndex++;
		}

		// Rotate if reached end of array
		if (nextIndex > this.locations.length - 1) {
			nextIndex = 0;
			Logger.Debug("Reached end of storage, move to the beginning")
		}

		Logger.Debug("Switching to index " + nextIndex.toString() + "...");
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
	public GetPreviousLocation(currentLoc: LocationData | null): LocationData | null {
		if (currentLoc == null)
			return null;

		if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
		let previousIndex = null;
		if (this.InStorage(currentLoc)) { // if location is stored move to the previous one
			previousIndex = this.FindIndex(currentLoc) - 1;
			Logger.Debug("Current location found in storage at index " + (previousIndex + 1).toString() + ", moving to the next index")
		}
		else { // move to the location previous to the last used location
			previousIndex = this.currentIndex--;
		}

		// Rotate if reached end of array
		if (previousIndex < 0) {
			previousIndex = this.locations.length - 1;
			Logger.Debug("Reached start of storage, move to the end")
		}

		Logger.Debug("Switching to index " + previousIndex.toString() + "...");
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

	public ShouldShowLocationSelectors(currentLoc: LocationData | null): boolean {
		if (currentLoc == null)
			return false;

		const threshold = this.InStorage(currentLoc) ? 2 : 1;
		if (this.locations.length >= threshold)
			return true;
		else
			return false;
	}

	public async SaveCurrentLocation(loc: LocationData | null) {
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
		// Save tz if it exists
		if (this.app.config.Timezone)
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

	private FindIndex(loc: LocationData | null, locations: LocationData[] | null = null): number {
		if (loc == null) return -1;
		if (locations == null) locations = this.locations
		for (const [index, element] of locations.entries()) {
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
		let key: keyof LocationData;
		for (key in newLoc) {
			if (oldLoc[key] != newLoc[key]) {
				return false
			}
		}
		return true;
	}
}