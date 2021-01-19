// TODO: Switch to setting-schema based LocationStore as soon as 3.0 id Deprecated
// TODO: Make internal persistent setting when switching to location store entries and back
// Example schema entry:

import { CloseStream, LoadContents, OverwriteAndGetIOStream, WriteAsync } from "./io_lib";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { NotificationService } from "./notification_service";
import { LocationData } from "./types";
import { _ } from "./utils";

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

/*"location-list": {
		"type" : "list",
		"description" : "Your saved locations",
		"columns" : [
			{"id": "lat", "title": "Latitude", "type": "string"},
			{"id": "lon", "title": "Longitude", "type": "string"},
			{"id": "city", "title": "City", "type": "string"},
			{"id": "country", "title": "Country", "type": "string"},
			{"id": "address_string", "title": "Full Address", "type": "string", "default": ""},
			{"id": "entryText", "title": "Text in location entry", "type": "string", "default": ""},
			{"id": "timeZone", "title": "Timezone", "type": "string", "default": ""}
		],
		"default" : []
	},
*/
export class LocationStore {

    path: string = null; // ~/.config/weather-mockturtl/locations.json
    private file: imports.gi.Gio.File = null;
    private locations: LocationData[] = [];
    private app: WeatherApplet = null;

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
    private StoreChanged: (storeItemCount: number) => void = null;

	/**
	 * 
	 * @param path to storage file
	 * @param app 
	 * @param onStoreChanged called when locations are loaded from file, added or deleted
	 */
    constructor(app: WeatherApplet, onStoreChanged?: (itemCount: number) => void) {
        this.app = app;

        this.path = this.GetConfigPath() + "/weather-mockturtl/locations.json"
        Log.Instance.Debug("location store path is: " + this.path);
        this.file = Gio.File.new_for_path(this.path);
        if (onStoreChanged != null) this.StoreChanged = onStoreChanged;
        this.LoadSavedLocations();
    }

    private GetConfigPath(): string {
        let configPath = GLib.getenv('XDG_CONFIG_HOME')
        if (configPath == null) configPath = GLib.get_home_dir() + "/.config"
        return configPath;
	}
	
	public SwitchToLocation(loc: LocationData): boolean {
		let index = this.FindIndex(loc);
		if (index == -1) return false;

		this.currentIndex = index;
	}

    public NextLocation(currentLoc: LocationData): LocationData {
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
            address_string: this.locations[nextIndex].address_string,
            country: this.locations[nextIndex].country,
            city: this.locations[nextIndex].city,
            entryText: this.locations[nextIndex].entryText,
            lat: this.locations[nextIndex].lat,
            lon: this.locations[nextIndex].lon,
            mobile: this.locations[nextIndex].mobile,
            timeZone: this.locations[nextIndex].timeZone,
            locationSource: this.locations[nextIndex].locationSource,
        }
    }

    public PreviousLocation(currentLoc: LocationData): LocationData {
        if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
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

    public ShouldShowLocationSelectors(currentLoc: LocationData): boolean {
        let threshold = this.InStorage(currentLoc) ? 2 : 1;
        if (this.locations.length >= threshold) return true;
        else return false;
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
        this.locations.push(loc);
        this.currentIndex = this.locations.length - 1; // head to saved location
        this.InvokeStorageChanged();
        await this.SaveToFile();
        NotificationService.Instance.Send(_("Success") + " - " + _("Location Store"), _("Location is saved to library"), true);

    }

    public async DeleteCurrentLocation(loc: LocationData) {
        if (this.app.Locked()) {
            NotificationService.Instance.Send(_("Info") + " - " + _("Location Store"), _("You can't remove a location while the applet is refreshing"), true);
            return;
        }
        if (loc == null) {
            NotificationService.Instance.Send(_("Info") + " - " + _("Location Store"), _("You can't remove an incorrect location"), true);
            return;
        }

        if (!this.InStorage(loc)) {
            NotificationService.Instance.Send(_("Info") + " - " + _("Location Store"), _("Location is not in storage, can't delete"), true);
            return;
        }
        // Find location
        let index = this.FindIndex(loc);
        this.locations.splice(index, 1);
        // Go to to previous saved location
        this.currentIndex = this.currentIndex--;
        if (this.currentIndex < 0) this.currentIndex = this.locations.length - 1; // reached start of array
        if (this.currentIndex < 0) this.currentIndex = 0; // no items in array
        NotificationService.Instance.Send(_("Success") + " - " + _("Location Store"), _("Location is deleted from library"), true);
        this.InvokeStorageChanged();
    }

    private InvokeStorageChanged() {
        if (this.StoreChanged == null) return;
        this.StoreChanged(this.locations.length);
    }

    private async LoadSavedLocations(): Promise<boolean> {
        let content = null;
        try {
            content = await LoadContents(this.file);
        }
        catch(e) {
            let error: GJSError = e;
            if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                Log.Instance.Print("Location store does not exist, skipping loading...")
                return true;
            }

            Log.Instance.Error("Can't load locations.json, error: " + error.message);
            return false;
        }

        if (content == null) return false;

        try {
            let locations = JSON.parse(content) as LocationData[];
            this.locations = locations;
            Log.Instance.Print("Saved locations are loaded in from location store at: '" + this.path + "'");
            Log.Instance.Debug("Locations loaded: " + JSON.stringify(this.locations, null, 2));
            this.InvokeStorageChanged();
            return true;
        }
        catch (e) {
            Log.Instance.Error("Error loading locations from store: " + (e as Error).message);
            NotificationService.Instance.Send(_("Error") + " - " + _("Location Store"), _("Failed to load in data from location storage, please see the logs for more information"))
            return false;
        }

    }

    private async SaveToFile() {
        let writeFile = (await OverwriteAndGetIOStream(this.file)).get_output_stream();
        await WriteAsync(writeFile, JSON.stringify(this.locations, null, 2));
        await CloseStream(writeFile);
	}
	
	public InStorage(loc: LocationData): boolean {
        return this.FindIndex(loc) != -1;
    }

    private FindIndex(loc: LocationData): number {
        if (loc == null) return -1;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.entryText == loc.entryText) return index;
        }
        return -1;
	}
	
	public FindLocation(entryText: string): LocationData {
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
                }
        }
        return null;
    }
}