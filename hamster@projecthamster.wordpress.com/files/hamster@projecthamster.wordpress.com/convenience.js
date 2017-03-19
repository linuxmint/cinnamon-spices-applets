/*
 * Convenience functions used by Hamster cinnamon applet
 * Copyright (c) 2013 Jon Brett <jonbrett.dev@gmail.com>
 *
 * This project is released under the GNU GPL License.
 * See COPYING for details.
 * Portions originate from the gnome-shell source code, Copyright (c)
 * its respectives authors.
*/

const Gio = imports.gi.Gio;

const HAMSTER_APPLET_SCHEMA = "org.cinnamon.hamster-applet";

function getSettings(schema) {
    /* Try getting a schema from the schemas path, fallback to default
     * schema */
    schema = schema || HAMSTER_APPLET_SCHEMA;
    if (Gio.Settings.list_schemas().indexOf(schema) == -1)
        throw _("Schema \"%s\" not found.").format(schema);
    return new Gio.Settings({ schema: schema });
}
