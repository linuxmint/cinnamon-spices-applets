const {
  gi: { GLib },
} = imports;

/**
 * Polyfill for GLib.timeout_add_once (not in Cinnamon 6.6.9's GLib version).
 * Calls `callback` once after `interval` milliseconds, then removes the source.
 */
export function timeout_add_once(
  interval: number,
  callback: () => void,
): number {
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
    callback();
    return GLib.SOURCE_REMOVE;
  });
}

/**
 * Polyfill for timeout_add_seconds_once (not in Cinnamon 6.6.9's GLib version).
 * Calls `callback` once after `interval` seconds, then removes the source.
 */
export function timeout_add_seconds_once(
  interval: number,
  callback: () => void,
): number {
  return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
    callback();
    return GLib.SOURCE_REMOVE;
  });
}
