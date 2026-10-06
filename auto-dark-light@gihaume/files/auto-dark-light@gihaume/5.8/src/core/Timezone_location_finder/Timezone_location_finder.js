import Gio from 'gi://Gio';

/** @typedef {import('../../types.js').Location} Location */

/** A finder of timezone's city coordinates using a local database. */
export class Timezone_location_finder {
    /** @type {Record<string, [number, number]>} */
    _database;

    /**
     * @param {string} path - The absolute path where the `database.json` file is located.
     * @throws {Error} - If the file cannot be loaded or JSON-parsed
     */
    constructor(path) {
        const file_path = `${path}/database.json`;
        const file = Gio.File.new_for_path(file_path);
        const [ok, file_content] = file.load_contents(null);

        if (!ok)
            throw new Error(`failed to load file/contents of '${file_path}'`);

        this._database = JSON.parse(new TextDecoder().decode(file_content)); // Throws
    }

    /**
     * Gets the latitude and longitude of the timezone's city.
     * @param {string} timezone - The timezone to get the coordinates from.
     * @returns {Location} The system timezone's city coordinates.
     */
    find(timezone) {
        if (!timezone)
            throw new Error('timezone is required');
        if (!(timezone in this._database))
            throw new Error(`unknown timezone: '${timezone}'`);
        return {
            latitude: this._database[timezone][0],
            longitude: this._database[timezone][1]
        };
    }
}
