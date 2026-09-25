import * as app from './app/app.js';
import { initialize_applet_settings } from './app/initialize_applet_settings.js';
import { initialize_globals, logger } from './globals.js';

/**
 * @param {imports.ui.applet.IconApplet} applet
 * @param {Readonly<imports.ui.applet.AppletMetadata>} metadata
 */
export function initialize(applet, metadata) {
    initialize_globals(metadata); // Must be called before anything else

    const settings = initialize_applet_settings(
        metadata.uuid, applet.instance_id
    );

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
}
