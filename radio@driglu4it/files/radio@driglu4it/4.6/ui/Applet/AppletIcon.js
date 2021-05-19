"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppletIcon = void 0;
const consts_1 = require("consts");
const { Icon, IconType } = imports.gi.St;
const { IconType: IconTypeEnum } = imports.gi.St;
function createAppletIcon(args) {
    const { panel, locationLabel } = args;
    let playbackStatus;
    const playbackStatusStyleMap = new Map([
        ['Stopped', ' '],
        ['Loading', ' ']
    ]);
    const icon = new Icon({});
    let normalIconType;
    function setIconTypeInternal(iconTypeEnum, iconName) {
        icon.style_class = iconTypeEnum === IconTypeEnum.SYMBOLIC ?
            'system-status-icon' : 'applet-icon';
        icon.icon_name = iconName;
        icon.icon_type = iconTypeEnum;
        icon.icon_size = panel.getPanelZoneIconSize(locationLabel, iconTypeEnum);
    }
    function setIconType(iconType) {
        if (!iconType)
            return;
        let iconTypeEnum;
        let iconName;
        normalIconType = iconType;
        if (iconType === 'SYMBOLIC') {
            iconName = consts_1.RADIO_SYMBOLIC_ICON_NAME;
            iconTypeEnum = IconTypeEnum.SYMBOLIC;
        }
        else {
            iconName = `radioapplet-${iconType.toLowerCase()}`;
            iconTypeEnum = IconTypeEnum.FULLCOLOR;
        }
        setIconTypeInternal(iconTypeEnum, iconName);
    }
    function updateIconSize() {
        const iconSize = panel.getPanelZoneIconSize(locationLabel, icon.icon_type);
        icon.icon_size = iconSize;
    }
    function setColorWhenPaused(color) {
        playbackStatusStyleMap.set('Paused', `color: ${color}`);
        if (playbackStatus)
            setPlaybackStatus(playbackStatus);
    }
    function setColorWhenPlaying(color) {
        playbackStatusStyleMap.set('Playing', `color: ${color}`);
        if (playbackStatus)
            setPlaybackStatus(playbackStatus);
    }
    function setPlaybackStatus(newPlaybackStatus) {
        playbackStatus = newPlaybackStatus;
        const style = playbackStatusStyleMap.get(playbackStatus);
        if (newPlaybackStatus === 'Loading') {
            setIconTypeInternal(IconTypeEnum.SYMBOLIC, consts_1.LOADING_ICON_NAME);
        }
        else {
            setIconType(normalIconType);
        }
        if (!style)
            return;
        icon.set_style(style);
    }
    return {
        actor: icon,
        setPlaybackStatus,
        setColorWhenPlaying,
        setColorWhenPaused,
        setIconType,
        updateIconSize
    };
}
exports.createAppletIcon = createAppletIcon;
