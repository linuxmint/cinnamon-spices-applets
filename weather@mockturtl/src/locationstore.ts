// TODO: Switch to setting-schema based LocationStore as soon as 3.0 id Deprecated
// TODO: Make internal persistent setting when switching to location store entries and back
// Example schema entry:

import { WeatherApplet } from "./main";
import { Logger } from "./services";
import { LocationData } from "./types";
import { _ } from "./utils";

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

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
	 * Current head on locationstore array.
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
        Logger.Debug("location store path is: " + this.path);
        this.file = Gio.File.new_for_path(this.path);
        if (onStoreChanged != null) this.StoreChanged = onStoreChanged;
        this.LoadSavedLocations();
    }

    private GetConfigPath(): string {
        let configPath = GLib.getenv('XDG_CONFIG_HOME')
        if (configPath == null) configPath = GLib.get_home_dir() + "/.config"
        return configPath;
    }

    public NextLocation(currentLoc: LocationData): LocationData {
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
        // Return copy, not original so nothing interferes with filestore
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

    public InStorage(loc: LocationData): boolean {
        if (loc == null) return false;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.lat.toString() == loc.lat.toString() && element.lon.toString() == loc.lon.toString()) return true;
        }
        return false;
    }

    public ShouldShowLocationSelectors(currentLoc: LocationData): boolean {
        let threshold = this.InStorage(currentLoc) ? 2 : 1;
        if (this.locations.length >= threshold) return true;
        else return false;
    }

    public async SaveCurrentLocation(loc: LocationData) {
        if (this.app.Locked()) {
            this.app.sendNotification(_("Warning") + " - " + _("Location Store"), _("You can only save correct locations when the applet is not refreshing"), true);
            return;
        }
        if (loc == null) {
            this.app.sendNotification(_("Warning") + " - " + _("Location Store"), _("You can't save an incorrect location"), true);
            return;
        }
        if (this.InStorage(loc)) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("Location is already saved"), true);
            return;
        }
        this.locations.push(loc);
        this.currentIndex = this.locations.length - 1; // head to saved location
        this.InvokeStorageChanged();
        await this.SaveToFile();
        this.app.sendNotification(_("Success") + " - " + _("Location Store"), _("Location is saved to library"), true);

    }

    public async DeleteCurrentLocation(loc: LocationData) {
        if (this.app.Locked()) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("You can't remove a location while the applet is refreshing"), true);
            return;
        }
        if (loc == null) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("You can't remove an incorrect location"), true);
            return;
        }

        if (!this.InStorage(loc)) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("Location is not in storage, can't delete"), true);
            return;
        }
        // Find location
        let index = this.FindIndex(loc);
        this.locations.splice(index, 1);
        // Go to to previous saved location
        this.currentIndex = this.currentIndex--;
        if (this.currentIndex < 0) this.currentIndex = this.locations.length - 1; // reached start of array
        if (this.currentIndex < 0) this.currentIndex = 0; // no items in array
        this.app.sendNotification(_("Success") + " - " + _("Location Store"), _("Location is deleted from library"), true);
        this.InvokeStorageChanged();
    }

    private InvokeStorageChanged() {
        if (this.StoreChanged == null) return;
        this.StoreChanged(this.locations.length);
    }

    private async LoadSavedLocations(): Promise<boolean> {
        let content = null;
        try {
            content = await this.LoadContents(this.file);
        }
        catch(e) {
            let error: GJSError = e;
            if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                Logger.Print("Location store does not exist, skipping loading...")
                return true;
            }

            Logger.Error("Can't load locations.json, error: " + error.message);
            return false;
        }

        if (content == null) return false;

        try {
            let locations = JSON.parse(content) as LocationData[];
            this.locations = locations;
            Logger.Print("Saved locations are loaded in from location store at: '" + this.path + "'");
            Logger.Debug("Locations loaded: " + JSON.stringify(this.locations, null, 2));
            this.InvokeStorageChanged();
            return true;
        }
        catch (e) {
            Logger.Error("Error loading locations from store: " + (e as Error).message);
            this.app.sendNotification(_("Error") + " - " + _("Location Store"), _("Failed to load in data from location storage, please see the logs for more information"))
            return false;
        }

    }

    private async SaveToFile() {
        let writeFile = (await this.OverwriteAndGetIOStream(this.file)).get_output_stream();
        await this.WriteAsync(writeFile, JSON.stringify(this.locations, null, 2));
        await this.CloseStream(writeFile);
    }

    private FindIndex(loc: LocationData): number {
        if (loc == null) return -1;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.lat.toString() == loc.lat.toString() && element.lon.toString() == loc.lon.toString()) return index;
        }
        return -1;
    }


    // --------------------------
    // IO
    // --------------------------

    /**
     * NOT WORKING, fileInfo completely empty atm
     * @param file 
     */
    private async GetFileInfo(file: imports.gi.Gio.File): Promise<imports.gi.Gio.FileInfo> {
        return new Promise((resolve, reject) => {
            file.query_info_async("", Gio.FileQueryInfoFlags.NONE, null, null, (obj, res) => {
                let result = file.query_info_finish(res);
                resolve(result);
                return result;
            });
        });
    }

    private async FileExists(file: imports.gi.Gio.File, dictionary: boolean = false): Promise<boolean> {
        try {
            return file.query_exists(null);
            /*// fileInfo doesn't work, don't use for now
            let info = await this.GetFileInfo(file);
            let type = info.get_size(); // type always 0
            return true;*/
        }
        catch (e) {
            Logger.Error("Cannot get file info for '" + file.get_path() + "', error: ");
            global.log(e)
            return false;
        }
    }

    /**
     * Loads contents of a file. Can throw Gio.IOErroEnum exception. (e.g file does not exist)
     * @param file 
     */
    private async LoadContents(file: imports.gi.Gio.File): Promise<string> {
        return new Promise((resolve, reject) => {
            file.load_contents_async(null, (obj, res) => {
                let result, contents = null;
                try {
                    [result, contents] = file.load_contents_finish(res);
                }
                catch(e) {
                    reject(e);
                    return e;
                }
                if (result != true) {
                    resolve(null);
                    return null;
                }
				if (contents instanceof Uint8Array) // mozjs60 future-proofing
                    contents = ByteArray.toString(contents);

                resolve(contents.toString());
                return contents.toString();
            });
        });
    }

    private async DeleteFile(file: imports.gi.Gio.File): Promise<boolean> {
        let result: boolean = await new Promise((resolve, reject) => {
            file.delete_async(null, null, (obj, res) => {
                let result = null;
                try {
                    result = file.delete_finish(res);
                }
                catch (e) {
                    let error: GJSError = e;
                    if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                        resolve(true);
                        return true;
                    }

                    Logger.Error("Can't delete file, reason: ");
                    global.log(e);
                    resolve(false);
                    return false;
                }

                resolve(result);
                return result;
            });
        });
        return result;

    }

    private async OverwriteAndGetIOStream(file: imports.gi.Gio.File): Promise<imports.gi.Gio.IOStream> {
        if (!this.FileExists(file.get_parent())) 
            file.get_parent().make_directory_with_parents(null); //don't know if this is a blocking call or not

        return new Promise((resolve, reject) => {
            file.replace_readwrite_async(null, false, Gio.FileCreateFlags.NONE, null, null, (source_object, result) => {
                let ioStream = file.replace_readwrite_finish(result);
                resolve(ioStream);
                return ioStream;
            });
        });
    }

    private async WriteAsync(outputStream: imports.gi.Gio.OutputStream, buffer: string): Promise<boolean> {
        // normal write_async can't use normal string or ByteArray.fromString
        // so we save using write_bytes_async, seem to work well.
        let text = ByteArray.fromString(buffer);
        if (outputStream.is_closed()) return false;
		
		return new Promise((resolve: any, reject: any) => {
			outputStream.write_bytes_async(text as any, null, null, (obj, res) => {
				let ioStream = outputStream.write_bytes_finish(res);
				resolve(true);
				return true;
			});
        });
    }

    private async CloseStream(stream: imports.gi.Gio.OutputStream | imports.gi.Gio.InputStream | imports.gi.Gio.FileIOStream): Promise<boolean> {
        return new Promise((resolve, reject) => {
            stream.close_async(null, null, (obj, res) => {
                let result = stream.close_finish(res);
                resolve(result);
                return result;
            });
        });
    }
}