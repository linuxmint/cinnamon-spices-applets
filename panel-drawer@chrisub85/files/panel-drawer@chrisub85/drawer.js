// Pure drawer bookkeeping. No gi imports on purpose: test.js runs this under plain cjs.

/** Stable id of one applet instance. */
function keyFor(uuid, instanceId) {
    return uuid + ":" + instanceId;
}

// Bus names of the proxies flatpak'd apps talk through - their /proc comm says
// nothing about the app behind them.
const PROXY_COMMS = ["xdg-dbus-proxy", "flatpak-session-helper", "bwrap"];

/** "Microsoft Teams (2)" -> "Microsoft Teams", so a message counter does not change the key. */
function normalizeTooltip(tooltip) {
    if (!tooltip)
        return "";
    return tooltip.split("\n")[0]
                  .replace(/\s*[\(\[]\s*\d+\s*[\)\]]\s*$/, "")
                  .replace(/\s+/g, " ")
                  .trim();
}

/**
 * Stable id of one tray icon, best effort.
 *
 * XApp reports a Name that is usually the app ("blueman", "steam"), but apps
 * coming in over StatusNotifier often report their bus address instead
 * (":1.204"), and that changes every session. Fall back to the process behind
 * the bus name, then to the tooltip.
 */
function trayKey(icon) {
    let name = icon.name || "";
    if (name && name.charAt(0) !== ":")
        return "xapp:" + name;

    if (icon.comm && PROXY_COMMS.indexOf(icon.comm) < 0)
        return "xapp:" + icon.comm;

    let tooltip = normalizeTooltip(icon.tooltip);
    if (tooltip)
        return "xapp:" + tooltip;

    return "xapp:" + name;      // unstable, but at least usable in this session
}

/**
 * What to hide and what to show, given the live panel and the drawer state.
 *
 * items:       [{key, visible}] - applets and tray icons currently on the panel
 * keys:        [key]            - what the user put in the drawer
 * hiddenByUs:  [key]            - what we hid and are therefore allowed to show again
 * collapsed:   bool             - drawer state
 *
 * Anything hidden by somebody else (its own logic, another applet) is never
 * touched: we only ever show back what we hid ourselves.
 */
function plan(items, keys, hiddenByUs, collapsed) {
    let live = {};
    items.forEach(function(i) { live[i.key] = i; });

    let isMember = function(key) { return keys.indexOf(key) > -1; };
    let toHide = [], toShow = [];

    if (collapsed) {
        items.forEach(function(i) {
            if (isMember(i.key) && i.visible && hiddenByUs.indexOf(i.key) < 0)
                toHide.push(i.key);
        });
    }

    hiddenByUs.forEach(function(key) {
        if (!live[key])                             // gone - nothing to show
            return;
        if (!collapsed || !isMember(key))           // expanded, or taken out of the drawer
            toShow.push(key);
    });

    return { toHide: toHide, toShow: toShow };
}
