import { UUID } from "consts"
import { FishApplet } from "FishApplet"
import type { Metadata } from "types"
import { logger } from "utils/logging"

const Gettext = imports.gettext
const { GLib } = imports.gi

// entry point
export function main(
  metadata: Metadata,
  orientation: imports.gi.St.Side,
  panelHeight: number,
  instanceId: number,
): FishApplet {
  // import translations
  Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

  logger.setInstanceId(instanceId)

  return new FishApplet(metadata, orientation, panelHeight, instanceId)
}
