const { Icon, IconType } = imports.gi.St;
// @ts-ignore
const { Point } = imports.gi.Clutter;

export function createAppletIcon(
  props?: ConstructorParameters<typeof Icon>[0]
) {
  const icon_type = props?.icon_type || IconType.SYMBOLIC;
  const panel = __meta.panel;

  function getIconSize() {
    return panel.getPanelZoneIconSize(__meta.locationLabel, icon_type);
  }

  function getStyleClass() {
    return icon_type === IconType.SYMBOLIC
      ? "system-status-icon"
      : "applet-icon";
  }

  const icon = new Icon({
    icon_type,
    style_class: getStyleClass(),
    icon_size: getIconSize(),
    pivot_point: new Point({ x: 0.5, y: 0.5 }),
    ...props,
  });

  panel.connect("icon-size-changed", () => {
    icon.set_icon_size(getIconSize());
  });

  icon.connect("notify::icon-type", () => {
    icon.style_class = getStyleClass();
  });

  return icon;
}
