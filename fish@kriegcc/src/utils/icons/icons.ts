const { St } = imports.gi

export const ErrorIcon = (iconsSize = 24) =>
  new St.Icon({
    icon_name: "error",
    icon_type: St.IconType.SYMBOLIC,
    icon_size: iconsSize,
  })

export const InfoIcon = (iconsSize = 24) =>
  new St.Icon({
    icon_name: "info",
    icon_type: St.IconType.SYMBOLIC,
    icon_size: iconsSize,
  })
