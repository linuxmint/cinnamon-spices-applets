/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Criteria: changing the sleeping state must trigger the console log at either the sleeping and waking events.
 */

imports.searchPath.push('/usr/share/cinnamon/js');

const { Sleep_events_listener } = await import('../Sleep_events_listener.js');

const sleep_events = new Sleep_events_listener();
sleep_events.callback = (/** @type {boolean} */ is_entering_sleep) => {
    console.log(
        `Sleep state changed: ${is_entering_sleep ? 'entering sleep' : 'woke up'}`
    );
};
sleep_events.enable();

new imports.gi.GLib.MainLoop(null, false).run();
