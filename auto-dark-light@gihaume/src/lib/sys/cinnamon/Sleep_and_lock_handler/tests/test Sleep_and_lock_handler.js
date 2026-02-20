/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Changing the sleeping state must trigger the console log at either the entering sleep and woke up unlocked events.
 */

imports.searchPath.push('/usr/share/cinnamon/js');

const { Sleep_and_lock_handler } = await import('../Sleep_and_lock_handler.js');

const sleep_events = new Sleep_and_lock_handler();
sleep_events.callback = (/** @type {boolean} */ is_entering_sleep) => {
    console.log(
        `Sleep state changed: ${is_entering_sleep ? 'entering sleep' : 'woke up unlocked'}`
    );
};
sleep_events.enable();

await new imports.gi.GLib.MainLoop(null, false).runAsync();
