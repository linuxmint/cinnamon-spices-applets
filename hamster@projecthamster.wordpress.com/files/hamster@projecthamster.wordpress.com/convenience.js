/*
 * Convenience functions used by Hamster cinnamon applet
 * Copyright (c) 2013 Jon Brett <jonbrett.dev@gmail.com>
 *
 * This project is released under the GNU GPL License.
 * See COPYING for details.
 */

const Gio = imports.gi.Gio;
const Lang = imports.lang;

function getAppletSettings(schema, schemaPath) {

    /* Try getting a schema from the schemas path, fallback to default
     * schema */
    let schemaSrc = Gio.SettingsSchemaSource.new_from_directory(
            schemaPath, Gio.SettingsSchemaSource.get_default(), false);

    let appSchema = schemaSrc.lookup(schema, true);
    if (!appSchema)
        throw new Error('Schema ' + schema + ' could not be found in path' + schemaPath);

    return new Gio.Settings({ settings_schema: appSchema });
}
