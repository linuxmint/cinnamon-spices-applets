/* global imports */
/* eslint camelcase: "off" */

const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const Utils = require("./utils");
const AppletDir = imports.ui.appletManager.appletMeta["calendar@ccprog"].path;

const MSECS_IN_DAY = 24 * 60 * 60 * 1000;

const Langinfo = Utils.getInfo("LC_ADDRESS");
const LC_LANG = Langinfo.lang_ab;

let _httpSession;
if (Soup.MAJOR_VERSION === 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else { //version 3
    _httpSession = new Soup.Session();
}

const UPDATE_PERIOD = 24 * 60 * 60 * 1000 * 50; // last number is num of days

class Provider {
    static loadFile (fn) {
        try {
            return Gio.file_new_for_path(Provider.path + fn);
        } catch(e) {
            global.log(e);
        }
    }

    loadFromFile (fn, country) {
        const file = Provider.loadFile(fn);
        const struct = { years: {}, holidays: []};

        return file ? Object.assign(struct, Utils.readJsonFile(file)[country]) : struct;
    }

    writeToFile (fn, data) {
        const file = Provider.loadFile(fn);
        if (!file) {
            return;
        }

        const allData = Utils.readJsonFile(file);
        allData[this.country] = data;

        Utils.writeJsonFile(file, allData);
    }

    static loadJsonAsync(url, params, callback) {
        const message = Soup.Message.new("GET", url);
        global.log("get", url);
        
        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(message, (session, message) => {
                const retrieved = message.response_headers.get_one("date");
                const data = JSON.parse(message.response_body.data);
                global.log("response", retrieved);

                callback(data, params, retrieved);
            });
        } else { //version 3
            _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, result) => {
                const retrieved = message.get_response_headers().get_one("date");
                const bytes = _httpSession.send_and_read_finish(result);
                const data = JSON.parse(ByteArray.toString(bytes.get_data()));
                global.log("response", retrieved);

                callback(data, params, retrieved);
            });
        }
    }
}
Provider.path = AppletDir;

class Enrico extends Provider {
    constructor () {
        super();

        this.years = {};
        this.data = [];
    }

    addUnique (single) {
        const known = this.data.find((d) => d.year === single.year && 
                d.month === single.month && d.day === single.day && d.region === this.region);

        if (known) {
            known.name += '\n' + name;
        } else {
            this.data.push(single);
        }
    }

    update (holiday) {
        const {year, month, day} = holiday.date;

        const name = holiday.name
            .filter((l) => l.lang === LC_LANG || l.lang === "en")
            .sort((a, b) => a.lang === "en" ? 1 : b.lang === "en" ? -1 : 0)[0]
            .text;

        const flags = holiday.flags;

        this.addUnique({year, month, day, name, flags, region: this.region});

        if (holiday.dateTo) {
            const {year: yearTo, month: monthTo, day: dayTo} = holiday.dateTo;

            let iter = new Date(year, month, day, 12);
            let limit = new Date(yearTo, monthTo, dayTo, 12);
            do {
                iter.setTime(iter.getTime() + MSECS_IN_DAY);
                this.addUnique({
                    year: iter.getFullYear(),
                    month: iter.getMonth(),
                    day: iter.getDate(),
                    name,
                    flags,
                    region: this.region
                });
            } while (iter < limit);
        }
    }

    addData (data, params, retrieved) {
        if (data.error) {
            return;
        }

        const regionId = params.region || "global";
        if (this.years[params.year]) {
            this.years[params.year][regionId] = retrieved;
        } else {
            this.years[params.year] = {[regionId]: retrieved};
        }
        data.forEach(this.update, this);

        this.writeToFile(Enrico.fn, {
            years: this.years,
            holidays: this.data
        });
    }

    retrieveForYear (year, callback) {
        if (!this.country) {
            throw new Error("invalid country");
        }
        const params = {
            year,
            country: this.country,
            holidayType: "public_holiday"
        };
        if (this.region !== "global") {
            params.region = this.region;
        }

        let url = Enrico.url;
        for (let key of Object.keys(params)) {
            url += "&" + key + "=" + params[key];
        }

        Provider.loadJsonAsync(url, params, (data, params, date) => {
            this.addData(data, params, date);
            if (callback) {
                callback();
            }
        });
    }

    setPlace (country, region = "global") {
        if (this.country !== country) {
            const data = this.loadFromFile(Enrico.fn, country);
            this.years = data.years;
            this.data = data.holidays;
        }

        this.country = country;
        this.region = region;

        const year = new Date().getFullYear();
        if (!this.years[year] || this.region && !this.years[year][this.region]) {
            this.retrieveForYear(year);
        }
    }

    matchMonth (year, month) {
        const holidays = this.data.filter((d) => d.year == year && d.month == month && d.region == this.region);
        return new Map(holidays.map((d) => [`${d.month}/${d.day}`, [d.name, d.flags]]));
    }

    getHolidays (year, month, callback) {
        if (this.years[year]) {
            const retrieved = this.years[year][this.region];
            if (retrieved &&  Date.now() - new Date(retrieved).getTime() < UPDATE_PERIOD) {
                callback(this.matchMonth(year, month));
                return;
            }
        }
        this.retrieveForYear(year, () => {
            callback(this.matchMonth(year, month));
        });
    }
}
Enrico.url = "https://kayaposoft.com/enrico/json/v2.0?action=getHolidaysForYear";
Enrico.fn = "/enrico.json";

class HolidayData {
    constructor (source = "enrico") {
        this._init(source);
    }

    _init (source) {
        if (HolidayData.validSources.hasOwnProperty(source)) {
            this._provider = new HolidayData.validSources[source]();
        }
    }

    getProvider () {
        return this._provider;
    }
}
HolidayData.validSources = {
    enrico: Enrico
};
