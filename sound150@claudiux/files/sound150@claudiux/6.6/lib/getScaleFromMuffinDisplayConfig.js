//!/usr/bin/cjs

const Gio = imports.gi.Gio;

// DBus constants for Muffin's DisplayConfig API
const DISPLAY_CONFIG_BUS_NAME = "org.cinnamon.Muffin.DisplayConfig";
const DISPLAY_CONFIG_OBJECT_PATH = "/org/cinnamon/Muffin/DisplayConfig";

/**
 * getScaleFromMuffinDisplayConfig
 *
 * Returns a Promise that resolves to the current UI scale factor by querying
 * Muffin's DBus DisplayConfig API asynchronously (non-blocking).
 *
 * Gio.DBus.session is a module-level shared singleton; no proxy object is
 * recreated on each call.
 *
 * GetCurrentState() tuple layout:
 *   (serial, physical_monitors, logical_monitors, properties)
 *
 * logical_monitors entry layout:
 *   [0] x, [1] y, [2] scale, [3] transform, [4] primary,
 *   [5] linked_monitors_info, [6] props
 *
 * linked_monitors_info entry layout:
 *   [0] connector, [1] vendor, [2] product, [3] serial
 *
 * physical_monitors entry layout:
 *   [0] monitor_info, [1] monitor_modes, [2] monitor_properties
 *   monitor_info: [0] connector, [1] vendor, [2] product, [3] serial
 *   monitor_modes entry: [0] id, [1] width, [2] height, [3] refresh,
 *                        [4] preferred_scale, [5] supported_scales,
 *                        [6] mode_properties (dict, "is-current" key)
 *
 * @returns {Promise<number>} Resolves to scale factor, e.g. 0.75, 1.0, 1.25,
 *                            1.5, 1.75, 2.0. Falls back to 1.0 on error or
 *                            if no current mode is found.
 */
function getScaleFromMuffinDisplayConfig() {
    return new Promise((resolve) => {
        try {
            Gio.DBus.session.call(
                DISPLAY_CONFIG_BUS_NAME,
                DISPLAY_CONFIG_OBJECT_PATH,
                DISPLAY_CONFIG_BUS_NAME,
                "GetCurrentState",
                null,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (connection, result) => {
                    try {
                        const reply = connection.call_finish(result);
                        // reply is a GLib.Variant tuple:
                        // (serial, physical_monitors, logical_monitors, properties)
                        const [, physicalMonitors, logicalMonitors] =
                            reply.deep_unpack();

                        for (const logicalMonitor of logicalMonitors) {
                            // logicalMonitor[2] = scale
                            // logicalMonitor[5] = linked_monitors_info
                            const scale = logicalMonitor[2];
                            const linkedMonitorsInfo = logicalMonitor[5];

                            for (const linked of linkedMonitorsInfo) {
                                // linked[0] = connector
                                const linkedConnector = linked[0];

                                for (const physicalMonitor of physicalMonitors) {
                                    // physicalMonitor[0] = monitor_info
                                    // physicalMonitor[1] = monitor_modes
                                    const monitorInfo = physicalMonitor[0];
                                    const monitorModes = physicalMonitor[1];
                                    // monitorInfo[0] = connector
                                    if (monitorInfo[0] === linkedConnector) {
                                        for (const mode of monitorModes) {
                                            // mode[6] = mode_properties dict
                                            const modeProperties = mode[6];
                                            if (modeProperties["is-current"] === true) {
                                                resolve(scale);
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // No current mode found; fall back to 1.0
                        resolve(1.0);
                    } catch (_e) {
                        resolve(1.0);
                    }
                }
            );
        } catch (_e) {
            resolve(1.0);
        }
    });
}

module.exports = {
    getScaleFromMuffinDisplayConfig
};
