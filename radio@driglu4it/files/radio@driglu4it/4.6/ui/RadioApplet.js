"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRadioApplet = void 0;
const { TextIconApplet, AllowedLayout } = imports.ui.applet;
function createRadioApplet(args) {
    const { iconType, colorWhenPlaying, channelOnPanel, orientation, panelHeight, instanceId, onAppletClick, onAppletMiddleClick, onScroll, onAppletRemovedFromPanel } = args;
    const textIconApplet = new TextIconApplet(orientation, panelHeight, instanceId);
    textIconApplet.setAllowedLayout(AllowedLayout.BOTH);
    textIconApplet.on_applet_clicked = onAppletClick;
    textIconApplet.on_applet_middle_clicked = onAppletMiddleClick;
    textIconApplet.on_applet_removed_from_panel = onAppletRemovedFromPanel;
    textIconApplet.actor.connect('scroll-event', (actor, event) => {
        const direction = event.get_scroll_direction();
        onScroll(direction);
    });
    let state = {
        iconType,
        playbackStatus: "Stopped",
        colorWhenPlaying,
        channelOnPanel
    };
    function updateState(changes) {
        const newState = Object.assign(Object.assign({}, state), changes);
        const valid = validateNewState(newState);
        if (!valid)
            return;
        state = newState;
        setUpdateGui();
    }
    function validateNewState(newState) {
        let valid = true;
        const { playbackStatus, channelName, volume } = newState;
        if (playbackStatus !== 'Stopped' && (!channelName || volume == null)) {
            global.logError(`RadioApplet.ts: Station and volume must be defined when 
                playbackstatus is !== Stopped`);
            valid = false;
            return valid;
        }
        return valid;
    }
    function setUpdateGui() {
        setIcon();
        setIconColor();
        setAppletLabel();
        setAppletTooltip();
    }
    function setIcon() {
        const { iconType } = state;
        if (iconType === "SYMBOLIC") {
            textIconApplet.set_applet_icon_symbolic_name('radioapplet');
            return;
        }
        textIconApplet.set_applet_icon_name(`radioapplet-${iconType.toLowerCase()}`);
    }
    function setIconColor() {
        const { playbackStatus, colorWhenPlaying, iconType } = state;
        if (iconType !== 'SYMBOLIC')
            return;
        textIconApplet.actor.style =
            `color: ${playbackStatus === 'Playing' ? colorWhenPlaying : true}`;
    }
    function setAppletLabel() {
        const { playbackStatus, channelName, channelOnPanel } = state;
        const label = (channelOnPanel && playbackStatus === "Playing")
            ? ' ' + channelName : '';
        textIconApplet.set_applet_label(label);
    }
    function setAppletTooltip() {
        const { playbackStatus, volume } = state;
        const tooltipTxt = playbackStatus === "Stopped"
            ? "Radio++" : `Volume: ${volume.toString()} %`;
        textIconApplet.set_applet_tooltip(tooltipTxt);
    }
    const radioApplet = Object.create(textIconApplet);
    radioApplet.updateState = updateState;
    setUpdateGui();
    return radioApplet;
}
exports.createRadioApplet = createRadioApplet;
