/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Criteria: changing the screen lock state must trigger the console log at either the locking and unlocking events.
 */

imports.searchPath.push('/usr/share/cinnamon/js');

const { Screen_lock_change_listener } = await import('../Screen_lock_change_listener.js');

const screen_lock = new Screen_lock_change_listener();
screen_lock.callback = (/** @type {boolean} */ is_locked) => {
    console.log(
        `Screen lock state changed: ${is_locked ? 'locked' : 'unlocked'}`
    );
};
screen_lock.enable();

new imports.gi.GLib.MainLoop(null, false).run();
