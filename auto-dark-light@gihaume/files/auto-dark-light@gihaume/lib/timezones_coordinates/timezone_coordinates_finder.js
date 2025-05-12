const {Gio} = imports.gi;

/** A finder of timezone's city coordinates using a local database. */
module.exports = class Timezone_coordinates_finder {
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

        this.#database = JSON.parse(new TextDecoder().decode(contents)); // can throw
    }

    /**
     * Gets the latitude and longitude of the timezone's city.
     * @param {string} timezone - The timezone to get the coordinates from.
     * @returns {[number, number]} The system timezone's city latitude and longitude.
     */
    find_coordinates(timezone) {
        return this.#database[timezone];
    }
}
