const { Gio } = imports.gi;
const { IconApplet } = imports.ui.applet;

/**
 * @param {imports.ui.applet.AppletMetadata} metadata
 * @param {imports.gi.St.Side} orientation
 * @param {number} panel_height
 * @param {number} instance_id
 * @returns {imports.ui.applet.Applet}
 */
function main(metadata, orientation, panel_height, instance_id) {
    const applet = new IconApplet(orientation, panel_height, instance_id);
    applet.set_applet_icon_symbolic_name('content-loading');
    applet.set_applet_tooltip(`Loading ${metadata.uuid}…`);

    const uri =
        Gio.File.new_for_path(`${metadata.path}/src/main.js`).get_uri()
        + `?v=${Date.now()}`; // Allows reload without restart of Cinnamon

    import(uri)
        .then((/** @type {import('./src/main.js')} */ { initialize }) => {
            initialize(applet, metadata);
        })
        .catch((/** @type {Error} */ error) => {
            global.logError(`${metadata.uuid}: ${error}\n${error.stack}`);
        });

    return applet;
}
