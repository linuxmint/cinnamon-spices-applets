"use strict";

const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const Util = imports.misc.util;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
let PrayTimes, HijriCalendarKuwaiti;
if (typeof require !== 'undefined') {
    PrayTimes = require('./PrayTimes');
    HijriCalendarKuwaiti = require('./HijriCalendarKuwaiti');
} else {
    const AppletDir = imports.ui.appletManager.applets['azan@fahri.nurul.id'];
    PrayTimes = AppletDir.PrayTimes;
    HijriCalendarKuwaiti = AppletDir.HijriCalendarKuwaiti;
}

// const moment = AppletDir.moment;
// const MomentHijri = AppletDir.momenthijri;

function main(metadata, orientation, panelHeight, instanceId) {
    return new AzanApplet(metadata, orientation, panelHeight, instanceId);
}

function AzanApplet(metadata, orientation, panelHeight, instanceId) {
    this._init.call(this, metadata, orientation, panelHeight, instanceId);
}

AzanApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            //this.set_applet_icon_name("force-exit");
            //this.set_applet_label(_('AzanApplet Title Tes'));
            //this.set_applet_tooltip(_("Click here to kill a window"));

            this._metadata = metadata;

            // option settings, values are bound in _bindSettings
            // using _opt prefix to make them easy to identify
            this._opt_calculationMethod = null;
            this._opt_latitude = null;
            this._opt_longitude = null;
            this._opt_timezone = null;
            this._opt_juristic = null;

            this._settingsProvider = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this._bindSettings();


            this._dateFormatFull = _("%A %B %e, %Y");

            this._prayTimes = new PrayTimes.PrayTimes('ISNA');


            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            // this.menu.addAction(_("Screenshot"), function(event) {
            //     Util.spawnCommandLine("gnome-screenshot -a");
            // });


            //Subh, Shorook, Dhuhr, Asr, Maghrib, Isha'

            //var car = {type:"Fiat", model:"500", color:"white"};

            this._dayNames = new Array("Ahad", "Ithnin", "Thulatha", "Arbaa", "Khams", "Jumuah", "Sabt");
            this._monthNames = new Array("Muharram", "Safar", "Rabi'ul Awwal", "Rabi'ul Akhir",
                "Jumadal Ula", "Jumadal Akhira", "Rajab", "Sha'ban",
                "Ramadan", "Shawwal", "Dhul Qa'ada", "Dhul Hijja");

            this._timeNames = {
                imsak: 'Imsak',
                fajr: 'Fajr',
                sunrise: 'Sunrise',
                dhuhr: 'Dhuhr',
                asr: 'Asr',
                sunset: 'Sunset',
                maghrib: 'Maghrib',
                isha: 'Isha',
                midnight: 'Midnight'
            };

            this._prayItems = {};


            // https://gist.github.com/tesfabpel/2596526
            // this._batteryItem = new PopupMenu.PopupMenuItem('', { reactive: false });
            //             this._primaryPercentage = new St.Label();
            //             this._batteryItem.addActor(this._primaryPercentage, { align: St.Align.END });
            //             this.menu.addMenuItem(this._batteryItem);


            this._dateMenuItem = new PopupMenu.PopupMenuItem("", {
                reactive: false
            });
            // this._dateLabel = new St.Label();
            // this._dateMenuItem.addActor(this._dateLabel, {
            //     align: St.Align.START
            // });
            this.menu.addMenuItem(this._dateMenuItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            for (let prayerId in this._timeNames) {

                let prayerName = this._timeNames[prayerId];

                let prayMenuItem = new PopupMenu.PopupMenuItem(_(prayerName), {
                    reactive: false
                });

                let bin = new St.Bin({
                    x_align: St.Align.END
                });

                let prayLabel = new St.Label();
                bin.add_actor(prayLabel);

                prayMenuItem.addActor(bin, {
                    expand: false,
                    span: -1,
                    align: St.Align.END
                });

                this.menu.addMenuItem(prayMenuItem);

                this._prayItems[prayerId] = {
                    menuItem: prayMenuItem,
                    label: prayLabel
                };

            };

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addAction(_("Settings"), Lang.bind(this, function() {
                let command = "cinnamon-settings applets %s".format(this._metadata.uuid);
                Util.trySpawnCommandLine(command);
            }));

            // this.menu.addSettingsAction(_("Power Settings"), 'power');


            //TODO: masukkan setiap object pray ke dalam dict prayItems



            // global.logError(JSON.stringify(prayMenuItem));

            this._updateLabelPeriodic();

        } catch (e) {
            global.logError(e);
        }
    },

    _bindSettings: function() {
        let emptyCallback = function() {}; // for cinnamon 1.8

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "calculation_method",
            "_opt_calculationMethod",
            function() {
                this._updateLabel();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "latitude",
            "_opt_latitude",
            function() {
                this._updateLabel();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "longitude",
            "_opt_longitude",
            function() {
                this._updateLabel();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "timezone",
            "_opt_timezone",
            function() {
                this._updateLabel();
            }
        );

        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "time_format",
            "_opt_timeFormat",
            function() {
                this._updateLabel();
            }
        );
		
        this._settingsProvider.bindProperty(
            Settings.BindingDirection.IN,
            "juristic",
            "_opt_juristic",
            function() {
                this._updateLabel();
            }
        );
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    },

    _updateLabelPeriodic: function() {
        this._updateLabel();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._updateLabelPeriodic));
    },

    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId) {
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    _updateLabel: function() {
        let displayDate = GLib.DateTime.new_now_local();
        let dateFormattedFull = displayDate.format(this._dateFormatFull);

        // let myLocation = [-6.3365403, 106.8524694];
        // let myTimezone = 'auto';

        let myLocation = [this._opt_latitude, this._opt_longitude];
        let myTimezone = this._opt_timezone;
        this._prayTimes.setMethod(this._opt_calculationMethod);
        
        // Adjust Juristic Setting
        this._prayTimes.adjust({asr: this._opt_juristic});

        let currentDate = new Date();

        let currentSeconds = this._calculateSecondsFromDate(currentDate);

        let timesStr = this._prayTimes.getTimes(currentDate, myLocation, myTimezone, 'auto', this._opt_timeFormat);
        let timesFloat = this._prayTimes.getTimes(currentDate, myLocation, myTimezone, 'auto', 'Float');

        let nearestPrayerId;
        let minDiffMinutes = Number.MAX_VALUE;
        let isTimeForPraying = false;
        for (let prayerId in this._timeNames) {

            let prayerName = this._timeNames[prayerId];
            let prayerTime = timesStr[prayerId];

            this._prayItems[prayerId].label.text = prayerTime;

            if (this._isPrayerTime(prayerId)) {

                let prayerSeconds = this._calculateSecondsFromHour(timesFloat[prayerId]);

                let ishaSeconds = this._calculateSecondsFromHour(timesFloat['isha']);
                let fajrSeconds = this._calculateSecondsFromHour(timesFloat['fajr']);

                if (prayerId === 'fajr' && currentSeconds > ishaSeconds) {
                    prayerSeconds = fajrSeconds + (24 * 60 *60);
                }

                let diffSeconds = prayerSeconds - currentSeconds;

                if (diffSeconds > 0) {
                    let diffMinutes = ~~(diffSeconds / 60);

                    if (diffMinutes == 0) {
                        isTimeForPraying = true;
                        nearestPrayerId = prayerId;
                        break;
                    } else if (diffMinutes <= minDiffMinutes) {
                        minDiffMinutes = diffMinutes;
                        nearestPrayerId = prayerId;
                    }

                    // global.logError("prayerId: %s, diffSeconds: %s, diffMinutes: %s, minDiffMinutes: %s, isTimeForPraying: %s, nearestPrayerId: %s".format(
                    //     prayerId, diffSeconds, diffMinutes, minDiffMinutes, isTimeForPraying, nearestPrayerId
                    //     ));
                }

            }
        };


        let hijriDate = HijriCalendarKuwaiti.KuwaitiCalendar();

        let outputIslamicDate = this._formatHijriDate(hijriDate);

        this._dateMenuItem.label.text = outputIslamicDate;
        // this._dateLabel.text = outputIslamicDate;

        // global.logError(Moment.moment().format('iYYYY/iM/iD'));

        // global.logError('date : ' + currentSeconds + ' , dhuhr : ' + timesFloat.dhuhr + ' -> ' + this._calculateSecondsFromHour(timesFloat.dhuhr));


        // Main.notify(_("It's time for " + this._timeNames[nearestPrayerId]));


        // this.set_applet_label(this._timeNames[nearestPrayerId] + ' ' + timesStr[nearestPrayerId]);
        if (isTimeForPraying) {
            Main.notify(_("It's time for " + this._timeNames[nearestPrayerId]));
            this.set_applet_label(_("Now : " + this._timeNames[nearestPrayerId]));
        } else {
            this.set_applet_label(this._timeNames[nearestPrayerId] + ' -' + this._formatRemainingTimeFromMinutes(minDiffMinutes));
        }

        // this.prayLabel.text = new Date().toString();
    },

    _calculateSecondsFromDate: function(date) {
        return this._calculateSecondsFromHour(date.getHours()) + (date.getMinutes() * 60) + date.getSeconds();
    },

    _calculateSecondsFromHour: function(hour) {
        return (hour * 60 * 60);
    },

    _isPrayerTime: function(prayerId) {
        return prayerId === 'fajr' || prayerId === 'dhuhr' || prayerId === 'asr' || prayerId === 'maghrib' || prayerId === 'isha';
    },

    _formatRemainingTimeFromMinutes: function(diffMinutes) {
        // let diffMinutes = diffSeconds / (60);

        let hours = ~~(diffMinutes / 60);
        let minutes = ~~(diffMinutes % 60);

        let hoursStr = (hours < 10 ? "0" : "") + hours;
        let minutesStr = (minutes < 10 ? "0" : "") + minutes;

        return hoursStr + ":" + minutesStr;
    },

    _formatHijriDate: function(hijriDate) {
        return this._dayNames[hijriDate[4]] + ", " + hijriDate[5] + " " + this._monthNames[hijriDate[6]] + " " + hijriDate[7];
    }
};
