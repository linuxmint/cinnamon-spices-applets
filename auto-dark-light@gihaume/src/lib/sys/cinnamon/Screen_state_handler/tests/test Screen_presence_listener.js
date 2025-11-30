/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Changing the sleeping state must trigger the console log at either the sleeping and waking events.
 */

imports.searchPath.push('/usr/share/cinnamon/js');

const { Screen_presence_listener } = await import('../Screen_presence_listener.js');

const listener = new Screen_presence_listener();
listener.callback = (/** @type {boolean} */ is_present) => {
    console.log(
        `Screen presence state changed: ${is_present ? 'present' : 'not present'}`
    );
};
listener.enable();

new imports.gi.GLib.MainLoop(null, false).run();
