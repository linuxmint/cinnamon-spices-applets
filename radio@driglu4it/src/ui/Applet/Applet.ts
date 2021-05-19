const { Applet, AllowedLayout } = imports.ui.applet
const { Bin } = imports.gi.St

interface Arguments {
    icon: imports.gi.St.Icon,
    label: imports.gi.St.Label,
    orientation: imports.gi.St.Side,
    panelHeight: number,
    instanceId: number,
    onClick: () => void,
    onScroll: (scrollDirection: imports.gi.Clutter.ScrollDirection) => void,
    onMiddleClick: () => void,
    onAppletRemovedFromPanel: () => void
}

export function createApplet(args: Arguments) {

    const {
        orientation,
        panelHeight,
        instanceId,
        icon,
        label,
        onClick,
        onScroll,
        onMiddleClick,
        onAppletRemovedFromPanel
    } = args

    const applet = new Applet(orientation, panelHeight, instanceId);

    [icon, label].forEach(widget => {
        applet.actor.add(new Bin({ child: widget }))
    })

    applet.on_applet_clicked = onClick
    applet.on_applet_middle_clicked = onMiddleClick
    applet.on_applet_removed_from_panel = onAppletRemovedFromPanel
    applet.setAllowedLayout(AllowedLayout.BOTH)

    applet.actor.connect('scroll-event', (actor, event) => {
        onScroll(event.get_scroll_direction())
    })

    return applet
}