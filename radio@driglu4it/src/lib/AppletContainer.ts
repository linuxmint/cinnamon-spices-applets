const { Applet, AllowedLayout } = imports.ui.applet
const { EventType } = imports.gi.Clutter
const { panelManager } = imports.ui.main
const { getAppletDefinition } = imports.ui.appletManager;

interface Arguments {
    onClick: () => void,
    onScroll: (scrollDirection: imports.gi.Clutter.ScrollDirection) => void,
    onMiddleClick: () => void,
    onRightClick: () => void,
    onMoved: () => void,
    onRemoved: () => void
}

export function createAppletContainer(args: Arguments) {

    const {
        onClick,
        onScroll,
        onMiddleClick,
        onMoved,
        onRemoved,
        onRightClick
    } = args

    const appletDefinition = getAppletDefinition({
        applet_id: __meta.instanceId,
    })

    const panel = panelManager.panels.find(panel =>
        panel?.panelId === appletDefinition.panelId
    ) as imports.ui.panel.Panel

    const applet = new Applet(__meta.orientation, panel.height, __meta.instanceId);

    let appletReloaded = false;

    applet.on_applet_clicked = onClick
    applet.on_applet_middle_clicked = onMiddleClick
    applet.setAllowedLayout(AllowedLayout.BOTH)

    applet.on_applet_reloaded = function () {
        appletReloaded = true
    }

    applet.on_applet_removed_from_panel = function () {
        appletReloaded ? onMoved() : onRemoved()
        appletReloaded = false
    }

    applet.actor.connect('event', (actor, event) => {
        if (event.type() !== EventType.BUTTON_PRESS) return false

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