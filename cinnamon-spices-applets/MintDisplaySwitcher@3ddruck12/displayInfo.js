// displayInfo.js — Normalised display data model and mode detection (backend-neutral)

/** Display modes — correspond to the menu entries */
const MODES = {
    LAPTOP: 'laptop',
    EXTERNAL: 'external',
    MIRROR: 'mirror',
    EXTEND: 'extend'
};

const MODE_ICONS = {
    laptop: 'xsi-video-single-display-symbolic',
    external: 'xsi-display-projector-symbolic',
    mirror: 'xsi-view-mirror-symbolic',
    extend: 'xsi-view-dual-symbolic'
};

const MODE_LABELS = {
    laptop: 'Laptop only',
    external: 'External only',
    mirror: 'Mirror',
    extend: 'Extend'
};

/** Regex: typical internal laptop panels (Embedded DisplayPort, LVDS, DSI) */
const INTERNAL_OUTPUT_PATTERN = /^(eDP-|LVDS-|DSI-)/i;

/** Regex: typical external connectors (HDMI, DisplayPort, DVI, VGA) */
const EXTERNAL_OUTPUT_PATTERN = /^(HDMI-|DP-\d|DVI-|VGA-|DisplayPort-)/i;

/**
 * Classifies an xrandr output name as internal or external.
 * @param {string} name — e.g. "eDP-1" or "HDMI-1"
 * @returns {'internal'|'external'|'unknown'}
 */
function classifyOutputRole(name) {
    if (INTERNAL_OUTPUT_PATTERN.test(name))
        return 'internal';
    if (EXTERNAL_OUTPUT_PATTERN.test(name))
        return 'external';
    return 'unknown';
}

/**
 * Creates an empty output object for the DisplaySnapshot.
 */
function emptyOutput(name, role) {
    return {
        name: name,
        role: role,
        connected: false,
        active: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        primary: false,
        mirroredWith: null
    };
}

/**
 * Detects the active display mode from a normalised DisplaySnapshot.
 *
 * Logic:
 * - Only internal active            → laptop
 * - Only external active            → external
 * - Both active, same position      → mirror
 * - Both active, different position → extend
 *
 * @param {object} snapshot — DisplaySnapshot from the backend
 * @returns {string} MODES value
 */
function detectMode(snapshot) {
    if (!snapshot)
        return MODES.LAPTOP;

    const internal = snapshot.internal;
    const external = snapshot.external;

    const internalActive = internal && internal.connected && internal.active;
    const externalActive = external && external.connected && external.active;

    if (internalActive && !externalActive)
        return MODES.LAPTOP;

    if (!internalActive && externalActive)
        return MODES.EXTERNAL;

    if (internalActive && externalActive) {
        // Same position and resolution → mirror
        if (internal.x === external.x &&
            internal.y === external.y &&
            internal.width === external.width &&
            internal.height === external.height)
            return MODES.MIRROR;

        return MODES.EXTEND;
    }

    // Fallback: laptop only when nothing is detected
    return MODES.LAPTOP;
}

/**
 * Checks whether a mode is available for the current display setup.
 * @param {string} mode — MODES value
 * @param {object} snapshot — DisplaySnapshot
 * @returns {boolean}
 */
function isModeAvailable(mode, snapshot) {
    if (!snapshot)
        return false;

    const internal = snapshot.internal;
    const external = snapshot.external;
    const externalConnected = external && external.connected;
    const internalPresent = internal && internal.connected;

    switch (mode) {
    case MODES.LAPTOP:
        return internalPresent;
    case MODES.EXTERNAL:
        return externalConnected;
    case MODES.MIRROR:
    case MODES.EXTEND:
        return internalPresent && externalConnected;
    default:
        return false;
    }
}

/**
 * Formats the info line for the popup menu.
 * @param {object} snapshot — DisplaySnapshot
 * @returns {string}
 */
function formatInfoLine(snapshot) {
    if (!snapshot)
        return '';

    const internalName = snapshot.internal
        ? snapshot.internal.name + (snapshot.internal.active ? '' : ' (off)')
        : '—';
    const externalName = snapshot.external
        ? (snapshot.external.connected
            ? snapshot.external.name + (snapshot.external.active ? '' : ' (off)')
            : snapshot.external.name + ' (not connected)')
        : '— (no external output)';

    const backendLabel = snapshot.backend === 'wayland'
        ? 'Wayland (experimental)'
        : 'X11';

    return `Internal: ${internalName} · External: ${externalName} · ${backendLabel}`;
}
