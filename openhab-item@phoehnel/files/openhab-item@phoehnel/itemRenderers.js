const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

// Icon names from the system icon theme
const ICON_MAP = {
    "Switch": "system-shutdown-symbolic",
    "Dimmer": "display-brightness-symbolic",
    "Number": "accessories-calculator-symbolic",
    "String": "mintstick-info-symbolic",
    "Contact": "changes-prevent-symbolic",
    "Rollershutter": "view-reveal-symbolic",
    "Color": "color-select-symbolic",
    "DateTime": "x-office-calendar-symbolic",
    "Player": "media-playback-start-symbolic",
    "Group": "folder-symbolic",
    "Image": "image-x-generic-symbolic",
    "Location": "mark-location-symbolic",
    "_default": "dialog-question-symbolic",
    "_error": "dialog-error-symbolic",
    "_setup": "preferences-system-symbolic",
    "_offline": "network-offline-symbolic"
};

var getIconName = function(itemType) {
    return ICON_MAP[itemType] || ICON_MAP["_default"];
};

var getStatusIcon = function(status) {
    return ICON_MAP["_" + status] || ICON_MAP["_default"];
};

function _applyPattern(state, stateDescription) {
    if (!stateDescription || !stateDescription.pattern) return null;

    let num = parseFloat(state);
    if (isNaN(num)) return null;

    let pattern = stateDescription.pattern;
    try {
        // Handle printf-style format: e.g. "%.1f °C", "%d %%", "%.0f lux"
        let formatted = pattern.replace(/%[.\d]*[dfs]/, function(match) {
            if (match.endsWith("d")) {
                return Math.round(num).toString();
            } else if (match.endsWith("f")) {
                let decimals = 0;
                let precMatch = match.match(/\.(\d+)/);
                if (precMatch) decimals = parseInt(precMatch[1]);
                return num.toFixed(decimals);
            }
            return num.toString();
        });
        // Replace %unit% placeholder with unitSymbol if available
        // (caller can pass unitSymbol in stateDescription)
        if (formatted.includes("%unit%") && stateDescription.unitSymbol) {
            formatted = formatted.replace("%unit%", stateDescription.unitSymbol);
        }
        // Replace escaped %% with %
        formatted = formatted.replace("%%", "%");
        return formatted;
    } catch (e) {
        return null;
    }
}

function _pad2(n) {
    return n < 10 ? "0" + n : "" + n;
}

function _applyDatePattern(date, pattern) {
    // Java-style date format tokens: %1$tY, %1$tm, %1$td, %1$tH, %1$tM, %1$tS, etc.
    let result = pattern;
    result = result.replace(/%1\$tY/g, "" + date.getFullYear());
    result = result.replace(/%1\$ty/g, ("" + date.getFullYear()).slice(-2));
    result = result.replace(/%1\$tm/g, _pad2(date.getMonth() + 1));
    result = result.replace(/%1\$td/g, _pad2(date.getDate()));
    result = result.replace(/%1\$te/g, "" + date.getDate());
    result = result.replace(/%1\$tH/g, _pad2(date.getHours()));
    result = result.replace(/%1\$tk/g, "" + date.getHours());
    result = result.replace(/%1\$tI/g, _pad2(date.getHours() % 12 || 12));
    result = result.replace(/%1\$tl/g, "" + (date.getHours() % 12 || 12));
    result = result.replace(/%1\$tM/g, _pad2(date.getMinutes()));
    result = result.replace(/%1\$tS/g, _pad2(date.getSeconds()));
    result = result.replace(/%1\$tp/g, date.getHours() < 12 ? "am" : "pm");
    return result;
}

var formatState = function(itemType, state, stateDescription, options) {
    let opts = options || {};
    if (state === "NULL" || state === "UNDEF") {
        return "--";
    }

    switch (itemType) {
        case "Switch":
            return state;
        case "Dimmer":
            return Math.round(parseFloat(state)) + "%";
        case "Number": {
            // Apply stateDescription pattern for Number types (e.g. "%.1f °C")
            let formatted = _applyPattern(state, stateDescription);
            if (formatted !== null) return formatted;
            return state;
        }
        case "Group": {
            // Groups with numeric aggregation (AVG, SUM, etc.)
            let formatted = _applyPattern(state, stateDescription);
            if (formatted !== null) return formatted;
            return state;
        }
        case "Contact":
            return state === "OPEN" ? "Open" : "Closed";
        case "Rollershutter":
            return Math.round(parseFloat(state)) + "%";
        case "Color": {
            // HSB format: "hue,saturation,brightness"
            if (opts.hideColorPercent) return "";
            let parts = state.split(",");
            if (parts.length === 3) {
                return Math.round(parseFloat(parts[2])) + "%";
            }
            return state;
        }
        case "DateTime":
            try {
                let date = new Date(state);
                if (isNaN(date.getTime())) return state;
                if (stateDescription && stateDescription.pattern) {
                    return _applyDatePattern(date, stateDescription.pattern);
                }
                return date.toLocaleString();
            } catch (e) {
                return state;
            }
        case "Player":
            return state;
        default:
            return state;
    }
};

