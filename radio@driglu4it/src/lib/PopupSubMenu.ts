import { createActivWidget } from "./ActivWidget";

const { BoxLayout, Label, Icon, ScrollView } = imports.gi.St;
// @ts-ignore
const { ActorAlign, Point } = imports.gi.Clutter;
const { PolicyType } = imports.gi.Gtk;

interface Arguments {
  text: string;
}

export function createSubMenu(args: Arguments) {
  const { text } = args;

  const container = new BoxLayout({
    vertical: true,
  });

  const label = new Label({
    text,
  });

  const triangle = new Icon({
    style_class: "popup-menu-arrow",
    icon_name: "pan-end",
    rotation_angle_z: 90,
    x_expand: true,
    x_align: ActorAlign.END,
    pivot_point: new Point({ x: 0.5, y: 0.5 }),
    important: true, // without this, it looks ugly on Mint-X Themes
  });

  const toggle = new BoxLayout({
    style_class: "popup-menu-item popup-submenu-menu-item",
  });

  createActivWidget({
    widget: toggle,
    onActivated: toggleScrollbox,
  });

  [label, triangle].forEach((widget) => toggle.add_child(widget));
  container.add_child(toggle);

  const scrollbox = new ScrollView({
    style_class: "popup-sub-menu",
    vscrollbar_policy: PolicyType.AUTOMATIC,
    hscrollbar_policy: PolicyType.NEVER,
  });

  const box = new BoxLayout({
    vertical: true,
  });

  function toggleScrollbox() {
    scrollbox.visible ? closeMenu() : openMenu();
  }

  function openMenu() {
    scrollbox.show();
    triangle.rotation_angle_z = 90;
  }

  function closeMenu() {
    scrollbox.hide();
    triangle.rotation_angle_z = 0;
  }

  // add_child is recommended but doesn't work: https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/3172
  scrollbox.add_actor(box);

  [toggle, scrollbox].forEach((widget) => container.add_child(widget));

  return {
    /** the container which should be used to add it as child to a parent Actor */
    actor: container,
    /** the container which should be used to add children  */
    box,
  };
}
