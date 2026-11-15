// widgets/weather2Widget.js
'use strict';

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const WidgetBase = require('./widgets/widgetBase');

class Weather2Widget extends WidgetBase {
    constructor(tileData, applet) {
        super(tileData, applet);

        this._weatherCache = {}; // Cache: { location: { temp, emoji, locationName, time } }
        this._currentLocationIndex = 0;
        this._cycleTimeoutId = null;
        this._animTimer = null;

        // Viewport for sliding animation — must never be removed from contentActor.
        this._viewport = new St.Widget({
            clip_to_allocation: true,
            x_expand: true,
            y_expand: true,
            style: 'background-color: transparent; margin: 0; padding: 0;'
        });
        this._contentActor.add_child(this._viewport);

        this._currentCard = null;
        this._nextCard    = null;
        this._activeIcon  = null;
    }

    buildUI() {
        this._showLoading();
    }

    refresh(forceRefresh = false) {
        const config = this.tileData.config || {};
        let rawLocs = config.locations;
        if (!rawLocs || !Array.isArray(rawLocs) || rawLocs.length === 0) {
            rawLocs = [""]; // Default to empty string (automatic location)
        }

        const refreshRate = (config.refreshIntervalMin || 15) * 60;
        const cacheTTL = Math.max(120000, refreshRate * 1000);

        let allFresh = rawLocs.every(loc => {
            let c = this._weatherCache[loc];
            return c && (Date.now() - c.time < cacheTTL);
        });

        if (!forceRefresh && allFresh && Object.keys(this._weatherCache).length > 0) {
            this._currentLocationIndex = 0;
            this._displayCurrentLocation(false);
            this._scheduleCycle();
            this._scheduleRefresh(refreshRate, () => this.refresh());
            return;
        }

        let pending = rawLocs.length;
        let hasError = false;

        this._clearCycle();

        rawLocs.forEach((loc) => {
            this._fetchWeather(loc, (data, err) => {
                if (err || !data) {
                    hasError = true;
                } else {
                    let displayName = loc || data.detectedLocation || 'Auto';
                    this._weatherCache[loc] = {
                        temp: data.temp,
                        emoji: data.emoji,
                        locationName: displayName,
                        time: Date.now()
                    };
                }

                pending--;
                if (pending === 0) {
                    if (hasError && Object.keys(this._weatherCache).length === 0) {
                        this._showError('Weather unavailable');
                    } else {
                        this._currentLocationIndex = 0;
                        this._displayCurrentLocation(false);
                        this._scheduleCycle();
                    }
                }
            });
        });

        this._scheduleRefresh(refreshRate, () => this.refresh());
    }

    destroy() {
        this._clearCycle();
        this._clearAnim();
        super.destroy();
    }

    pause() {
        super.pause();
        this._clearCycle();
        this._clearAnim();
    }

    resume() {
        super.resume();
        this._scheduleCycle();
    }

