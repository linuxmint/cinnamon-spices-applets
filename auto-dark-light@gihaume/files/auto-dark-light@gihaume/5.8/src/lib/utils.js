/**
 * @param {number} duration - In milliseconds (ms)
 * @returns {Promise<void>}
 */
export async function sleep(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
}