var buildMenuItems = function(itemData, sendCommandCallback, options) {
    let items = [];
    let type = itemData.type;
    let state = itemData.state;
    let label = itemData.label || itemData.name;
    let opts = options || {};

    // Strip ":" suffixed type info (e.g., "Number:Temperature" -> "Number")
    let baseType = type.split(":")[0];

    // Pass unitSymbol into stateDescription for formatting
    let stateDesc = itemData.stateDescription || {};
    if (itemData.unitSymbol) stateDesc.unitSymbol = itemData.unitSymbol;
    let formattedState = formatState(baseType, state, stateDesc);

    if (state === "NULL" || state === "UNDEF") {
        let header = new PopupMenu.PopupMenuItem(
            label + ": --", { reactive: false }
        );
        items.push(header);
        return items;
    }

    if (opts.readOnly) {
        // Read-only mode: show all types as non-interactive labels
        let header = new PopupMenu.PopupMenuItem(
            label + ": " + formattedState, { reactive: false }
        );
        items.push(header);
        return items;
    }

    switch (baseType) {
        case "Switch":
            _buildSwitchMenu(items, label, state, sendCommandCallback);
            break;
        case "Dimmer":
            _buildDimmerMenu(items, label, state, sendCommandCallback, opts.dimmerShowToggle);
            break;
        case "Rollershutter":
            _buildRollershutterMenu(items, label, state, sendCommandCallback);
            break;
        case "Color":
            _buildColorMenu(items, label, state, sendCommandCallback, opts);
            break;
        case "Player":
            _buildPlayerMenu(items, label, state, sendCommandCallback);
            break;
        default:
            // Read-only types: show label + formatted state
            let header = new PopupMenu.PopupMenuItem(
                label + ": " + formattedState, { reactive: false }
            );
            items.push(header);
            break;
    }

    return items;
};

// Debounced slider command: sends command after 300ms of inactivity on value-changed.
// This ensures scroll-wheel changes (which don't fire drag-end) still send commands.
function _connectSliderDebounce(slider, commandFn) {
    let timerId = null;
    slider.connect("value-changed", () => {
        if (timerId) {
            Mainloop.source_remove(timerId);
        }
        timerId = Mainloop.timeout_add(300, () => {
            timerId = null;
            commandFn(slider.value);
            return GLib.SOURCE_REMOVE;
        });
    });
}

// Keep menu open: override activate to always pass keepMenu=true
function _keepMenuOpen(menuItem) {
    menuItem.activate = function(event) {
        this.emit('activate', event, true);
    };
}

function _buildSwitchMenu(items, label, state, sendCommand) {
    let switchItem = new PopupMenu.PopupSwitchMenuItem(label, state === "ON");
    switchItem.connect("activate", () => {
        sendCommand(switchItem.state ? "ON" : "OFF");
    });
    _keepMenuOpen(switchItem);
    items.push(switchItem);
}

function _buildDimmerMenu(items, label, state, sendCommand, showToggle) {
    if (showToggle) {
        let isOn = state !== "0" && state !== "OFF";
        let switchItem = new PopupMenu.PopupSwitchMenuItem(label, isOn);
        switchItem.connect("activate", () => {
            sendCommand(switchItem.state ? "ON" : "OFF");
        });
        _keepMenuOpen(switchItem);
        items.push(switchItem);
    } else {
        let dimmerLabel = new PopupMenu.PopupMenuItem(
            label + ": " + Math.round(parseFloat(state) || 0) + "%",
            { reactive: false }
        );
        items.push(dimmerLabel);
    }

    let sliderValue = parseFloat(state) / 100.0;
    if (isNaN(sliderValue)) sliderValue = 0;
    sliderValue = Math.max(0, Math.min(1, sliderValue));

    let sliderItem = new PopupMenu.PopupSliderMenuItem(sliderValue);
    sliderItem.connect("drag-end", (slider) => {
        let pct = Math.round(slider.value * 100);
        sendCommand(pct.toString());
    });
    _connectSliderDebounce(sliderItem, (value) => {
        sendCommand(Math.round(value * 100).toString());
    });
    items.push(sliderItem);
}

