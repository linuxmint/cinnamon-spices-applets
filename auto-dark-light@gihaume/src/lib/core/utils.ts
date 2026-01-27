/** @param duration - The duration to sleep for, in milliseconds (ms) */
export async function sleep(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
}
