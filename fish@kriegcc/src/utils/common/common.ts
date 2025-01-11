import { logger } from "utils/logging"

const { St } = imports.gi
const { GLib } = imports.gi

export function isHorizontalOriented(orientation: imports.gi.St.Side): boolean {
  return orientation === St.Side.TOP || orientation === St.Side.BOTTOM
}

export function isVerticalOriented(orientation: imports.gi.St.Side): boolean {
  return orientation === St.Side.LEFT || orientation === St.Side.RIGHT
}

/**
 * Expands the tilde (~) in a file path to the user's home directory.
 * If the path is already expanded, it returns the path unchanged.
 *
 * @param {string} path - The file path that may contain a tilde (~) representing the home directory.
 * @returns {string} - The file path with the tilde expanded to the full home directory path, or the original path if no tilde is present.
 */
export const expandHomeDir = (path: string): string => {
  if (path.startsWith("~")) {
    const homeDir = GLib.get_home_dir()
    return path.replace("~", homeDir)
  }
  return path
}

const MAX_PAUSE_IN_MS = 10000 // 10 seconds
const MIN_PAUSE_IN_MS = 100

export function isAnimationSpeedValid(speed: number): boolean {
  if (speed < 0) {
    logger.logError(`Animation speed value must not be negative. Speed: ${speed}`)
    return false
  }

  if (speed < MIN_PAUSE_IN_MS) {
    logger.logError(`Animation speed value must not be lower than ${MIN_PAUSE_IN_MS}. Speed: ${speed}`)
    return false
  }

  if (speed > MAX_PAUSE_IN_MS) {
    logger.logError(`Animation speed value must not be higher than ${MAX_PAUSE_IN_MS}. Speed: ${speed}`)
    return false
  }

  return true
}
