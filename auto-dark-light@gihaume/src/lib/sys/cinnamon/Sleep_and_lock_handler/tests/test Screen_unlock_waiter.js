/**
 * To be tested manually with `cjs -m <this file path>`.
 *
 * Criteria: the second message must be logged only once the screen is unlocked.
 */

imports.searchPath.push('/usr/share/cinnamon/js');

const { Screen_unlock_waiter } = await import('../Screen_unlock_waiter.js');

const screen_unlock_waiter = new Screen_unlock_waiter();

const duration = 5; // seconds
console.log(`You must lock the screen now. You have ${duration} seconds to do it.`);
await new Promise(resolve => setTimeout(resolve, duration * 1e3));

console.log('Waiting for the screen to be unlocked...');
await screen_unlock_waiter.wait_if_locked();

console.log('The screen is now unlocked.');
