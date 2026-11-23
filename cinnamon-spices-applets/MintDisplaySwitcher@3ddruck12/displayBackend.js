// displayBackend.js — Factory für X11- und Wayland-Display-Backends

const Meta = imports.gi.Meta;
const X11Backend = require('./x11Backend');
const WaylandBackend = require('./waylandBackend');

/**
 * Erstellt das passende Display-Backend je nach Compositor (X11 oder Wayland).
 * @returns {object} Backend mit getSnapshot(), applyMode(), getName(), canApplyModes()
 */
function createDisplayBackend() {
    if (Meta.is_wayland_compositor())
        return new WaylandBackend.WaylandBackend();
    return new X11Backend.X11Backend();
}