    _scheduleCycle() {
        this._clearCycle();
        const config = this.tileData.config || {};
        const rawLocs = config.locations || [""];
        if (rawLocs.length <= 1) return;

        const intervalSec = config.transitionIntervalSec || 10;
        this._cycleTimeoutId = Mainloop.timeout_add_seconds(intervalSec, () => {
            this._cycleNextLocation();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _clearCycle() {
        if (this._cycleTimeoutId) {
            Mainloop.source_remove(this._cycleTimeoutId);
            this._cycleTimeoutId = null;
        }
    }

    _cycleNextLocation() {
        const config = this.tileData.config || {};
        const rawLocs = config.locations || [""];
        if (rawLocs.length <= 1) return;

        this._currentLocationIndex = (this._currentLocationIndex + 1) % rawLocs.length;
        this._displayCurrentLocation(true);
    }

    _displayCurrentLocation(animate) {
        const config = this.tileData.config || {};
        const rawLocs = config.locations || [""];
        const loc = rawLocs[this._currentLocationIndex];
        const cacheData = this._weatherCache[loc];

        if (!cacheData) return;

        const size = this._getSize();
        const newCard = this._buildWeatherCard(cacheData.locationName, cacheData.temp, cacheData.emoji, size.w, size.h);

        if (!animate || !this._currentCard) {
            if (this._currentCard) {
                try { this._currentCard.destroy(); } catch(e) {}
            }
            this._viewport.remove_all_children();
            this._currentCard = newCard;
            this._viewport.add_child(this._currentCard);
            this._currentCard.set_position(0, 0);
            this._startIconAnimation(newCard._icon, cacheData.emoji);
            return;
        }

        // Animate transition
        this._nextCard = newCard;
        this._viewport.add_child(this._nextCard);

        const transition = config.transitionStyle || 'slide-left';
        let curTargetX = 0, curTargetY = 0;
        let nextStartX = 0, nextStartY = 0;

        if (transition === 'slide-left') {
            curTargetX = -size.w;
            nextStartX = size.w;
        } else if (transition === 'slide-right') {
            curTargetX = size.w;
            nextStartX = -size.w;
        } else if (transition === 'slide-up') {
            curTargetY = -size.h;
            nextStartY = size.h;
        } else if (transition === 'slide-down') {
            curTargetY = size.h;
            nextStartY = -size.h;
        } else {
            // Fade fallback
            this._nextCard.opacity = 0;
            this._nextCard.set_position(0, 0);

            this._currentCard.save_easing_state();
            this._currentCard.set_easing_duration(500);
            this._currentCard.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
            this._currentCard.opacity = 0;
            this._currentCard.restore_easing_state();

            this._nextCard.save_easing_state();
            this._nextCard.set_easing_duration(500);
            this._nextCard.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
            this._nextCard.opacity = 255;
            this._nextCard.restore_easing_state();

            const oldCard = this._currentCard;
            this._currentCard = this._nextCard;
            this._nextCard = null;
            this._startIconAnimation(this._currentCard._icon, cacheData.emoji);

            Mainloop.timeout_add(550, () => {
                try {
                    oldCard.destroy();
                } catch(e) {}
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._nextCard.set_position(nextStartX, nextStartY);

        this._currentCard.save_easing_state();
        this._currentCard.set_easing_duration(500);
        this._currentCard.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
        this._currentCard.set_position(curTargetX, curTargetY);
        this._currentCard.restore_easing_state();

        this._nextCard.save_easing_state();
        this._nextCard.set_easing_duration(500);
        this._nextCard.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
        this._nextCard.set_position(0, 0);
        this._nextCard.restore_easing_state();

        const oldCard = this._currentCard;
        this._currentCard = this._nextCard;
        this._nextCard = null;
        this._startIconAnimation(this._currentCard._icon, cacheData.emoji);

        Mainloop.timeout_add(550, () => {
            try {
                oldCard.destroy();
            } catch(e) {}
            return GLib.SOURCE_REMOVE;
        });
    }

    _getSvgPathForSubfolder(subfolder) {
        const bgDir = GLib.get_home_dir() + '/.local/share/cinnamon/applets/MintTenMenu@kb/assets/weather_bg/';
        let filename = subfolder + '.svg';
        let fullPath = bgDir + filename;
        if (GLib.file_test(fullPath, GLib.FileTest.EXISTS)) {
            return fullPath;
        }

        // Map to named fallback if lowercase doesn't match
        const nameMap = {
            'clear-day': 'ClearSky.svg',
            'clear-night': 'ClearNight.svg',
            'cloudy': 'Cloudy.svg',
            'fog': 'Fog.svg',
            'partly-cloudy-day': 'PartlyCloudyDay.svg',
            'partly-cloudy-day-rain': 'PartlyCloudyDayRain.svg',
            'partly-cloudy-night': 'PartlyCloudyNight.svg',
            'rain': 'rainy.svg',
            'snow': 'Snow.svg',
            'thunderstorms': 'Thunderstorms.svg'
        };
        let fallbackName = nameMap[subfolder] || 'ClearSky.svg';
        return bgDir + fallbackName;
    }

    _buildWeatherCard(name, temp, emoji, w, h) {
        const config = this.tileData.config || {};
        let subfolder = this._getSubfolderForEmoji(emoji);
        let svgPath = this._getSvgPathForSubfolder(subfolder);

        // Container widget to hold SVG background + card layout
        const container = new St.Widget({
            reactive: true,
            x_expand: true,
            y_expand: true,
            style: `background-image: url("file://${svgPath}"); background-size: cover; margin: 0; padding: 0;`
        });
        container.set_size(w, h);

        // Add background SVG icon actor as layer for guaranteed vector rendering
        let bgFile = Gio.File.new_for_path(svgPath);
        let bgGicon = new Gio.FileIcon({ file: bgFile });
        let bgIcon = new St.Icon({
            gicon: bgGicon,
            icon_size: Math.max(w, h),
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });
        bgIcon.set_size(w, h);
        container.add_child(bgIcon);

        // Foreground content box over SVG background
        const card = new St.BoxLayout({
            vertical: false,
            reactive: false,
            style: 'background-color: transparent; margin: 0; padding: 12px 16px;',
            x_expand: true,
            y_expand: true
        });
        card.set_size(w, h);
        container.add_child(card);

        const leftBox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });
        card.add_child(leftBox);

        // Location Name Label
        const locLabel = new St.Label({
            text: name || 'Local Weather',
            style: 'color: rgba(255, 255, 255, 0.85); font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif; margin-bottom: 2px; text-shadow: 0px 1px 3px rgba(0,0,0,0.6);'
        });
        leftBox.add_child(locLabel);

        // Temperature Label
        const tempLabel = new St.Label({
            text: temp || '--°C',
            style: 'color: #ffffff; font-size: 32px; font-weight: 700; font-family: "Inter", sans-serif; text-shadow: 0px 2px 4px rgba(0,0,0,0.6);'
        });
        leftBox.add_child(tempLabel);

        // Weather Icon
        let iconSize = config.iconSize || 72;
        let iconDir = GLib.get_home_dir() + '/.local/share/cinnamon/desklets/mac-clock@kb/weather-icons/meteocons/' + subfolder + '/';
        let initialFile = Gio.File.new_for_path(iconDir + '0.png');
        let gicon = new Gio.FileIcon({ file: initialFile });

        const icon = new St.Icon({
            gicon: gicon,
            icon_size: iconSize,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 12px;'
        });
        card.add_child(icon);

        container._icon = icon; // Save ref for animation
        return container;
    }

    _getSubfolderForEmoji(emoji) {
        switch (emoji) {
            case "☀️": return "clear-day";
            case "🌙": return "clear-night";
            case "🌤️": return "partly-cloudy-day";
            case "☁️": return "partly-cloudy-night";
            case "🌫️": return "fog";
            case "🌦️": return "partly-cloudy-day-rain";
            case "🌧️": return "rain";
            case "❄️": return "snow";
            case "🌨️": return "snow";
            case "⛈️": return "thunderstorms";
            default:   return "cloudy";
        }
    }

    _startIconAnimation(icon, emoji) {
        this._clearAnim();
        if (!icon) return;

        const config = this.tileData.config || {};
        if (config.iconStyle === 'static') return;

        let subfolder = this._getSubfolderForEmoji(emoji);
        let iconDir = GLib.get_home_dir() + '/.local/share/cinnamon/desklets/mac-clock@kb/weather-icons/meteocons/' + subfolder + '/';

        let frameIndex = 0;
        const maxFrames = 60;
        let fps = Math.max(5, Math.min(60, config.weatherAnimationFps || 30));
        let delay = Math.round(1000 / fps);

        this._animTimer = Mainloop.timeout_add(delay, () => {
            try {
                if (!icon || !icon.get_stage()) {
                    this._animTimer = null;
                    return GLib.SOURCE_REMOVE;
                }

                frameIndex = (frameIndex + 1) % maxFrames;
                let framePath = iconDir + frameIndex + '.png';
                let frameFile = Gio.File.new_for_path(framePath);
                icon.gicon = new Gio.FileIcon({ file: frameFile });

                return GLib.SOURCE_CONTINUE;
            } catch (err) {
                this._animTimer = null;
                return GLib.SOURCE_REMOVE;
            }
        });
    }

    _clearAnim() {
        if (this._animTimer) {
            Mainloop.source_remove(this._animTimer);
            this._animTimer = null;
        }
    }

    // --- Weather Fetch Backend ---

    _fetchWeather(location, callback) {
        // Use wttr.in directly via curl — format: "%C %t %l"
        // %C = condition description, %t = temperature, %l = location
        const loc = (location || '').trim();
        const query = loc ? encodeURIComponent(loc) : '';
        const url = 'https://wttr.in/' + query + '?format=%c+%t+%l';

        const argv = ['curl', '-s', '--max-time', '10', url];

        try {
            this._spawnAsync(argv, (stdout, err) => {
                if (err || !stdout || !stdout.trim()) {
                    callback(null, err || new Error('Fetch failed'));
                    return;
                }

                const out = stdout.trim();

                // wttr.in returns e.g. "⛅️ +28°C Bengaluru"
                // Split on first whitespace boundary: emoji, temp, rest=location
                // The emoji may be multi-byte; split on spaces
                const parts = out.split(/\s+/);
                if (parts.length >= 2) {
                    const emoji = parts[0];
                    const temp  = (parts[1] || '').replace(/^\+/, '');
                    const detectedLocation = parts.slice(2).join(' ') || null;

                    if (temp && temp !== 'N/A') {
                        callback({ emoji, temp, detectedLocation });
                    } else {
                        callback(null, new Error('Weather unavailable'));
                    }
                } else {
                    callback(null, new Error('Unexpected weather format: ' + out));
                }
            });
        } catch (e) {
            callback(null, e);
        }
    }
}

module.exports = Weather2Widget;
