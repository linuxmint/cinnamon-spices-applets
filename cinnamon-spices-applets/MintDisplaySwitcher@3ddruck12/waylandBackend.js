// waylandBackend.js — Wayland-Display-Backend (v1: Status lesen, Apply = Stub)

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;
const DisplayInfo = require('./displayInfo');

/** Pfad zur Cinnamon-Monitor-Konfiguration (Connector-Namen) */
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
     * Liest Display-Status aus layoutManager und optional monitors.xml.
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

        // Monitore aus Cinnamon layoutManager (Position, Größe)
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

        // Bekannte externe Connectors aus XML, auch wenn nicht aktiv
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

        // Fallback: ein Monitor = intern
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
     * Wayland v1: Umschalten noch nicht implementiert — öffnet Anzeige-Einstellungen.
     * @param {string} mode
     * @returns {{ success: boolean, error?: string, fallback?: string }}
     */
    applyMode(mode, options = {}) {
        // TODO Phase 2: monitors.xml schreiben + Settings Daemon anstoßen
        Util.spawnCommandLineAsync('cinnamon-settings display');
        return {
            success: false,
            error: 'wayland-not-implemented',
            fallback: 'settings-opened'
        };
    }

    /**
     * Liest Connector-Namen aus ~/.config/monitors.xml.
     * @returns {Array<{name: string, role: string}>}
     */
    _parseMonitorsXml() {
        const result = [];

        try {
            const file = Gio.File.new_for_path(MONITORS_XML);
            if (!file.query_exists(null))
                return result;

            const [, contents] = file.load_contents(null);
            const text = ByteArray.toString(contents);

            // Einfaches Parsing: <connector>eDP-1</connector> pro <monitors>…<monitors>-Block
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
            global.logError('[MintDisplaySwitcher] monitors.xml lesen fehlgeschlagen: ' + e.message);
        }

        return result;
    }
}
