"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPopupMenu = void 0;
const { BoxLayout, Bin, Side } = imports.gi.St;
const { uiGroup, layoutManager, panelManager, pushModal, popModal } = imports.ui.main;
const { KEY_Escape } = imports.gi.Clutter;
const { util_get_transformed_allocation } = imports.gi.Cinnamon;
const { PanelLoc } = imports.ui.popupMenu;
function createPopupMenu(args) {
    const { launcher } = args;
    const box = new BoxLayout({
        style_class: 'popup-menu-content',
        vertical: true,
        visible: false,
    });
    const bin = new Bin({
        style_class: 'menu',
        child: box,
        visible: false
    });
    uiGroup.add_child(bin);
    box.connect('key-press-event', (actor, event) => {
        event.get_key_symbol() === KEY_Escape && close();
    });
    launcher.connect('queue-relayout', () => {
        if (!box.visible)
            return;
        setTimeout(() => {
            setLayout();
        }, 0);
    });
    bin.connect('queue-relayout', () => {
        setTimeout(() => {
            setLayout();
        }, 0);
    });
    function setLayout() {
        const freeSpace = calculateFreeSpace();
        const maxHeight = calculateMaxHeight(freeSpace);
        box.style = `max-height: ${maxHeight}px;`;
        const [xPos, yPos] = calculatePosition(maxHeight, freeSpace);
        bin.set_position(Math.floor(xPos), Math.floor(yPos));
    }
    function calculateFreeSpace() {
        var _a, _b, _c, _d;
        const monitor = layoutManager.findMonitorForActor(launcher);
        const visiblePanels = panelManager.getPanelsInMonitor(monitor.index);
        const panelSizes = new Map(visiblePanels.map(panel => {
            let width = 0, height = 0;
            if (panel.getIsVisible()) {
                width = panel.actor.width;
                height = panel.actor.height;
            }
            return [panel.panelPosition, { width, height }];
        }));
        return {
            left: monitor.x + (((_a = panelSizes.get(PanelLoc.left)) === null || _a === void 0 ? void 0 : _a.width) || 0),
            bottom: monitor.y + monitor.height - (((_b = panelSizes.get(PanelLoc.bottom)) === null || _b === void 0 ? void 0 : _b.height) || 0),
            top: monitor.y + (((_c = panelSizes.get(PanelLoc.top)) === null || _c === void 0 ? void 0 : _c.height) || 0),
            right: monitor.x + monitor.width - (((_d = panelSizes.get(PanelLoc.right)) === null || _d === void 0 ? void 0 : _d.width) || 0)
        };
    }
    function calculateMaxHeight(freeSpace) {
        const freeSpaceHeight = (freeSpace.bottom - freeSpace.top) / global.ui_scale;
        const boxThemeNode = box.get_theme_node();
        const binThemeNode = bin.get_theme_node();
        const paddingTop = boxThemeNode.get_padding(Side.TOP);
        const paddingBottom = boxThemeNode.get_padding(Side.BOTTOM);
        const borderWidthTop = binThemeNode.get_border_width(Side.TOP);
        const borderWidthBottom = binThemeNode.get_border_width(Side.BOTTOM);
        const maxHeight = freeSpaceHeight - paddingBottom - paddingTop - borderWidthTop - borderWidthBottom;
        return maxHeight;
    }
    function calculatePosition(maxHeight, freeSpace) {
        const appletBox = util_get_transformed_allocation(launcher);
        const [minWidth, minHeight, natWidth, natHeight] = box.get_preferred_size();
        const margin = (natWidth - appletBox.get_width()) / 2;
        const xLeftNormal = Math.max(freeSpace.left, appletBox.x1 - margin);
        const xRightNormal = appletBox.x2 + margin;
        const xLeftMax = freeSpace.right - appletBox.get_width() - margin * 2;
        const xLeft = (xRightNormal < freeSpace.right) ? xLeftNormal : xLeftMax;
        const yTopNormal = Math.max(appletBox.y1, freeSpace.top);
        const yBottomNormal = yTopNormal + natHeight;
        const yTopMax = freeSpace.bottom - box.height;
        const yTop = (yBottomNormal < freeSpace.bottom) ? yTopNormal : yTopMax;
        return [xLeft, yTop];
    }
    function toggle() {
        box.visible ? close() : open();
    }
    function open() {
        setLayout();
        bin.show();
        box.show();
        launcher.add_style_pseudo_class('checked');
        pushModal(box);
        global.stage.connect('button-press-event', handleClick);
        global.stage.connect('button-release-event', handleClick);
    }
    function close() {
        if (!box.visible)
            return;
        bin.hide();
        box.hide();
        launcher.remove_style_pseudo_class('checked');
        popModal(box);
    }
    function handleClick(actor, event) {
        if (!box.visible) {
            return;
        }
        const clickedActor = event.get_source();
        const binClicked = box.contains(clickedActor);
        const appletClicked = launcher.contains(clickedActor);
        (!binClicked && !appletClicked) && close();
    }
    box.toggle = toggle;
    box.close = close;
    return box;
}
exports.createPopupMenu = createPopupMenu;