function _buildRollershutterMenu(items, label, state, sendCommand) {
    let position = parseFloat(state);
    if (isNaN(position)) position = 0;

    let upItem = new PopupMenu.PopupMenuItem("  \u25B2  UP");
    upItem.connect("activate", () => sendCommand("UP"));
    _keepMenuOpen(upItem);
    items.push(upItem);

    let stopItem = new PopupMenu.PopupMenuItem("  \u25A0  STOP");
    stopItem.connect("activate", () => sendCommand("STOP"));
    _keepMenuOpen(stopItem);
    items.push(stopItem);

    let downItem = new PopupMenu.PopupMenuItem("  \u25BC  DOWN");
    downItem.connect("activate", () => sendCommand("DOWN"));
    _keepMenuOpen(downItem);
    items.push(downItem);

    let sliderValue = position / 100.0;
    sliderValue = Math.max(0, Math.min(1, sliderValue));

    let sliderItem = new PopupMenu.PopupSliderMenuItem(sliderValue);
    sliderItem.connect("drag-end", (slider) => {
        sendCommand(Math.round(slider.value * 100).toString());
    });
    _connectSliderDebounce(sliderItem, (value) => {
        sendCommand(Math.round(value * 100).toString());
    });
    items.push(sliderItem);
}

var hsbToHex = function(h, s, b) {
    // h: 0-360, s: 0-100, b: 0-100 -> "#RRGGBB"
    s = s / 100;
    b = b / 100;
    let c = b * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = b - c;
    let r = 0, g = 0, bl = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; bl = x; }
    else if (h < 240) { g = x; bl = c; }
    else if (h < 300) { r = x; bl = c; }
    else               { r = c; bl = x; }
    let toHex = function(v) {
        let hex = Math.round((v + m) * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(r) + toHex(g) + toHex(bl);
}

function _buildColorMenu(items, label, state, sendCommand, options) {
    let opts = options || {};
    let parts = state.split(",");
    let hue = 0, sat = 100, bri = 100;
    if (parts.length === 3) {
        hue = parseFloat(parts[0]) || 0;
        sat = parseFloat(parts[1]) || 0;
        bri = parseFloat(parts[2]) || 0;
    }

    // ON/OFF toggle
    let isOn = bri > 0;
    let switchItem = new PopupMenu.PopupSwitchMenuItem(label, isOn);
    switchItem.connect("activate", () => {
        sendCommand(switchItem.state ? "ON" : "OFF");
    });
    _keepMenuOpen(switchItem);
    items.push(switchItem);

    // Color preview swatch (rendered rectangle)
    let colorHex = hsbToHex(hue, sat, isOn ? Math.max(bri, 20) : 0);
    let previewItem = new PopupMenu.PopupMenuItem("", { reactive: false });
    previewItem.label.hide();
    let previewStyle = "background-color: " + colorHex + ";"
        + " border: 1px solid rgba(255,255,255,0.3);"
        + " border-radius: 4px;"
        + " min-height: 28px;"
        + " max-height: 28px;";
    let previewBox = new St.Bin({
        style: previewStyle,
        x_expand: true,
    });
    previewItem.addActor(previewBox, { span: -1, expand: true });
    items.push(previewItem);

    // Brightness slider (0-100) — most common adjustment
    let briLabel = new PopupMenu.PopupMenuItem("Brightness: " + Math.round(bri) + "%", { reactive: false });
    items.push(briLabel);
    let briSlider = new PopupMenu.PopupSliderMenuItem(bri / 100);
    briSlider.connect("value-changed", (slider, value) => {
        bri = Math.round(value * 100);
        briLabel.label.set_text("Brightness: " + bri + "%");
        previewBox.set_style(
            "background-color: " + hsbToHex(hue, sat, Math.max(bri, 5)) + ";"
            + " border: 1px solid rgba(255,255,255,0.3);"
            + " border-radius: 4px;"
            + " min-height: 28px;"
            + " max-height: 28px;"
        );
    });
    briSlider.connect("drag-end", (slider) => {
        bri = Math.round(slider.value * 100);
        sendCommand(Math.round(hue) + "," + Math.round(sat) + "," + bri);
    });
    _connectSliderDebounce(briSlider, (value) => {
        let b = Math.round(value * 100);
        sendCommand(Math.round(hue) + "," + Math.round(sat) + "," + b);
    });
    items.push(briSlider);
}


function _buildPlayerMenu(items, label, state, sendCommand) {
    let prevItem = new PopupMenu.PopupMenuItem("  \u23EE  Previous");
    prevItem.connect("activate", () => sendCommand("PREVIOUS"));
    _keepMenuOpen(prevItem);
    items.push(prevItem);

    let isPlaying = state === "PLAY";
    let playPauseItem = new PopupMenu.PopupMenuItem(
        isPlaying ? "  \u23F8  Pause" : "  \u25B6  Play"
    );
    playPauseItem.connect("activate", () => sendCommand(isPlaying ? "PAUSE" : "PLAY"));
    _keepMenuOpen(playPauseItem);
    items.push(playPauseItem);

    let nextItem = new PopupMenu.PopupMenuItem("  \u23ED  Next");
    nextItem.connect("activate", () => sendCommand("NEXT"));
    _keepMenuOpen(nextItem);
    items.push(nextItem);
}
