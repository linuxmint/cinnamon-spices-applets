const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var _applet;

function init(applet) {
    _applet = applet;
    // Creates file on start so you see logging works
    // logToErrorFile("System", "Session started. Logging active.");
}

function getUserDir() {
    let dir = GLib.get_user_config_dir() + "/" + UUID;
    let file = Gio.file_new_for_path(dir);
    if (!file.query_exists(null)) file.make_directory_with_parents(null);
    return dir;
}

function getCacheDir() {
    let dir = GLib.get_user_cache_dir() + "/" + UUID;
    let file = Gio.file_new_for_path(dir);
    if (!file.query_exists(null)) file.make_directory_with_parents(null);
    return dir;
}

function hexToCanvasRgb(colorStr, defaultColor) {
    try {
        let c = colorStr || defaultColor || "#888888";
        c = c.toString().trim();

        // Case 1: rgb(...) or rgba(...) - Standard Cinnamon Output
        if (c.indexOf("rgb") === 0) {
            let parts = c.match(/[0-9.]+/g);
            if (parts && parts.length >= 3) {
                return [parseFloat(parts[0]) / 255, parseFloat(parts[1]) / 255, parseFloat(parts[2]) / 255];
            }
        }

        // Case 2: Hex #RRGGBB
        if (c.indexOf("#") === 0) {
            c = c.replace('#', '');
            if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
            if (c.length >= 6) {
                return [parseInt(c.substring(0, 2), 16) / 255, parseInt(c.substring(2, 4), 16) / 255, parseInt(c.substring(4, 6), 16) / 255];
            }
        }
        return [0.5, 0.5, 0.5];
    } catch (e) { return [0.5, 0.5, 0.5]; }
}

function parseColorString(colorStr) {
    if (!colorStr) return { r: 0, g: 0, b: 0, a: 1 };
    try {
        colorStr = colorStr.toString().trim();
        if (colorStr.startsWith("rgb")) {
            let parts = colorStr.match(/[0-9.]+/g);
            if (parts && parts.length >= 3) {
                let r = parseFloat(parts[0]) / 255;
                let g = parseFloat(parts[1]) / 255;
                let b = parseFloat(parts[2]) / 255;
                let a = (parts.length > 3) ? parseFloat(parts[3]) : 1.0;
                return { r, g, b, a };
            }
        } else if (colorStr.startsWith("#")) {
            let rgb = hexToCanvasRgb(colorStr);
            return { r: rgb[0], g: rgb[1], b: rgb[2], a: 1.0 };
        }
    } catch(e) {}
    return { r: 0.5, g: 0.5, b: 0.5, a: 1.0 };
}

function sendNotification(title, message, filename = "suspend-error.oga", iconPath = "dialog-information", fallbackId = "dialog-warning") {
    try {
        // We add a hint so the system treats the icon as part of the UI theme
        Util.spawnCommandLine('notify-send "' + title + '" "' + message + '" --icon=' + iconPath + ' --urgency=low -h string:sound-name:none -h int:suppress-sound:1 -h string:x-canonical-private-icon-only:1');

        if (!_applet || !_applet.metadata) return;
        let soundPath = _applet.metadata.path + "/sounds/" + filename;

        // Fix: Use 'paplay' (PulseAudio) instead of 'canberra' for more reliable sound
        let f = Gio.file_new_for_path(soundPath);
        if (f.query_exists(null)) {
            // paplay is standard on Cinnamon/Mint for audio
            Util.spawnCommandLine('paplay "' + soundPath + '"');
        } else {
            // Fallback to system sound ID
            Util.spawnCommandLine('canberra-gtk-play --id="' + fallbackId + '"');
        }
    } catch (e) {
        global.logError("Notification Error: " + e);
    }
}

function formatPrice(price, idx, forceDetails = false) {
    if (price === undefined || price === null || price === 0) return " " + _("Loading...");
    let isCompact = _applet.settings.getValue("compact-mode") && !forceDetails;
    if (isCompact) {
        if (price >= 1000000) return (price / 1000000).toFixed(1) + "M";
        if (price >= 1000) return (price / 1000).toFixed(1) + "K";
        if (price < 1) return price.toFixed(2);
        return price.toFixed(0);
    }
    let globalShow = _applet.settings.getValue("global-show-cents") ?? true;
    let metricShow = _applet.settings.getValue(_applet.metrics[idx].key_show_cents);
    
    let decimals = 0;
    if (globalShow && metricShow) {
        let setDec = _applet.settings.getValue(_applet.metrics[idx].key_decimals);
        if (typeof setDec === 'number') decimals = setDec;
        else decimals = (price < 1 ? 4 : 2);
    }
    
    let parts = price.toFixed(decimals).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(decimals > 0 ? "." : "");
}

