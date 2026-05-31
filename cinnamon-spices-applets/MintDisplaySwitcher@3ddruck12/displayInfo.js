// displayInfo.js — Normalisiertes Display-Datenmodell und Modus-Erkennung (backend-neutral)

/** Anzeigemodi — entsprechen den Menüeinträgen */
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
    laptop: 'Nur Laptop-Bildschirm',
    external: 'Nur externer Bildschirm',
    mirror: 'Bildschirm spiegeln',
    extend: 'Bildschirm erweitern'
};

/** Regex: typische interne Laptop-Panels (Embedded DisplayPort, LVDS, DSI) */
const INTERNAL_OUTPUT_PATTERN = /^(eDP-|LVDS-|DSI-)/i;

/** Regex: typische externe Anschlüsse (HDMI, DisplayPort, DVI, VGA) */
const EXTERNAL_OUTPUT_PATTERN = /^(HDMI-|DP-\d|DVI-|VGA-|DisplayPort-)/i;

/**
 * Klassifiziert einen xrandr-Output-Namen als intern oder extern.
 * @param {string} name — z. B. "eDP-1" oder "HDMI-1"
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
 * Erzeugt ein leeres Output-Objekt für den DisplaySnapshot.
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
 * Erkennt den aktiven Anzeigemodus aus einem normalisierten DisplaySnapshot.
 *
 * Logik:
 * - Nur intern aktiv           → laptop
 * - Nur extern aktiv            → external
 * - Beide aktiv, gleiche Position → mirror
 * - Beide aktiv, verschiedene Position → extend
 *
 * @param {object} snapshot — DisplaySnapshot vom Backend
 * @returns {string} MODES-Wert
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
        // Gleiche Position und Auflösung → Spiegeln
        if (internal.x === external.x &&
            internal.y === external.y &&
            internal.width === external.width &&
            internal.height === external.height)
            return MODES.MIRROR;

        return MODES.EXTEND;
    }

    // Fallback: nur Laptop, wenn nichts erkannt
    return MODES.LAPTOP;
}

/**
 * Prüft, ob ein Modus für das aktuelle Setup gültig ist.
 * @param {string} mode — MODES-Wert
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
 * Formatiert die Infozeile für das Popup-Menü.
 * @param {object} snapshot — DisplaySnapshot
 * @returns {string}
 */
function formatInfoLine(snapshot) {
    if (!snapshot)
        return '';

    const internalName = snapshot.internal
        ? snapshot.internal.name + (snapshot.internal.active ? '' : ' (aus)')
        : '—';
    const externalName = snapshot.external
        ? (snapshot.external.connected
            ? snapshot.external.name + (snapshot.external.active ? '' : ' (aus)')
            : snapshot.external.name + ' (nicht verbunden)')
        : '— (kein externer Anschluss)';

    const backendLabel = snapshot.backend === 'wayland'
        ? 'Wayland (experimentell)'
        : 'X11';

    return `Intern: ${internalName} · Extern: ${externalName} · ${backendLabel}`;
}
