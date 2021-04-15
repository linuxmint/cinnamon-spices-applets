"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRadioPopupMenu = void 0;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
const { AppletPopupMenu } = imports.ui.applet;
function createRadioPopupMenu(args) {
    const { radioApplet, orientation, channelList, volumeSlider, songInfoItem, channelInfoItem, mediaControlToolbar } = args;
    const menuManager = new PopupMenuManager(radioApplet);
    const popupMenu = new AppletPopupMenu(radioApplet, orientation);
    menuManager.addMenu(popupMenu);
    const itemsOnlyWhenRunning = [
        new PopupSeparatorMenuItem(),
        channelInfoItem,
        songInfoItem,
        new PopupSeparatorMenuItem(),
        mediaControlToolbar,
        new PopupSeparatorMenuItem(),
        volumeSlider,
    ];
    setRunning(false);
    function setRunning(running) {
        popupMenu.box.remove_all_children();
        popupMenu.addMenuItem(channelList);
        if (!running)
            return;
        itemsOnlyWhenRunning.forEach(item => {
            popupMenu.addMenuItem(item);
        });
    }
    Object.defineProperties(popupMenu, {
        running: {
            set(running) {
                setRunning(running);
            }
        }
    });
    return popupMenu;
}
exports.createRadioPopupMenu = createRadioPopupMenu;
