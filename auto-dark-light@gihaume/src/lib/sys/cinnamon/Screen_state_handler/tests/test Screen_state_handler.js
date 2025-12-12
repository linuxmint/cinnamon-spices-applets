/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Changing the sleeping state must trigger the console log at either the entering sleep and woke up unlocked events.
 */

imports.searchPath.push('/usr/share/cinnamon/js');

const { Screen_state_handler } = await import('../Screen_state_handler.js');

const screen_state = new Screen_state_handler();
screen_state.callback = (/** @type {boolean} */ is_present) => {
    console.log(
        `Sleep state changed: ${is_present ? 'woke up unlocked' : 'entering sleep or locking'}`
    );
};
screen_state.enable();

await new imports.gi.GLib.MainLoop(null, false).runAsync();
