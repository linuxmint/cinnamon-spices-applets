import { createActivWidget } from "./ActivWidget";
import { limitString } from "../functions/limitString";

const { Icon, IconType, Label, BoxLayout } = imports.gi.St;
// @ts-ignore
const { Point } = imports.gi.Clutter;

export type SimpleMenuItem = ReturnType<typeof createSimpleMenuItem>;

export interface SimpleMenuItemArguments {
  text?: string | undefined;
  iconName?: string;
  onActivated?: (self: SimpleMenuItem) => void;
  maxCharNumber?: number;
  onRightClick?: (self: SimpleMenuItem) => void
}

export function createSimpleMenuItem(args: SimpleMenuItemArguments) {
  const { text: initialText = "", maxCharNumber, iconName, onActivated, onRightClick } = args;

  const icon = new Icon({
    icon_type: IconType.SYMBOLIC,
    style_class: "popup-menu-icon",
    pivot_point: new Point({ x: 0.5, y: 0.5 }),
    icon_name: iconName || "",
    visible: !!iconName,
  });

  const label = new Label({
    text: maxCharNumber ? limitString(initialText, maxCharNumber) : initialText,
  });

  const container = new BoxLayout({
    style_class: "popup-menu-item",
  });

  container.add_child(icon);
  container.add_child(label);
  initialText && setText(initialText);

  function setIconName(name: string | null | undefined) {
    if (!name) {
      icon.visible = false;
      return;
    }

    icon.icon_name = name;
    icon.visible = true;
  }

  function setText(text: string) {
    const visibleText = maxCharNumber ? limitString(text, maxCharNumber) : text;
    label.set_text(visibleText);
  }

  const menuItem = {
    actor: container,
    setIconName,
    setText,
    getIcon: () => icon,
  };


  container.connect('button-press-event', (_, event) => {
    const button = event.get_button()

    if (button === 3) {
      onRightClick?.(menuItem)
    }

    return false
  })

  onActivated &&
    createActivWidget({
      widget: container,
      onActivated: () => onActivated(menuItem),
    });

  return menuItem;
}
