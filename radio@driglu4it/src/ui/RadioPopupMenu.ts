const { PopupMenuManager, PopupSeparatorMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
const { AppletPopupMenu } = imports.ui.applet

interface Arguments {
    radioApplet: any, // TODO: specify type
    orientation: imports.gi.St.Side,
    channelList: imports.ui.popupMenu.PopupSubMenuMenuItem,
    volumeSlider: imports.ui.popupMenu.PopupBaseMenuItem,
    songInfoItem: imports.ui.popupMenu.PopupBaseMenuItem,
    channelInfoItem: imports.ui.popupMenu.PopupBaseMenuItem,
    mediaControlToolbar: imports.ui.popupMenu.PopupMenuSection
}

export interface RadioPopupMenu extends imports.ui.applet.AppletPopupMenu {
    running: boolean
}

export function createRadioPopupMenu(args: Arguments) {

    const {
        radioApplet,
        orientation,
        channelList,
        volumeSlider,
        songInfoItem,
        channelInfoItem,
        mediaControlToolbar
    } = args


    const menuManager = new PopupMenuManager(radioApplet)
    const popupMenu = new AppletPopupMenu(radioApplet, orientation)
    menuManager.addMenu(popupMenu)

    const itemsOnlyWhenRunning = [
        new PopupSeparatorMenuItem(),
        channelInfoItem,
        songInfoItem,
        new PopupSeparatorMenuItem(),
        mediaControlToolbar,
        new PopupSeparatorMenuItem(),
        volumeSlider,
    ]

    setRunning(false)

    function setRunning(running: boolean) {
        popupMenu.box.remove_all_children()
        popupMenu.addMenuItem(channelList)

        if (!running) return

        itemsOnlyWhenRunning.forEach(item => {
            popupMenu.addMenuItem(item)
        })

    }


    Object.defineProperties(popupMenu, {
        running: {
            set(running: boolean) {
                setRunning(running)
            }
        }
    })

    return popupMenu as RadioPopupMenu


}