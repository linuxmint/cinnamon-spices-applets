const { BoxLayout, Bin, Side } = imports.gi.St
const { uiGroup, layoutManager, panelManager, pushModal, popModal } = imports.ui.main
const { KEY_Escape } = imports.gi.Clutter
const { util_get_transformed_allocation } = imports.gi.Cinnamon
const { PanelLoc } = imports.ui.popupMenu

interface Arguments {
    launcher: imports.gi.St.Widget,
}

// the space on the monitor which is free for the popup menu, i.e. the monitor minus the panels.
interface FreeSpaceBox {
    left: number,
    top: number,
    bottom: number,
    right: number
}

interface PopupMenu extends imports.gi.St.BoxLayout {
    /** toggles the visibility of the popupMenu */
    toggle: () => void
    /** close the popupmenu and relase the grabbed keys. Use this instead of hide! */
    close: () => void
}


export function createPopupMenu(args: Arguments) {

    const {
        launcher
    } = args

    const box = new BoxLayout({
        style_class: 'popup-menu-content',
        vertical: true,
        visible: false,
    })

    // only for styling purposes
    const bin = new Bin({
        style_class: 'menu',
        child: box,
        visible: false
    })

    uiGroup.add_child(bin)

    box.connect('key-press-event', (actor, event) => {
        event.get_key_symbol() === KEY_Escape && close()
    })

    launcher.connect('queue-relayout', () => {
        if (!box.visible) return


        setTimeout(() => {
            setLayout()
        }, 0);
    })

    bin.connect('queue-relayout', () => {
        if (!box.visible) return


        setTimeout(() => {
            setLayout()
        }, 0);
    })

    function setLayout() {

        const freeSpace = calculateFreeSpace()
        const maxHeight = calculateMaxHeight(freeSpace)

        box.style = `max-height: ${maxHeight}px;`
        const [xPos, yPos] = calculatePosition(maxHeight, freeSpace)

        // Without Math.floor, the popup menu gets for some reason blurred on some themes (e.g. Adapta Nokto)!
        bin.set_position(Math.floor(xPos), Math.floor(yPos))

    }


    function calculateFreeSpace(): FreeSpaceBox {
        const monitor = layoutManager.findMonitorForActor(launcher)
        const visiblePanels = panelManager.getPanelsInMonitor(monitor.index)

        const panelSizes = new Map(visiblePanels.map(panel => {
            let width = 0, height = 0;

            if (panel.getIsVisible()) {
                width = panel.actor.width;
                height = panel.actor.height;
            }

            return [panel.panelPosition, { width, height }]
        }))

        return {
            left: monitor.x + (panelSizes.get(PanelLoc.left)?.width || 0),
            bottom: monitor.y + monitor.height - (panelSizes.get(PanelLoc.bottom)?.height || 0),
            top: monitor.y + (panelSizes.get(PanelLoc.top)?.height || 0),
            right: monitor.x + monitor.width - (panelSizes.get(PanelLoc.right)?.width || 0)
        }
    }

    function calculateMaxHeight(freeSpace: FreeSpaceBox): number {
        const freeSpaceHeight = (freeSpace.bottom - freeSpace.top) / global.ui_scale

        const boxThemeNode = box.get_theme_node()

        const binThemeNode = bin.get_theme_node()

        const paddingTop = boxThemeNode.get_padding(Side.TOP)
        const paddingBottom = boxThemeNode.get_padding(Side.BOTTOM)
        const borderWidthTop = binThemeNode.get_border_width(Side.TOP)
        const borderWidthBottom = binThemeNode.get_border_width(Side.BOTTOM)

        const maxHeight = freeSpaceHeight - paddingBottom - paddingTop - borderWidthTop - borderWidthBottom

        return maxHeight
    }

    function calculatePosition(maxHeight: number, freeSpace: FreeSpaceBox): [xLeft: number, yTop: number] {

        const appletBox = util_get_transformed_allocation(launcher)

        const [minWidth, minHeight, natWidth, natHeight] = box.get_preferred_size();

        const margin = (natWidth - appletBox.get_width()) / 2

        const xLeftNormal = Math.max(freeSpace.left, appletBox.x1 - margin);
        const xRightNormal = appletBox.x2 + margin
        const xLeftMax = freeSpace.right - appletBox.get_width() - margin * 2
        const xLeft = (xRightNormal < freeSpace.right) ? xLeftNormal : xLeftMax

        const yTopNormal = Math.max(appletBox.y1, freeSpace.top);
        const yBottomNormal = yTopNormal + natHeight;
        const yTopMax = freeSpace.bottom - box.height;
        const yTop = (yBottomNormal < freeSpace.bottom) ? yTopNormal : yTopMax

        return [xLeft, yTop];
    }

    function toggle() {
        box.visible ? close() : open()
    }

    // no idea why it sometimes needs to be bin and sometimes box ...
    function open() {

        setLayout()
        bin.show()
        box.show()

        launcher.add_style_pseudo_class('checked')

        pushModal(box)

        // For some reason, it is emmited the button-press event when clicking e.g on the desktop but the button-release-event when clicking on another applet
        global.stage.connect('button-press-event', handleClick)
        global.stage.connect('button-release-event', handleClick)
    }

    function close() {

        if (!box.visible) return

        bin.hide()
        box.hide()
        launcher.remove_style_pseudo_class('checked')
        popModal(box)
    }

    function handleClick(actor: imports.gi.Clutter.Stage, event: imports.gi.Clutter.Event) {

        if (!box.visible) {
            return
        }

        const clickedActor = event.get_source()

        const binClicked = box.contains(clickedActor)
        const appletClicked = launcher.contains(clickedActor);

        (!binClicked && !appletClicked) && close()
    }

    (box as PopupMenu).toggle = toggle;
    (box as PopupMenu).close = close

    return (box as PopupMenu)
}