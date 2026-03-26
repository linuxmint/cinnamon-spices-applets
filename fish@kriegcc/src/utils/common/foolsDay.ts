import { logger } from "utils/logging"

const { spawnCommandLineAsyncIO } = imports.misc.util

// April fools day check logic is originally from mate-panel and is adapted here.
// Source: https://github.com/mate-desktop/mate-panel/blob/master/applets/fish/fish.c
export async function isFoolsDay(): Promise<boolean> {
  const spanishTimezones = [
    "Europe/Madrid",
    "Africa/Ceuta",
    "Atlantic/Canary",
    "America/Mexico_City",
    "Mexico/BajaSur",
    "Mexico/BajaNorte",
    "Mexico/General",
  ]

  const now = new Date()
  const month = now.getMonth() // returns 0-11 for Jan-Dec
  const date = now.getDate()
  const hour = now.getHours()

  const location = await getLocation()

  let foolsDay = 1 // Default to April 1st
  let foolsMonth = 3 // April
  const foolsHourStart = 0
  const foolsHourEnd = 12 // Apparently jokes should stop at midday

  if (location && spanishTimezones.includes(location)) {
    // Hah!, We are in Spain or Mexico. Spanish fool's day is 28th December
    foolsDay = 28
    foolsMonth = 11 // December (0-indexed, so 11 means December)
  }

  if (month === foolsMonth && date === foolsDay && hour >= foolsHourStart && hour < foolsHourEnd) {
    return true
  }

  return false
}

// The approaches to get the timezone location are taken from mate-panel (fish.c, get_location).
async function getLocation(): Promise<string | null> {
  try {
    // Try the old method: reading /etc/timezone
    const timezone = await readFile("/etc/timezone")
    if (timezone) {
      return timezone.trim()
    }

    // Try the new method: reading the symlink /etc/localtime
    // TODO: Is broken for many distros? See original comment in mate-panel code.
    const localtimePath = await readSymlink("/etc/localtime")
    if (localtimePath) {
      // result looks should have a format like: "/usr/share/zoneinfo/Europe/Berlin"
      const parts = localtimePath.split("/")
      if (parts.length >= 3) {
        return parts.slice(-2).join("/")
      }
    }
    return null
  } catch (error) {
    logger.logError("Error getting location:", error)
    return null
  }
}

function readSymlink(filePath: string): Promise<string | null> {
  return new Promise((resolve, _) => {
    spawnCommandLineAsyncIO(`readlink ${filePath}`, (output) => {
      if (output) {
        resolve(output.trim())
      } else {
        resolve(null)
      }
    })
  })
}

function readFile(filePath: string): Promise<string | null> {
  return new Promise((resolve, _) => {
    spawnCommandLineAsyncIO(`cat ${filePath}`, (output) => {
      if (output) {
        resolve(output)
      } else {
        resolve(null)
      }
    })
  })
}