function downloadIcon(id, url) {
    if (!url) return;
    let iconDir = Gio.file_new_for_path(getCacheDir() + "/icons");
    if (!iconDir.query_exists(null)) iconDir.make_directory(null);

    let destPath = getCacheDir() + "/icons/" + id + ".png";
    let destFile = Gio.file_new_for_path(destPath);
    
    let needsDownload = true;
    
    if (destFile.query_exists(null)) {
        try {
            let info = destFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
            let modified = info.get_attribute_uint64('time::modified');
            let now = Math.floor(Date.now() / 1000);
            let twoWeeks = 1209600; // 14 days in seconds
            
            // If younger than 2 weeks, do not reload
            if ((now - modified) < twoWeeks) {
                needsDownload = false;
            }
        } catch (e) {
            global.logError("Crypto-Tracker: Error checking icon age: " + e);
        }
    }

    if (needsDownload) {
        Util.spawn_async(['curl', '-s', '-o', destPath, url], () => { });
    }
}

function cleanupUnusedIcons(activeIds) {
    let iconDir = Gio.file_new_for_path(getCacheDir() + "/icons");
    if (!iconDir.query_exists(null)) return;

    try {
        let enumerator = iconDir.enumerate_children('standard::name,time::modified', Gio.FileQueryInfoFlags.NONE, null);
        let fileInfo;
        let now = Math.floor(Date.now() / 1000);
        let threeMonths = 7776000; // 90 days in seconds

        while ((fileInfo = enumerator.next_file(null)) !== null) {
            let name = fileInfo.get_name();
            if (!name.endsWith(".png")) continue; // Only check downloaded PNGs

            let id = name.replace(".png", "");
            
            // If ID is not actively used
            if (!activeIds.includes(id)) {
                let modified = fileInfo.get_attribute_uint64('time::modified');
                // And older than 3 months -> Delete
                if ((now - modified) > threeMonths) {
                    let file = iconDir.get_child(name);
                    try {
                        file.delete(null);
                    } catch (e) {}
                }
            }
        }
    } catch (e) {
        global.logError("Crypto-Tracker: Error cleaning up icons: " + e);
    }
}

