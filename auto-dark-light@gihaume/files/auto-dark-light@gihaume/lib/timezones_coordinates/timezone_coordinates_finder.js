const {Gio, GLib} = imports.gi;

/**
 * A finder of timezone's city coordinates using a local database.
 */
class Timezone_coordinates_finder {
    #file_contents
    #database

    /**
     * @param {string} path - The absolute path where the `timezones_coordinates.json` file is located.
     * @throws {Error} - If the file cannot be loaded or JSON-parsed
     */
    constructor(path) {
        const file_path      = `${path}/database.json`,
              file           = Gio.File.new_for_path(file_path),
              [ok, contents] = file.load_contents(null);

        if (!ok)
            throw new Error(`failed to load file/contents of '${file_path}'`);

        this.#file_contents = contents;
        this.#database = JSON.parse(new TextDecoder().decode(contents)); // can throw
    }

    /**
     * Get the latitude and longitude of the timezone's city.
     * @param {string} timezone - The timezone to get the coordinates from.
     * @returns {[number, number]} The system timezone's city latitude and longitude.
     */
    find_coordinates(timezone) { return this.#database[timezone]; }

    /**
     * Declare the object as finished to release any ressource acquired.
     */
    finalize() { GLib.free(this.#file_contents); }
}

module.exports = Timezone_coordinates_finder;
