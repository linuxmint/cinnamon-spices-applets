const { IconApplet } = imports.ui.applet;

import * as app from './app/app.js';
import { initialize_applet_settings } from './app/initialize_applet_settings.js';
import { initialize_globals, logger } from './globals.js';

/** @typedef {import('./app/ui/Applet.js').Applet} Applet */

/**
 * @param {imports.ui.applet.AppletMetadata} metadata
 * @param {imports.gi.St.Side} orientation
 * @param {number} panel_height
 * @param {number} instance_id
 * @returns {imports.ui.applet.Applet}
 */
function main(metadata, orientation, panel_height, instance_id) {
    initialize_globals(metadata); // Must be called before anything else

    const applet = /** @type {Applet} */ (new IconApplet(
        orientation, panel_height, instance_id
    ));

    const settings = initialize_applet_settings(metadata.uuid, instance_id);

    try {
        app.initialize(applet, settings);
    } catch (error) {
        applet.set_applet_icon_symbolic_name('on-error-symbolic');
        if (error instanceof Error)
            logger.error(error.message);
        else
            logger.error(String(error));
        settings.finalize(); // somewhat crash // TODO: find a better way?
    }

    return applet;
}

globalThis.__auto_dark_light__ = main; // Prevents transpilation tree-shaking