function addScrollArrows(scrollView) {
    // Hide scrollbar (Hack for "scrolling without bar")
    let vbar = scrollView.get_vscroll_bar();
    if (vbar) {
        vbar.set_opacity(0);
        vbar.set_width(0);
    }
    
    // IMPORTANT: Enable clipping so vfade effect doesn't protrude over buttons and steal clicks
    scrollView.set_clip_to_allocation(true);

    // Standard Vertical Box: Robust and safe
    let outerBox = new St.BoxLayout({ vertical: true });
    
    // --- BUTTONS ---
    let createArrow = (iconName, callback) => {
        // Back to St.Button for reliable event handling and centering
        let btn = new St.Button({ 
            style: "height: 20px; min-height: 20px; width: 100%; padding: 0; margin: 0; border: 0; background-color: rgba(0,0,0,0.01); box-shadow: none; border-radius: 0;", 
            visible: false,
            reactive: true,
            can_focus: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        
        // Larger arrow (16px)
        let icon = new St.Icon({ icon_name: iconName, icon_size: 16, style: "color: " + _applet.colors.text_more_dim + ";" });
        btn.set_child(icon);
        
        // Save status flag directly on button
        btn._canScroll = false;

        btn.connect('enter-event', () => { 
            if (btn._canScroll) icon.set_style("color: " + _applet.colors.text + ";");
        });
        btn.connect('leave-event', () => { 
            if (btn._canScroll) icon.set_style("color: " + _applet.colors.text_more_dim + ";");
        });
        
        btn.connect('clicked', () => {
            if (btn._canScroll) callback();
        });
        return { btn, icon };
    };

    let vAdj = scrollView.get_vscroll_bar().get_adjustment();
    
    let upObj = createArrow("pan-up-symbolic", () => { 
        vAdj.set_value(Math.max(vAdj.lower, vAdj.value - 80)); // Slightly faster (80 instead of 60)
    });
    let upBtn = upObj.btn;
    let upIcon = upObj.icon;
    
    let downObj = createArrow("pan-down-symbolic", () => { 
        vAdj.set_value(Math.min(vAdj.upper - vAdj.page_size, vAdj.value + 80)); 
    });
    let downBtn = downObj.btn;
    let downIcon = downObj.icon;

    let updateArrows = () => {
        let val = vAdj.value;
        let upper = vAdj.upper;
        let page = vAdj.page_size;
        
        // If no scrolling needed -> Hide (free up space)
        if (upper <= page) { upBtn.hide(); downBtn.hide(); return; }
        
        // If scrolling needed -> Reserve space (Static)
        upBtn.show();
        downBtn.show();
        
        // Top: Control visibility instead of hiding button
        if (val > vAdj.lower + 1) {
            upBtn._canScroll = true;
            upIcon.set_opacity(255);
            upBtn.set_reactive(true);
        } else {
            upBtn._canScroll = false;
            upIcon.set_opacity(0); // Invisible, but button stays
            upIcon.set_style("color: " + _applet.colors.text_more_dim + ";"); // Reset hover color
            upBtn.set_reactive(true); // Keep reactive to intercept clicks into void
        }
        
        // Bottom
        if (val < upper - page - 1) {
            downBtn._canScroll = true;
            downIcon.set_opacity(255);
            downBtn.set_reactive(true);
        } else {
            downBtn._canScroll = false;
            downIcon.set_opacity(0);
            downIcon.set_style("color: " + _applet.colors.text_more_dim + ";");
            downBtn.set_reactive(true);
        }
    };

    vAdj.connect('notify::value', updateArrows);
    vAdj.connect('changed', updateArrows);
    Mainloop.timeout_add(100, () => { updateArrows(); return false; });

    // Simple vertical layout: Top button, middle content, bottom button
    outerBox.add(upBtn, { x_fill: true, y_fill: false, expand: false });
    outerBox.add(scrollView, { expand: true });
    outerBox.add(downBtn, { x_fill: true, y_fill: false, expand: false });
    
    return outerBox;
}

// Helper: Write errors to separate file (for easier debugging)
function logToErrorFile(context, error) {
    if (!_applet || !_applet.metadata) return;
    try {
        let path = getCacheDir() + "/error_log.txt";
        let file = Gio.file_new_for_path(path);
        
        // FIX: Automatic rotation (delete) if larger than 1MB
        if (file.query_exists(null)) {
            try {
                let info = file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null);
                if (info.get_size() > 1048576) { // 1MB Limit
                    file.delete(null);
                }
            } catch(e) {}
        }

        let now = new Date().toISOString();
        let stack = (error && error.stack) ? "\nStack: " + error.stack : "";
        let message = `[${now}] [${context}] ${error}${stack}\n------------------------------------------------\n`;
        
        let stream;
        if (file.query_exists(null)) {
            stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        } else {
            stream = file.create(Gio.FileCreateFlags.NONE, null);
        }
        
        let out = new Gio.DataOutputStream({ base_stream: stream });
        out.put_string(message, null);
        out.close(null);

        // FIX: Send notification (throttled, max 1x every 10s) so errors are noticed
        if (context !== "System") {
            let showNotifications = true;
            if (_applet.settings && typeof _applet.settings.getValue === 'function') {
                showNotifications = _applet.settings.getValue("dev-show-error-notifications");
            }
            if (showNotifications) {
                let nowTime = Date.now();
                if (!_applet._lastErrorNotification || (nowTime - _applet._lastErrorNotification > 10000)) {
                    _applet._lastErrorNotification = nowTime;
                    
                    // FIX: Intelligent error analysis for the user
                    let hint = "";
                    let errStr = error.toString();
                    if (errStr.includes("429")) hint = _(" (Rate Limit)");
                    else if (errStr.includes("401") || errStr.includes("403")) hint = _(" (API Key invalid)");
                    else if (errStr.includes("network") || errStr.includes("resolve")) hint = _(" (Network)");

                    sendNotification(_("Crypto-Tracker Error"), _("An error was intercepted%s. See log.").format(hint), "dialog-error.oga", "dialog-error-symbolic", "dialog-error");
                }
            }
        }
    } catch (e) {
        global.logError("Crypto-Tracker Logger Error: " + e);
    }
}

// --- SAFETY BLOCK ---
// Prevents errors in callbacks from crashing the desktop
function safeCallback(func, context = "Unknown") {
    return function(...args) {
        try {
            return func.apply(this, args);
        } catch (e) {
            global.logError("[Crypto-Tracker] CRASH PREVENTED in " + context + ": " + e);
            logToErrorFile(context, e);
            return false; // Stops timer if running in a mainloop
        }
    };
}

// Special protection for graphics operations (most common crash cause)
function safeRepaint(area, drawFunc) {
    if (!area) return;
    area.connect('repaint', (a) => {
        let cr = null;
        try {
            cr = a.get_context();
            let [w, h] = a.get_surface_size();
            
            // Block: Protection against invalid dimensions (causes segfaults)
            if (w === undefined || h === undefined || w <= 0 || h <= 0 || isNaN(w) || isNaN(h)) {
                return;
            }
            
            drawFunc(a, cr, w, h);
        } catch (e) {
            global.logError("[Crypto-Tracker] DRAWING CRASH PREVENTED: " + e);
            logToErrorFile("DrawingArea Repaint", e);
        } finally {
            if (cr) cr.$dispose(); // Automatic memory cleanup
        }
    });
}

var Utils = {
    init: init,
    getUserDir: getUserDir,
    getCacheDir: getCacheDir,
    hexToCanvasRgb: hexToCanvasRgb,
    parseColorString: parseColorString,
    sendNotification: sendNotification,
    formatPrice: formatPrice,
    downloadIcon: downloadIcon,
    cleanupUnusedIcons: cleanupUnusedIcons,
    addScrollArrows: addScrollArrows,
    safeCallback: safeCallback,
    safeRepaint: safeRepaint,
    logToErrorFile: logToErrorFile
};