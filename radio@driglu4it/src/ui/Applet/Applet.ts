const { Applet, AllowedLayout } = imports.ui.applet
const { Bin } = imports.gi.St
const { EventType } = imports.gi.Clutter

interface Arguments {
    icon: imports.gi.St.Icon,
    label: imports.gi.St.Label,
    orientation: imports.gi.St.Side,
    panelHeight: number,
    instanceId: number,
    onClick: () => void,
    onScroll: (scrollDirection: imports.gi.Clutter.ScrollDirection) => void,
    onMiddleClick: () => void,
    onRightClick: () => void,
    onAppletMoved: () => void,
    onAppletRemoved: () => void
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
        onAppletMoved,
        onAppletRemoved,
        onRightClick
    } = args

    const applet = new Applet(orientation, panelHeight, instanceId);

    let appletReloaded = false;

    [icon, label].forEach(widget => {
        applet.actor.add_child(widget)
    })

    applet.on_applet_clicked = onClick
    applet.on_applet_middle_clicked = onMiddleClick
    applet.setAllowedLayout(AllowedLayout.BOTH)

    applet.on_applet_reloaded = function () {
        appletReloaded = true
    }

    applet.on_applet_removed_from_panel = function () {
        appletReloaded ? onAppletMoved() : onAppletRemoved()
        appletReloaded = false
    }

    applet.actor.connect('event', (actor, event) => {
        if (event.type() !== EventType.BUTTON_PRESS) return

        if (event.get_button() === 3) {
            onRightClick()
        }

        return false

    })

    applet.actor.connect('scroll-event', (actor, event) => {
        onScroll(event.get_scroll_direction())

        return false
    })

    return applet
}