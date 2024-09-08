const SunCalc     = require('./lib/suncalc.js');
const Time_of_day = require('./lib/time_of_day.js');
const { _ }       = require('./lib/translator.js');

const GLib = imports.gi.GLib;
const DateTime = GLib.DateTime;

/**
 * A twilight times calculator of the ~current day.
 */
const Twilights_calculator = {
    /**
     * Get the twilight times of the current day.
     * @param {number} latitude  The latitude of the location.
     * @param {number} longitude The longitude of the location.
     * @returns {{sunrise: Time_of_day, sunset: Time_of_day}} The twilight times of the current day.
     * @throws {Error} If the calculation fails.
     */
    get_today(latitude, longitude) {
        const now   = DateTime.new_now_local().to_unix() * 1000, // [ms]
              dates = SunCalc.getTimes(now, latitude, longitude);

        if (isNaN(dates.sunrise) || isNaN(dates.sunset))
            throw Error(_("unable to calculate twilight times, check coordinates format or range"));

        const [sunrise, sunset] = [dates.sunrise, dates.sunset].map(date => {
            const unix_time = date.getTime() / 1000, // [s]
                  date_glib = DateTime.new_from_unix_local(unix_time);
            return new Time_of_day(date_glib);
        });

        return {sunrise, sunset};
    }
}

module.exports = Twilights_calculator;
