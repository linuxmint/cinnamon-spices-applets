const Applet = imports.ui.applet;
// const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;

const APPLET_UUID = "nepali-date@bishalacharya";

const APPLET_DIR = imports.ui.appletManager.appletMeta[APPLET_UUID].path;


const SETTINGS = {
    'language': 'en',
    'format': 'Month Day, Year',
};

// Get current Nepal Time
function getNepaliNow() {
    let tz = GLib.TimeZone.new("Asia/Kathmandu");
    return GLib.DateTime.new_now(tz);
}
// Month names
const monthsEnglish = ['Baisakh','Jestha','Ashar','Shrawan','Bhadra','Ashoj','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const monthsNepali  = ['बैशाख','जेठ','असार','श्रावण','भदौ','असोज','कार्तिक','मंसिर','पुष','माघ','फाल्गुन','चैत्र'];

// Helper: convert English digits to Nepali
function toNepaliDigits(str) {
    const map = "०१२३४५६७८९";
    return str.replace(/\d/g, d => map[d]);
}

// Nepali BS calendar data
const nepcal = {
    74: {
      mon_days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
      tot_days: 365,
    },
    75: {
      mon_days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
      tot_days: 365,
    },
    76: {
      mon_days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
      tot_days: 365,
    },
    77: {
      mon_days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
      tot_days: 366,
    },
    78: {
      mon_days: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
      tot_days: 365,
    },
    79: {
      mon_days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
      tot_days: 365,
    },
    80: {
      mon_days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
      tot_days: 365,
    },
    81: {
      mon_days: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
      tot_days: 366,
    },
    82: {
      mon_days: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
      tot_days: 365,
    },
    83: {
      mon_days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
    84: {
      mon_days: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
    85: {
      mon_days: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
    86: {
      mon_days: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
    87: {
      mon_days: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
      tot_days: 366,
    },
    88: {
      mon_days: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
    89: {
      mon_days: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
    90: {
      mon_days: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
      tot_days: 365,
    },
};

const months = [
    'Baisakh','Jestha','Ashar','Shrawan','Bhadra',
    'Ashoj','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'
];

// Reference: Nepali BS 2074-01-01 = 2017-04-14
const refNep = [2074, 1, 1];
const refEng = new Date(2017, 3, 14);

function getNepaliDate() {
    // date from nepali time
    let now = getNepaliNow(); // GLib.DateTime

    // Convert GLib.DateTime → JS Date for diff calculations
    let current = new Date(now.get_year(), now.get_month() - 1, now.get_day_of_month());

    let diff = Math.floor((current - refEng) / (1000 * 3600 * 24));
    let year = refNep[0], month = refNep[1], day = refNep[2];

    let startYear = 74;
    let yDiff = 0, mDiff = 0, dRem = diff;
    let stop = false;

    while (!stop) {
        let data = nepcal[startYear];
        if (!data) break;
        if (dRem > data.tot_days) {
            yDiff++;
            dRem -= data.tot_days;
            startYear++;
        } else {
            for (let i = 0; i < data.mon_days.length; i++) {
                let md = data.mon_days[i];
                if (dRem >= md) {
                    mDiff++;
                    dRem -= md;
                } else {
                    stop = true;
                    break;
                }
            }
        }
    }

    year += yDiff;
    month += mDiff;
    if (month > 12) {
        year += Math.floor((month-1)/12);
        month = ((month-1) % 12) + 1;
    }
    day += dRem;

    return { year, month, day }; // return as object for further formatting
    }

class NepaliDateApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.set_applet_tooltip("Nepali Date");
        this._initSettings(metadata, instanceId);
        this._update();
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
        this._update();
        return true;
    });
    }
      _initSettings(metadata, instanceId) {
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        for (const setting of Object.keys(SETTINGS)) {
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                setting,
                setting,
                this._update.bind(this),
                null
            );
        }
    }

    _update() {
        let bs = getNepaliDate();

        let monthNames = this.language =="en" ? monthsEnglish : monthsNepali;
        let label = "";

        if(this.format=="YYYY/MM/DD"){
            let month = ("0" + bs.month).slice(-2);
            let day = ("0" + bs.day).slice(-2);
            label = `${bs.year}/${month}/${day}`;
        }
        else if(this.format=="YYYY Month DD")
          label = `${bs.year} ${monthNames[bs.month-1]} ${bs.day}`;
        else if(this.format="Month DD, YYYY")
          label = `${monthNames[bs.month-1]} ${bs.day}, ${bs.year}`;

        if(this.language=="ne")
            label = toNepaliDigits(label);

        this.set_applet_label(label);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new NepaliDateApplet(metadata,orientation, panelHeight, instanceId);
}
