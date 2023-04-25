const { Applet, AllowedLayout } = imports.ui.applet;
const { EventType } = imports.gi.Clutter;

export interface CreateAppletContainerProps {
  onClick: () => void;
  onScroll: (scrollDirection: imports.gi.Clutter.ScrollDirection) => void;
  onMiddleClick: () => void;
  onRightClick: () => void;
  onAppletMovedCallbacks: Array<() => void>;
  onRemoved: () => void;
}

export function createAppletContainer(props: CreateAppletContainerProps) {
  const { onClick, onScroll, onMiddleClick, onAppletMovedCallbacks, onRemoved, onRightClick } =
    props;

  const applet = new Applet(
    __meta.orientation,
    __meta.panel.height,
    __meta.instanceId
  );

  let appletReloaded = false;

  applet.on_applet_clicked = () => {
    onClick();
    return true;
  };

  applet.on_applet_middle_clicked = () => {
    onMiddleClick();
    return true;
  };

  applet.setAllowedLayout(AllowedLayout.BOTH);

  applet.on_applet_reloaded = function () {
    appletReloaded = true;
  };

  applet.on_applet_removed_from_panel = function () {
    appletReloaded ? onAppletMovedCallbacks.forEach((cb) => cb()) : onRemoved();
    appletReloaded = false;
  };

  applet.actor.connect("event", (actor, event) => {
    if (event.type() !== EventType.BUTTON_PRESS) return false;

    if (event.get_button() === 3) {
      onRightClick();
      return true;
    }
    return false;
  });

  applet.actor.connect("scroll-event", (actor, event) => {
    onScroll(event.get_scroll_direction());
    return false;
  });


  // this is a workaround to ensure that the Applet is still clickable after the applet has dropped 
  global.settings.connect("changed::panel-edit-mode", () => {
    const inhibitDragging = !global.settings.get_boolean("panel-edit-mode")

    // @ts-ignore
    applet['_draggable'].inhibit = inhibitDragging
  })

  return applet;
}
