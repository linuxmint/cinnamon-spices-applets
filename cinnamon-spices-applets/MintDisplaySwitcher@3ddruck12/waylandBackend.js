// waylandBackend.js — Wayland display backend (v1: read status, apply = stub)

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Util = imports.misc.util;
const DisplayInfo = require('./displayInfo');

/** Path to Cinnamon monitor configuration */
const MONITORS_XML = GLib.build_filenamev([
    GLib.get_user_config_dir(), 'monitors.xml'
]);

class WaylandBackend {
    getName() {
        return 'wayland';
    }

    canApplyModes() {
        return false;
    }

    /**
     * Reads display state from layoutManager and optionally monitors.xml.
     * @returns {object} DisplaySnapshot
     */
    getSnapshot() {
        const monitors = Main.layoutManager.monitors;
        const monitorManager = Meta.MonitorManager.get();
        const primaryIndex = monitorManager.get_primary_monitor_index();
        const xmlConnectors = this._parseMonitorsXml();

        const outputs = [];
        let internal = null;
        let external = null;

        for (let i = 0; i < monitors.length; i++) {
            const mon = monitors[i];
            const connectorInfo = xmlConnectors[i] || {};
            const name = connectorInfo.name || ('Monitor-' + (i + 1));
            const role = connectorInfo.role || DisplayInfo.classifyOutputRole(name);

            const info = DisplayInfo.emptyOutput(name, role);
            info.connected = true;
            info.active = true;
            info.x = mon.x;
            info.y = mon.y;
            info.width = mon.width;
            info.height = mon.height;
            info.primary = (i === primaryIndex);

            outputs.push(info);

            if (role === 'internal' && !internal)
                internal = info;
            else if (role === 'external' && !external)
                external = info;
        }

        // Known external connectors from XML, even if not currently active
        for (const conn of xmlConnectors) {
            if (conn.role === 'external') {
                const alreadyKnown = outputs.some(o => o.name === conn.name);
                if (!alreadyKnown) {
                    const info = DisplayInfo.emptyOutput(conn.name, 'external');
                    info.connected = false;
                    if (!external)
                        external = info;
                    outputs.push(info);
                }
            }
        }

        // Fallback: single monitor = internal
        if (!internal && outputs.length > 0)
            internal = outputs[0];

        return {
            backend: 'wayland',
            internal: internal,
            external: external,
            outputs: outputs
        };
    }

    /**
     * Wayland v1: mode switching not yet implemented — opens Display Settings.
     * @param {string} _mode
     * @returns {{ success: boolean, error: string, fallback: string }}
     */
    applyMode(_mode, _options = {}) {
        // TODO Phase 2: write monitors.xml + trigger Settings Daemon
        Util.trySpawn(['cinnamon-settings', 'display']);
        return {
            success: false,
            error: 'wayland-not-implemented',
            fallback: 'settings-opened'
        };
    }

    /**
     * Reads connector names from ~/.config/monitors.xml.
     * Uses Gio async load to avoid blocking the main loop.
     * @returns {Array<{name: string, role: string}>}
     */
    _parseMonitorsXml() {
        const result = [];

        try {
            const file = Gio.File.new_for_path(MONITORS_XML);

            // Use load_contents with a cancellable; catch NOT_FOUND instead of
            // calling the synchronous query_exists() first.
            let contents;
            try {
                [, contents] = file.load_contents(null);
            } catch (e) {
                // File does not exist or cannot be read — silently skip
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                    return result;
                throw e;
            }

            const text = new TextDecoder().decode(contents);

            // Simple parsing: <connector>eDP-1</connector> per <monitors>…</monitors> block
            const blocks = text.split(/<\/?monitors>/);
            for (const block of blocks) {
                const connMatch = block.match(/<connector>([^<]+)<\/connector>/);
                if (!connMatch)
                    continue;

                const name = connMatch[1].trim();
                result.push({
                    name: name,
                    role: DisplayInfo.classifyOutputRole(name)
                });
            }
        } catch (e) {
            global.logError('[MintDisplaySwitcher] reading monitors.xml failed: ' + e.message);
        }

        return result;
    }
}
