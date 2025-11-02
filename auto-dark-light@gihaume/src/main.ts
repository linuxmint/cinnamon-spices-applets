const { IconApplet } = imports.ui.applet;

import type { Applet } from './app/ui/Applet';
import { initialize_globals, logger } from './globals';
import { initialize_handlers } from './app/handlers/initialize_handlers';
import { initialize_applet_settings } from './app/initialize_applet_settings';

//! @preserve
function main(
    metadata: imports.ui.applet.AppletMetadata,
    orientation: imports.gi.St.Side,
    panel_height: number,
    instance_id: number
): imports.ui.applet.Applet {
    initialize_globals(metadata); // Must be called before anything else

    const applet = new IconApplet(
        orientation, panel_height, instance_id
    ) as Applet;

    const settings = initialize_applet_settings(metadata.uuid, instance_id);

    try {
        initialize_handlers(applet, settings);
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

(globalThis as any)[import.meta.env.VITE_KEEP_MAIN_FUNCTION_SENTINEL] = main; // Prevents transpilation tree-shaking
