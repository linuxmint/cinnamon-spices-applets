// Pure drawer bookkeeping. No gi imports on purpose: test.js runs this under plain cjs.

/** Stable id of one applet instance. */
function keyFor(uuid, instanceId) {
    return uuid + ":" + instanceId;
}

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
 * The app behind a StatusNotifier Id.
 *
 * The spec asks for a name unique to the application and stable across
 * sessions, which is exactly what we want. Electron builds it as
 * "<app>_status_icon_<n>", so the counter comes off.
 */
function appName(id) {
    if (!id)
        return "";
    return id.replace(/_status_icon_\d+$/, "").trim();
}

/** The same, folded to one case so a key never depends on how an app spells itself. */
function normalizeId(id) {
    return appName(id).toLowerCase();
}

/**
 * Stable id of one tray icon, best effort.
 *
 * XApp reports a Name that is usually the app ("blueman", "steam"), but apps
 * coming in over StatusNotifier often report their bus address instead
 * (":1.204"), and that changes every session. Ask those for the Id they
 * registered with, and fall back to the tooltip.
 */
function trayKey(icon) {
    let name = icon.name || "";
    if (name && name.charAt(0) !== ":")
        return "xapp:" + name;

    let id = normalizeId(icon.id);
    if (id)
        return "xapp:" + id;

    let tooltip = normalizeTooltip(icon.tooltip);
    if (tooltip)
        return "xapp:" + tooltip;

    return "xapp:" + name;      // unstable, but at least usable in this session
}

/**
 * What to call this icon in the menu.
 *
 * The key is folded and stripped so it can be matched, which reads poorly
 * ("openrgb", "microsoft teams"), so show the name the app gave itself: the one
 * it handed XApp, else the one it registered its StatusNotifier item under.
 *
 * Tooltips are deliberately not a source. Half of them are a status rather than
 * a name ("You have unread messages") and they change while the app runs.
 */
function trayLabel(icon) {
    let name = icon.name || "";
    if (name && name.charAt(0) !== ":")
        return name;

    let id = appName(icon.id);
    if (id)
        return id;

    return trayKey(icon).substring("xapp:".length);
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
