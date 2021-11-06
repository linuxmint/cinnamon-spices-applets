var radioApplet;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 447:
/***/ ((__unused_webpack_module, exports) => {

var __webpack_unused_export__;

__webpack_unused_export__ = true;
var _a = imports.gi.St, BoxLayout = _a.BoxLayout, Bin = _a.Bin, Side = _a.Side;
var _b = imports.ui.main, uiGroup = _b.uiGroup, layoutManager = _b.layoutManager, panelManager = _b.panelManager, pushModal = _b.pushModal, popModal = _b.popModal;
var KEY_Escape = imports.gi.Clutter.KEY_Escape;
var util_get_transformed_allocation = imports.gi.Cinnamon.util_get_transformed_allocation;
var PanelLoc = imports.ui.popupMenu.PanelLoc;
function createPopupMenu(args) {
    var launcher = args.launcher;
    var box = new BoxLayout({
        style_class: 'popup-menu-content',
        vertical: true,
        visible: false
    });
    // only for styling purposes
    var bin = new Bin({
        style_class: 'menu',
        child: box,
        visible: false
    });
    uiGroup.add_child(bin);
    box.connect('key-press-event', function (actor, event) {
        event.get_key_symbol() === KEY_Escape && close();
    });
    launcher.connect('queue-relayout', function () {
        if (!box.visible)
            return;
        setTimeout(function () {
            setLayout();
        }, 0);
    });
    bin.connect('queue-relayout', function () {
        if (!box.visible)
            return;
        setTimeout(function () {
            setLayout();
        }, 0);
    });
    function setLayout() {
        var freeSpace = calculateFreeSpace();
        var maxHeight = calculateMaxHeight(freeSpace);
        box.style = "max-height: " + maxHeight + "px;";
        var _a = calculatePosition(maxHeight, freeSpace), xPos = _a[0], yPos = _a[1];
        // Without Math.floor, the popup menu gets for some reason blurred on some themes (e.g. Adapta Nokto)!
        bin.set_position(Math.floor(xPos), Math.floor(yPos));
    }
    function calculateFreeSpace() {
        var _a, _b, _c, _d;
        var monitor = layoutManager.findMonitorForActor(launcher);
        var visiblePanels = panelManager.getPanelsInMonitor(monitor.index);
        var panelSizes = new Map(visiblePanels.map(function (panel) {
            var width = 0, height = 0;
            if (panel.getIsVisible()) {
                width = panel.actor.width;
                height = panel.actor.height;
            }
            return [panel.panelPosition, { width: width, height: height }];
        }));
        return {
            left: monitor.x + (((_a = panelSizes.get(PanelLoc.left)) === null || _a === void 0 ? void 0 : _a.width) || 0),
            bottom: monitor.y + monitor.height - (((_b = panelSizes.get(PanelLoc.bottom)) === null || _b === void 0 ? void 0 : _b.height) || 0),
            top: monitor.y + (((_c = panelSizes.get(PanelLoc.top)) === null || _c === void 0 ? void 0 : _c.height) || 0),
            right: monitor.x + monitor.width - (((_d = panelSizes.get(PanelLoc.right)) === null || _d === void 0 ? void 0 : _d.width) || 0)
        };
    }
    function calculateMaxHeight(freeSpace) {
        var freeSpaceHeight = (freeSpace.bottom - freeSpace.top) / global.ui_scale;
        var boxThemeNode = box.get_theme_node();
        var binThemeNode = bin.get_theme_node();
        var paddingTopBox = boxThemeNode.get_padding(Side.TOP);
        var paddingBottomBox = boxThemeNode.get_padding(Side.BOTTOM);
        var borderWidthTopBin = binThemeNode.get_border_width(Side.TOP);
        var borderWidthBottomBIN = binThemeNode.get_border_width(Side.BOTTOM);
        var paddingTopBin = binThemeNode.get_padding(Side.TOP);
        var paddingBottomBin = binThemeNode.get_padding(Side.BOTTOM);
        var maxHeight = freeSpaceHeight - paddingBottomBox - paddingTopBox - borderWidthTopBin - borderWidthBottomBIN - paddingTopBin - paddingBottomBin;
        return maxHeight;
    }
    function calculatePosition(maxHeight, freeSpace) {
        var appletBox = util_get_transformed_allocation(launcher);
        var _a = box.get_preferred_size(), minWidth = _a[0], minHeight = _a[1], natWidth = _a[2], natHeight = _a[3];
        var margin = (natWidth - appletBox.get_width()) / 2;
        var xLeftNormal = Math.max(freeSpace.left, appletBox.x1 - margin);
        var xRightNormal = appletBox.x2 + margin;
        var xLeftMax = freeSpace.right - appletBox.get_width() - margin * 2;
        var xLeft = (xRightNormal < freeSpace.right) ? xLeftNormal : xLeftMax;
        var yTopNormal = Math.max(appletBox.y1, freeSpace.top);
        var yBottomNormal = yTopNormal + natHeight;
        var yTopMax = freeSpace.bottom - box.height;
        var yTop = (yBottomNormal < freeSpace.bottom) ? yTopNormal : yTopMax;
        return [xLeft, yTop];
    }
    function toggle() {
        box.visible ? close() : open();
    }
    // no idea why it sometimes needs to be bin and sometimes box ...
    function open() {
        setLayout();
        bin.show();
        box.show();
        launcher.add_style_pseudo_class('checked');
        pushModal(box);
        // For some reason, it is emmited the button-press event when clicking e.g on the desktop but the button-release-event when clicking on another applet
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
        var clickedActor = event.get_source();
        var binClicked = box.contains(clickedActor);
        var appletClicked = launcher.contains(clickedActor);
        (!binClicked && !appletClicked) && close();
    }
    box.toggle = toggle;
    // TODO: remove close
    box.close = close;
    return box;
}
exports.S = createPopupMenu;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "main": () => (/* binding */ main)
});

;// CONCATENATED MODULE: ./src/Config.ts
const { AppletSettings } = imports.ui.settings;
const createConfig = (args) => {
    const { uuid, instanceId, onIconChanged, onIconColorPlayingChanged, onIconColorPausedChanged, onChannelOnPanelChanged, onMyStationsChanged, } = args;
    // all settings are saved to this object
    const settingsObject = {
        get initialVolume() { return getInitialVolume(); }
    };
    const appletSettings = new AppletSettings(settingsObject, uuid, instanceId);
    appletSettings.bind('icon-type', 'iconType', (iconType) => onIconChanged(iconType));
    appletSettings.bind('color-on', 'symbolicIconColorWhenPlaying', (newColor) => onIconColorPlayingChanged(newColor));
    appletSettings.bind('color-paused', 'symbolicIconColorWhenPaused', (newColor) => onIconColorPausedChanged(newColor));
    appletSettings.bind('channel-on-panel', 'channelNameOnPanel', (channelOnPanel) => onChannelOnPanelChanged(channelOnPanel));
    appletSettings.bind('keep-volume-between-sessions', "keepVolume");
    appletSettings.bind('initial-volume', 'customInitVolume');
    appletSettings.bind('last-volume', 'lastVolume');
    appletSettings.bind('tree', "userStations", onMyStationsChanged);
    appletSettings.bind('last-url', 'lastUrl');
    appletSettings.bind('music-download-dir-select', 'musicDownloadDir', () => handleMusicDirChanged());
    function getInitialVolume() {
        const { keepVolume, lastVolume, customInitVolume } = settingsObject;
        let initialVolume = keepVolume ? lastVolume : customInitVolume;
        return initialVolume;
    }
    function handleMusicDirChanged() {
        // By Default the value is set to ~/Music/Radio but when changing to another location and back again to the default value in the settings dialog, the music dir is set to null instead of the default value again. As workaround the music dir is set programmatically to default value again if value is set to null (and the settings dialog can't be opened anymore). 
        if (settingsObject.musicDownloadDir === null) {
            settingsObject.musicDownloadDir = "~/Music/Radio";
        }
    }
    onIconChanged(settingsObject.iconType);
    onIconColorPlayingChanged(settingsObject.symbolicIconColorWhenPlaying);
    onIconColorPausedChanged(settingsObject.symbolicIconColorWhenPaused);
    onChannelOnPanelChanged(settingsObject.channelNameOnPanel);
    // TODO also onMyStationChanged should be called (and removed as arg from  ChannelStore)
    return settingsObject;
};

;// CONCATENATED MODULE: ./src/ChannelStore.ts
class ChannelStore {
    constructor(channelList) {
        this.channelList = channelList;
    }
    set channelList(channelList) {
        this._channelList = channelList.flatMap(channel => {
            return channel.inc ? Object.assign(Object.assign({}, channel), { url: channel.url.trim() }) : [];
        });
    }
    get activatedChannelUrls() {
        return this._channelList.map(channel => channel.url);
    }
    get activatedChannelNames() {
        return this._channelList.map(channel => channel.name);
    }
    // TODO: what is when two Channels have the same Name or Url? :O
    getChannelName(channelUrl) {
        const channel = this._channelList.find(cnl => cnl.url === channelUrl);
        return channel ? channel.name : null;
    }
    getChannelUrl(channelName) {
        const channel = this._channelList.find(cnl => cnl.name === channelName);
        return channel ? channel.url : null;
    }
    checkListChanged(channelList) {
        return JSON.stringify(channelList) === JSON.stringify(this._channelList) ?
            false : true;
    }
    checkUrlValid(channelUrl) {
        return this._channelList.some(cnl => cnl.url === channelUrl);
    }
}

;// CONCATENATED MODULE: ./src/lib/ActivWidget.ts
const { KEY_space, KEY_KP_Enter, KEY_Return } = imports.gi.Clutter;
function createActivWidget(args) {
    const { widget, onActivated } = args;
    // TODO: understand can_focus
    widget.can_focus = true;
    widget.reactive = true;
    widget.track_hover = true;
    widget.connect('button-release-event', () => onActivated === null || onActivated === void 0 ? void 0 : onActivated());
    // TODO: This is needed because some themes (at least Adapta-Nokto but maybe also others) don't provide style for the hover pseudo class. But it would be much easier to once (and on theme changes) programmatically set the hover pseudo class equal to the active pseudo class when the hover class isn't provided by the theme. 
    widget.connect('notify::hover', () => {
        widget.change_style_pseudo_class('active', widget.hover);
        if (widget.hover)
            widget.grab_key_focus();
    });
    widget.connect('key-press-event', (actor, event) => {
        const symbol = event.get_key_symbol();
        const relevantKeys = [KEY_space, KEY_KP_Enter, KEY_Return];
        if (relevantKeys.includes(symbol) && widget.hover)
            onActivated === null || onActivated === void 0 ? void 0 : onActivated();
    });
}

;// CONCATENATED MODULE: ./src/lib/PopupSubMenu.ts

const { BoxLayout, Label, Icon, ScrollView } = imports.gi.St;
const { ActorAlign, Point } = imports.gi.Clutter;
const { PolicyType } = imports.gi.Gtk;
function createSubMenu(args) {
    const { text } = args;
    const container = new BoxLayout({
        vertical: true
    });
    const label = new Label({
        text
    });
    const triangle = new Icon({
        style_class: 'popup-menu-arrow',
        icon_name: 'pan-end',
        rotation_angle_z: 90,
        x_expand: true,
        x_align: ActorAlign.END,
        pivot_point: new Point({ x: 0.5, y: 0.5 }),
        important: true // without this, it looks ugly on Mint-X Themes
    });
    const toggle = new BoxLayout({
        style_class: 'popup-menu-item popup-submenu-menu-item'
    });
    createActivWidget({
        widget: toggle,
        onActivated: toggleScrollbox
    });
    [label, triangle].forEach(widget => toggle.add_child(widget));
    container.add_child(toggle);
    const scrollbox = new ScrollView({
        style_class: 'popup-sub-menu',
        vscrollbar_policy: PolicyType.AUTOMATIC,
        hscrollbar_policy: PolicyType.NEVER
    });
    const box = new BoxLayout({
        vertical: true
    });
    function toggleScrollbox() {
        scrollbox.visible ? closeMenu() : openMenu();
    }
    function openMenu() {
        scrollbox.show();
        triangle.rotation_angle_z = 90;
    }
    function closeMenu() {
        scrollbox.hide();
        triangle.rotation_angle_z = 0;
    }
    // add_child is recommended but doesn't work: https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/3172
    scrollbox.add_actor(box);
    [toggle, scrollbox].forEach(widget => container.add_child(widget));
    return {
        /** the container which should be used to add it as child to a parent Actor */
        actor: container,
        /** the container which should be used to add children  */
        box,
    };
}

;// CONCATENATED MODULE: ./src/consts.ts
var __rest = (undefined && undefined.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
const { get_home_dir } = imports.gi.GLib;
const APPLET_SITE = 'https://cinnamon-spices.linuxmint.com/applets/view/297';
const DEFAULT_TOOLTIP_TXT = 'Radio++';
const CONFIG_DIR = `${get_home_dir()}/.cinnamon/configs/${__meta.uuid}`;
const MPRIS_PLUGIN_PATH = CONFIG_DIR + '/.mpris.so';
const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so";
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`;
const MPV_CVC_NAME = 'mpv Media Player';
const MAX_STRING_LENGTH = 40;
/** in percent */
const MAX_VOLUME = 100; // see https://github.com/linuxmint/cinnamon-spices-applets/issues/3402#issuecomment-756430754 for an explanation of this value
/** in percent */
const VOLUME_DELTA = 5;
// STYLE CLASSES 
const POPUP_ICON_CLASS = 'popup-menu-icon';
const POPUP_MENU_ITEM_CLASS = 'popup-menu-item';
// ICONS
function getVolumeIcon(args) {
    const { volume } = args;
    const VOLUME_ICON_PREFIX = 'audio-volume';
    const VOLUME_ICONS = [
        { max: 0, name: `${VOLUME_ICON_PREFIX}-muted` },
        { max: 33, name: `${VOLUME_ICON_PREFIX}-low` },
        { max: 66, name: `${VOLUME_ICON_PREFIX}-medium` },
        { max: 100, name: `${VOLUME_ICON_PREFIX}-high` },
    ];
    if (volume < 0 || volume > 100)
        throw new RangeError('volume should be between 0 and 100');
    const index = VOLUME_ICONS.findIndex((_a) => {
        var { max } = _a, rest = __rest(_a, ["max"]);
        return volume <= max;
    });
    return VOLUME_ICONS[index].name;
}
const RADIO_SYMBOLIC_ICON_NAME = 'radioapplet';
const PLAYBACK_ICON_PREFIX = 'media-playback';
const PLAY_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-start`;
const PAUSE_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-pause`;
const STOP_ICON_NAME = `${PLAYBACK_ICON_PREFIX}-stop`;
const SONG_INFO_ICON_NAME = 'audio-x-generic';
const COPY_ICON_NAME = 'edit-copy';
const DOWNLOAD_ICON_NAME = 'south-arrow-weather-symbolic';
const LOADING_ICON_NAME = 'view-refresh-symbolic';

;// CONCATENATED MODULE: ./src/functions/limitString.ts
function limitString(text, maxCharNumber) {
    if (!text)
        return;
    if (text.length <= maxCharNumber)
        return text;
    return [...text].slice(0, maxCharNumber - 3).join('') + '...';
}

;// CONCATENATED MODULE: ./src/lib/IconMenuItem.ts


const { Icon: IconMenuItem_Icon, IconType, Label: IconMenuItem_Label, BoxLayout: IconMenuItem_BoxLayout } = imports.gi.St;
function createIconMenuItem(args) {
    const { text, maxCharNumber, iconName, onActivated } = args;
    let icon;
    let label;
    const container = new IconMenuItem_BoxLayout({
        style_class: 'popup-menu-item'
    });
    setIconName(iconName);
    setText(text);
    function setIconName(name) {
        if (icon && !name) {
            container.remove_child(icon);
            icon = null;
            return;
        }
        if (!name)
            return;
        initIcon();
        icon.icon_name = name;
        if (container.get_child_at_index(0) !== icon)
            container.insert_child_at_index(icon, 0);
    }
    function initIcon() {
        if (!icon) {
            icon = new IconMenuItem_Icon({
                icon_type: IconType.SYMBOLIC,
                style_class: 'popup-menu-icon'
            });
        }
    }
    function setText(text) {
        const labelText = text || ' ';
        if (!label) {
            label = new IconMenuItem_Label();
            container.add_child(label);
        }
        label.set_text(limitString(labelText, maxCharNumber));
    }
    onActivated && createActivWidget({ widget: container, onActivated });
    return {
        actor: container,
        setIconName,
        setText
    };
}

;// CONCATENATED MODULE: ./src/ui/ChannelList/ChannelMenuItem.ts


function createChannelMenuItem(args) {
    const { channelName, onActivated, playbackStatus } = args;
    const playbackIconMap = new Map([
        ["Playing", PLAY_ICON_NAME],
        ["Paused", PAUSE_ICON_NAME],
        ["Loading", LOADING_ICON_NAME],
        ["Stopped", null]
    ]);
    const iconMenuItem = createIconMenuItem({
        maxCharNumber: MAX_STRING_LENGTH,
        text: channelName,
        onActivated: () => onActivated(channelName)
    });
    function setPlaybackStatus(playbackStatus) {
        const iconName = playbackIconMap.get(playbackStatus);
        iconMenuItem.setIconName(iconName);
    }
    playbackStatus && setPlaybackStatus(playbackStatus);
    return {
        setPlaybackStatus,
        actor: iconMenuItem.actor
    };
}

;// CONCATENATED MODULE: ./src/ui/ChannelList/ChannelList.ts


function createChannelList(args) {
    const { stationNames, onChannelClicked } = args;
    const subMenu = createSubMenu({ text: 'My Stations' });
    let currentChannelName;
    let playbackStatus = 'Stopped';
    // the channelItems are saved here to the map and to the container as on the container only the reduced name are shown. Theoretically it therefore couldn't be differentiated between two long channel names with the same first 30 (or so) characters   
    const channelItems = new Map();
    function setStationNames(names) {
        channelItems.clear();
        subMenu.box.remove_all_children();
        names.forEach(name => {
            const channelPlaybackstatus = (name === currentChannelName) ? playbackStatus : 'Stopped';
            const channelItem = createChannelMenuItem({
                channelName: name,
                onActivated: onChannelClicked,
                playbackStatus: channelPlaybackstatus
            });
            channelItems.set(name, channelItem);
            subMenu.box.add_child(channelItem.actor);
        });
    }
    function setPlaybackStatus(newStatus) {
        playbackStatus = newStatus;
        if (!currentChannelName)
            return;
        const channelMenuItem = channelItems.get(currentChannelName);
        channelMenuItem === null || channelMenuItem === void 0 ? void 0 : channelMenuItem.setPlaybackStatus(playbackStatus);
        if (playbackStatus === 'Stopped')
            currentChannelName = null;
    }
    function setCurrentChannel(name) {
        const currentChannelItem = channelItems.get(currentChannelName);
        currentChannelItem === null || currentChannelItem === void 0 ? void 0 : currentChannelItem.setPlaybackStatus('Stopped');
        if (name) {
            const newChannelItem = channelItems.get(name);
            if (!newChannelItem)
                throw new Error(`No channelItem exist for ${name}`);
            newChannelItem.setPlaybackStatus(playbackStatus);
        }
        currentChannelName = name;
    }
    setStationNames(stationNames);
    return {
        actor: subMenu.actor,
        setPlaybackStatus,
        setStationNames,
        setCurrentChannel
    };
}

;// CONCATENATED MODULE: ./src/mpv/MpvHandler.ts

const { getDBusProperties, getDBus, getDBusProxyWithOwner } = imports.misc.interfaces;
const { spawnCommandLine } = imports.misc.util;
// see https://lazka.github.io/pgi-docs/Cvc-1.0/index.html
const { MixerControl } = imports.gi.Cvc;
function createMpvHandler(args) {
    const { onPlaybackstatusChanged, onUrlChanged, onVolumeChanged, onTitleChanged, onLengthChanged, onPositionChanged, checkUrlValid, lastUrl, getInitialVolume, } = args;
    const dbus = getDBus();
    const mediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME);
    const mediaProps = getDBusProperties(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH);
    const control = new MixerControl({ name: __meta.name });
    let cvcStream;
    control.open();
    control.connect('stream-added', (ctrl, id) => {
        const addedStream = control.lookup_stream_id(id);
        if ((addedStream === null || addedStream === void 0 ? void 0 : addedStream.name) !== MPV_CVC_NAME)
            return;
        cvcStream = addedStream;
        cvcStream.connect('notify::volume', () => {
            handleCvcVolumeChanged();
        });
    });
    // When no last Url is passed and mpv is running, it is assumed that mpv is not used for the radio applet (and therefore the playbackstatus is Stopped)
    const initialPlaybackStatus = !lastUrl ? 'Stopped' : getPlaybackStatus();
    let currentUrl = initialPlaybackStatus !== "Stopped" ? lastUrl : null;
    let currentLength = getLength(); // in seconds
    let positionTimerId;
    let bufferExceeded = false;
    let mediaPropsListenerId;
    let seekListenerId;
    if (initialPlaybackStatus !== "Stopped") {
        activateMprisPropsListener();
        activeSeekListener();
        onUrlChanged(currentUrl);
        onPlaybackstatusChanged(initialPlaybackStatus);
        onVolumeChanged(getVolume());
        onTitleChanged(getCurrentTitle());
        onLengthChanged(currentLength);
        onPositionChanged(getPosition());
        startPositionTimer();
    }
    const nameOwnerSignalId = dbus.connectSignal('NameOwnerChanged', (...args) => {
        const name = args[2][0];
        const oldOwner = args[2][1];
        const newOwner = args[2][2];
        if (name !== MPV_MPRIS_BUS_NAME)
            return;
        if (newOwner) {
            activateMprisPropsListener();
            activeSeekListener();
            pauseAllOtherMediaPlayers();
        }
        if (oldOwner) {
            currentLength = 0;
            stopPositionTimer();
            mediaProps.disconnectSignal(mediaPropsListenerId);
            mediaServerPlayer.disconnectSignal(seekListenerId);
            mediaPropsListenerId = seekListenerId = currentUrl = null;
            onPlaybackstatusChanged('Stopped');
        }
    });
    function deactivateAllListener() {
        dbus.disconnectSignal(nameOwnerSignalId);
        if (mediaPropsListenerId)
            mediaProps === null || mediaProps === void 0 ? void 0 : mediaProps.disconnectSignal(mediaPropsListenerId);
        if (seekListenerId)
            mediaServerPlayer === null || mediaServerPlayer === void 0 ? void 0 : mediaServerPlayer.disconnectSignal(seekListenerId);
    }
    function activateMprisPropsListener() {
        mediaPropsListenerId = mediaProps.connectSignal('PropertiesChanged', (proxy, nameOwner, [interfaceName, props]) => {
            var _a, _b, _c;
            const metadata = (_a = props.Metadata) === null || _a === void 0 ? void 0 : _a.recursiveUnpack();
            const volume = (_b = props.Volume) === null || _b === void 0 ? void 0 : _b.unpack();
            const playbackStatus = (_c = props.PlaybackStatus) === null || _c === void 0 ? void 0 : _c.unpack();
            const url = metadata === null || metadata === void 0 ? void 0 : metadata['xesam:url'];
            const title = metadata === null || metadata === void 0 ? void 0 : metadata['xesam:title'];
            const length = metadata === null || metadata === void 0 ? void 0 : metadata["mpris:length"];
            const newUrlValid = checkUrlValid(url);
            const relevantEvent = newUrlValid || currentUrl;
            if (!relevantEvent)
                return; // happens when mpv is running with a file/stream not managed by the applet
            if (length != null)
                handleLengthChanged(length);
            if (volume != null)
                handleMprisVolumeChanged(volume);
            playbackStatus && handleMprisPlaybackStatusChanged(playbackStatus);
            url && newUrlValid && url !== currentUrl && handleUrlChanged(url);
            title && onTitleChanged(title);
        });
    }
    function activeSeekListener() {
        seekListenerId = mediaServerPlayer.connectSignal('Seeked', (id, sender, value) => {
            handlePositionChanged(microSecondsToRoundedSeconds(value));
        });
    }
    /** @param length in microseconds */
    function handleLengthChanged(length) {
        const lengthInSeconds = microSecondsToRoundedSeconds(length);
        onLengthChanged(lengthInSeconds);
        const startLoading = (length === 0);
        const finishedLoading = length !== 0 && currentLength === 0;
        currentLength = lengthInSeconds;
        if (startLoading) {
            onPlaybackstatusChanged('Loading');
        }
        if (finishedLoading || bufferExceeded) {
            const position = finishedLoading ? 0 : getPosition();
            handlePositionChanged(position);
            onPlaybackstatusChanged(getPlaybackStatus());
            bufferExceeded = false;
        }
    }
    /**  @param position in seconds! */
    function handlePositionChanged(position) {
        stopPositionTimer();
        onPositionChanged(position);
        startPositionTimer();
    }
    function startPositionTimer() {
        if (getPlaybackStatus() !== 'Playing')
            return;
        positionTimerId = setInterval(() => {
            const position = Math.min(getPosition(), currentLength);
            onPositionChanged(position);
            if (position === currentLength) {
                onPlaybackstatusChanged('Loading');
                bufferExceeded = true;
                stopPositionTimer();
            }
        }, 1000);
    }
    function stopPositionTimer() {
        if (!positionTimerId)
            return;
        clearInterval(positionTimerId);
        positionTimerId = null;
    }
    function handleMprisPlaybackStatusChanged(playbackStatus) {
        if (currentLength !== 0) {
            onPlaybackstatusChanged(playbackStatus);
            playbackStatus === 'Paused' ? stopPositionTimer()
                : handlePositionChanged(getPosition());
        }
    }
    function handleUrlChanged(newUrl) {
        currentUrl = newUrl;
        handleLengthChanged(0);
        if (positionTimerId)
            stopPositionTimer();
        onPositionChanged(0);
        onUrlChanged(newUrl);
    }
    function handleMprisVolumeChanged(mprisVolume) {
        if (mprisVolume * 100 > MAX_VOLUME) {
            mediaServerPlayer.Volume = MAX_VOLUME / 100;
            return;
        }
        const normalizedVolume = Math.round(mprisVolume * 100);
        setCvcVolume(normalizedVolume);
        onVolumeChanged(normalizedVolume);
    }
    function handleCvcVolumeChanged() {
        const normalizedVolume = Math.round(cvcStream.volume / control.get_vol_max_norm() * 100);
        setMprisVolume(normalizedVolume);
    }
    /** @returns length in seconds */
    function getLength() {
        var _a, _b;
        const lengthMicroSeconds = ((_b = (_a = mediaServerPlayer.Metadata) === null || _a === void 0 ? void 0 : _a["mpris:length"]) === null || _b === void 0 ? void 0 : _b.unpack()) || 0;
        return microSecondsToRoundedSeconds(lengthMicroSeconds);
    }
    /** @returns position in seconds */
    function getPosition() {
        if (getPlaybackStatus() === 'Stopped')
            return 0;
        // for some reason, this only return the right value the first time it is called. When calling this multiple times, it returns always the same value which however is wrong when radio is playing
        // const positionMicroSeconds = mediaServerPlayer.Position
        const positionMicroSeconds = mediaProps.GetSync('org.mpris.MediaPlayer2.Player', 'Position')[0].deepUnpack();
        return microSecondsToRoundedSeconds(positionMicroSeconds);
    }
    function setUrl(url) {
        if (getPlaybackStatus() === 'Stopped') {
            let initialVolume = getInitialVolume();
            if (initialVolume == null) {
                global.logWarning('initial Volume was null or undefined. Applying 50 as a fallback solution to prevent radio stop working');
                initialVolume = 50;
            }
            const command = `mpv --script=${MPRIS_PLUGIN_PATH} ${url} 
                --volume=${initialVolume}`;
            spawnCommandLine(command);
            return;
        }
        mediaServerPlayer.OpenUriRemote(url);
        mediaServerPlayer.PlaySync();
    }
    function increaseDecreaseVolume(volumeChange) {
        // newVolume is the current Volume plus(or minus) volumeChange 
        // but at least 0 and maximum Max_Volume
        const newVolume = Math.min(MAX_VOLUME, Math.max(0, getVolume() + volumeChange));
        setMprisVolume(newVolume);
    }
    /** @param newVolume volume in percent */
    function setMprisVolume(newVolume) {
        if (getVolume() === newVolume || getPlaybackStatus() === 'Stopped')
            return;
        mediaServerPlayer.Volume = newVolume / 100;
    }
    /** @param newVolume volume in percent */
    function setCvcVolume(newVolume) {
        const newStreamVolume = newVolume / 100 * control.get_vol_max_norm();
        if (!cvcStream)
            return;
        if (cvcStream.volume === newStreamVolume)
            return;
        cvcStream.is_muted && cvcStream.change_is_muted(false);
        cvcStream.volume = newStreamVolume;
        cvcStream.push_volume();
    }
    function togglePlayPause() {
        if (getPlaybackStatus() === "Stopped")
            return;
        mediaServerPlayer.PlayPauseSync();
    }
    function stop() {
        if (getPlaybackStatus() === "Stopped")
            return;
        mediaServerPlayer.StopSync();
    }
    function getCurrentTitle() {
        if (getPlaybackStatus() === "Stopped")
            return;
        return mediaServerPlayer.Metadata["xesam:title"].unpack();
    }
    /**
     * pauses all MediaPlayers with MPRIS Support except mpv
     */
    function pauseAllOtherMediaPlayers() {
        dbus.ListNamesSync()[0].forEach(busName => {
            if (!busName.includes(MEDIA_PLAYER_2_NAME) || busName === MPV_MPRIS_BUS_NAME)
                return;
            const nonMpvMediaServerPlayer = getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, busName);
            nonMpvMediaServerPlayer.PauseSync();
        });
    }
    function getPlaybackStatus() {
        // this is necessary because when a user stops mpv and afterwards start vlc (or maybe also an other media player), mediaServerPlayer.PlaybackStatus wrongly returns "Playing"  
        const mpvRunning = dbus.ListNamesSync()[0].includes(MPV_MPRIS_BUS_NAME);
        return mpvRunning ? mediaServerPlayer.PlaybackStatus : 'Stopped';
    }
    function getVolume() {
        if (getPlaybackStatus() === 'Stopped')
            return null;
        return Math.round(mediaServerPlayer.Volume * 100);
    }
    function microSecondsToRoundedSeconds(microSeconds) {
        const seconds = microSeconds / 1000000;
        const secondsRounded = Math.round(seconds);
        return secondsRounded;
    }
    /** @param newPosition in seconds */
    function setPosition(newPosition) {
        const positioninMicroSeconds = Math.min(newPosition * 1000000, currentLength * 1000000);
        const trackId = mediaServerPlayer.Metadata['mpris:trackid'].unpack();
        mediaServerPlayer === null || mediaServerPlayer === void 0 ? void 0 : mediaServerPlayer.SetPositionRemote(trackId, positioninMicroSeconds);
    }
    return {
        increaseDecreaseVolume,
        setVolume: setMprisVolume,
        setUrl,
        togglePlayPause,
        stop,
        getCurrentTitle,
        setPosition,
        deactivateAllListener,
        // it is very confusing but dbus must be returned!
        // Otherwilse all listeners stop working after about 20 seconds which is fucking difficult to debug
        dbus
    };
}

;// CONCATENATED MODULE: ./src/lib/Slider.ts
const { DrawingArea } = imports.gi.St;
const { cairo_set_source_color, grab_pointer, ungrab_pointer } = imports.gi.Clutter;
function createSlider(args) {
    const style_class = 'popup-slider-menu-item';
    const { initialValue, onValueChanged } = args;
    let value;
    if (initialValue)
        value = limitToMinMax(initialValue);
    const drawing = new DrawingArea({
        style_class,
        reactive: true,
        x_expand: true
    });
    drawing.connect('repaint', () => {
        const cr = drawing.get_context();
        const themeNode = drawing.get_theme_node();
        const [width, height] = drawing.get_surface_size();
        const handleRadius = themeNode.get_length('-slider-handle-radius');
        const sliderHeight = themeNode.get_length('-slider-height');
        const sliderBorderWidth = themeNode.get_length('-slider-border-width');
        const sliderBorderRadius = Math.min(width, sliderHeight) / 2;
        const sliderBorderColor = themeNode.get_color('-slider-border-color');
        const sliderColor = themeNode.get_color('-slider-background-color');
        const sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
        const sliderActiveColor = themeNode.get_color('-slider-active-background-color');
        const TAU = Math.PI * 2;
        const handleX = handleRadius + (width - 2 * handleRadius) * value;
        cr.arc(sliderBorderRadius + sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 1 / 4, TAU * 3 / 4);
        cr.lineTo(handleX, (height - sliderHeight) / 2);
        cr.lineTo(handleX, (height + sliderHeight) / 2);
        cr.lineTo(sliderBorderRadius + sliderBorderWidth, (height + sliderHeight) / 2);
        cairo_set_source_color(cr, sliderActiveColor);
        cr.fillPreserve();
        cairo_set_source_color(cr, sliderActiveBorderColor);
        cr.setLineWidth(sliderBorderWidth);
        cr.stroke();
        cr.arc(width - sliderBorderRadius - sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 3 / 4, TAU * 1 / 4);
        cr.lineTo(handleX, (height + sliderHeight) / 2);
        cr.lineTo(handleX, (height - sliderHeight) / 2);
        cr.lineTo(width - sliderBorderRadius - sliderBorderWidth, (height - sliderHeight) / 2);
        cairo_set_source_color(cr, sliderColor);
        cr.fillPreserve();
        cairo_set_source_color(cr, sliderBorderColor);
        cr.setLineWidth(sliderBorderWidth);
        cr.stroke();
        const handleY = height / 2;
        const color = themeNode.get_foreground_color();
        cairo_set_source_color(cr, color);
        cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
        cr.fill();
        cr.$dispose();
    });
    drawing.connect('button-press-event', (actor, event) => {
        grab_pointer(drawing);
        const motionId = drawing.connect('motion-event', (actor, event) => {
            moveHandle(event);
        });
        const buttonReleaseId = drawing.connect('button-release-event', () => {
            drawing.disconnect(buttonReleaseId);
            drawing.disconnect(motionId);
            ungrab_pointer();
        });
        moveHandle(event);
    });
    function moveHandle(event) {
        const [absX, absY] = event.get_coords();
        const [sliderX, sliderY] = drawing.get_transformed_position();
        const relX = absX - sliderX;
        const width = drawing.width;
        const handleRadius = drawing.get_theme_node().get_length('-slider-handle-radius');
        const newValue = (relX - handleRadius) / (width - 2 * handleRadius);
        const newValueLimitToMinMax = limitToMinMax(newValue);
        setValue(newValueLimitToMinMax);
    }
    function limitToMinMax(value) {
        return Math.max(Math.min(value, 1), 0);
    }
    function setValue(newValue, silent = false) {
        const correctedValue = limitToMinMax(newValue);
        if (correctedValue === value)
            return;
        value = correctedValue;
        if (!silent)
            onValueChanged === null || onValueChanged === void 0 ? void 0 : onValueChanged(value);
        drawing.queue_repaint();
    }
    function getValue() {
        return value;
    }
    return {
        actor: drawing,
        setValue,
        getValue
    };
}

;// CONCATENATED MODULE: ./src/ui/VolumeSlider.ts



const { BoxLayout: VolumeSlider_BoxLayout, Icon: VolumeSlider_Icon, IconType: VolumeSlider_IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
const { KEY_Right, KEY_Left, ScrollDirection } = imports.gi.Clutter;
function createVolumeSlider(args) {
    const { onVolumeChanged } = args;
    let tooltip;
    const container = new VolumeSlider_BoxLayout({
        style_class: POPUP_MENU_ITEM_CLASS,
    });
    createActivWidget({
        widget: container
    });
    /** in Percent and rounded! */
    let volume;
    const slider = createSlider({
        onValueChanged: handleSliderValueChanged
    });
    const icon = new VolumeSlider_Icon({
        icon_type: VolumeSlider_IconType.SYMBOLIC,
        style_class: POPUP_ICON_CLASS,
        reactive: true
    });
    [icon, slider.actor].forEach(widget => {
        container.add_child(widget);
    });
    container.connect('key-press-event', (actor, event) => {
        const key = event.get_key_symbol();
        if (key === KEY_Right || key === KEY_Left) {
            const direction = (key === KEY_Right) ? 'increase' : 'decrease';
            deltaChange(direction);
        }
    });
    container.connect('scroll-event', (actor, event) => {
        const scrollDirection = event.get_scroll_direction();
        const direction = (scrollDirection === ScrollDirection.UP) ? 'increase' : 'decrease';
        deltaChange(direction);
    });
    icon.connect('button-press-event', () => {
        slider.setValue(0);
    });
    /**
     *
     * @param newValue between 0 and 1
     */
    function handleSliderValueChanged(newValue) {
        updateVolume(newValue * 100, true);
    }
    function deltaChange(direction) {
        const delta = (direction === 'increase') ? VOLUME_DELTA : -VOLUME_DELTA;
        const newValue = slider.getValue() + delta / 100;
        slider.setValue(newValue);
    }
    /**
     *
     * @param newVolume in percent but doesn't need to be rounded
     * @param showTooltip
     */
    function updateVolume(newVolume, showTooltip) {
        const newVolumeRounded = Math.round(newVolume);
        if (newVolumeRounded === volume)
            return;
        volume = newVolumeRounded;
        slider.setValue(volume / 100);
        icon.set_icon_name(getVolumeIcon({ volume }));
        setTooltip(volume);
        showTooltip && tooltip.show();
        onVolumeChanged === null || onVolumeChanged === void 0 ? void 0 : onVolumeChanged(volume);
    }
    /**
     *
     * @param volume in Percent and rounded!
     */
    function setTooltip(volume) {
        if (!tooltip)
            tooltip = new Tooltip(slider.actor, ' ');
        tooltip.set_text(`Volume: ${volume.toString()} %`);
    }
    /**
     *
     * @param newVolume in percent (0-100)
     */
    function setVolume(newVolume) {
        updateVolume(newVolume, false);
    }
    return {
        actor: container,
        setVolume
    };
}

// EXTERNAL MODULE: ./node_modules/cinnamonpopup/index.js
var cinnamonpopup = __webpack_require__(447);
;// CONCATENATED MODULE: ./src/lib/PopupSeperator.ts
const { BoxLayout: PopupSeperator_BoxLayout, DrawingArea: PopupSeperator_DrawingArea } = imports.gi.St;
const { LinearGradient } = imports.gi.cairo;
function createSeparatorMenuItem() {
    const container = new PopupSeperator_BoxLayout({
        style_class: 'popup-menu-item'
    });
    const drawingArea = new PopupSeperator_DrawingArea({
        style_class: 'popup-separator-menu-item',
        x_expand: true
    });
    container.add_child(drawingArea);
    drawingArea.connect('repaint', () => {
        const cr = drawingArea.get_context();
        const themeNode = drawingArea.get_theme_node();
        const [width, height] = drawingArea.get_surface_size();
        const margin = themeNode.get_length('-margin-horizontal');
        const gradientHeight = themeNode.get_length('-gradient-height');
        const startColor = themeNode.get_color('-gradient-start');
        const endColor = themeNode.get_color('-gradient-end');
        const gradientWidth = (width - margin * 2);
        const gradientOffset = (height - gradientHeight) / 2;
        const pattern = new LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        // TODO
        // const colors = ['red', 'green', 'blue', 'alpha'].map(color => startColor[color] / 255)
        // https://github.com/microsoft/TypeScript/issues/4130#issuecomment-499525897
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
        cr.$dispose;
    });
    return container;
}

;// CONCATENATED MODULE: ./src/ui/Toolbar/MediaControlToolbar.ts
const { BoxLayout: MediaControlToolbar_BoxLayout } = imports.gi.St;
const { ActorAlign: MediaControlToolbar_ActorAlign } = imports.gi.Clutter;
const createMediaControlToolbar = (args) => {
    const { controlBtns } = args;
    const toolbar = new MediaControlToolbar_BoxLayout({
        style_class: "radio-applet-media-control-toolbar",
        x_align: MediaControlToolbar_ActorAlign.CENTER
    });
    controlBtns.forEach(btn => toolbar.add_child(btn));
    return toolbar;
};

;// CONCATENATED MODULE: ./src/ui/Toolbar/ControlBtn.ts

const { Button, Icon: ControlBtn_Icon, IconType: ControlBtn_IconType } = imports.gi.St;
const { Tooltip: ControlBtn_Tooltip } = imports.ui.tooltips;
function createControlBtn(args) {
    const { iconName, tooltipTxt, onClick } = args;
    const icon = new ControlBtn_Icon({
        icon_type: ControlBtn_IconType.SYMBOLIC,
        icon_name: iconName,
        style_class: 'popup-menu-icon' // this specifies the icon-size
    });
    const btn = new Button({
        reactive: true,
        can_focus: true,
        // It is challenging to get a reasonable style on all themes. I have tried using the 'sound-player-overlay' class but didn't get it working. However might be possible anyway.  
        style_class: "popup-menu-item",
        style: "width:20px; padding:10px!important",
        child: icon
    });
    createActivWidget({
        widget: btn,
        onActivated: onClick
    });
    const tooltip = new ControlBtn_Tooltip(btn, tooltipTxt);
    return {
        actor: btn,
        icon,
        tooltip
    };
}

;// CONCATENATED MODULE: ./src/ui/Toolbar/PlayPauseButton.ts


function createPlayPauseButton(args) {
    const { onClick } = args;
    const controlBtn = createControlBtn({
        iconName: PLAY_ICON_NAME,
        tooltipTxt: 'Play',
        onClick
    });
    /**
     *
     * @param playPause he current state of the radio, which means that the opposite is shown (e.g. when the radio is playing, it is shown a pause item)
     *
     */
    function setPlaybackStatus(playPause) {
        let tooltipTxt;
        let iconName;
        if (playPause === 'Playing') {
            tooltipTxt = 'Pause';
            iconName = PAUSE_ICON_NAME;
        }
        if (playPause === 'Paused') {
            tooltipTxt = 'Play';
            iconName = PLAY_ICON_NAME;
        }
        controlBtn.tooltip.set_text(tooltipTxt);
        controlBtn.icon.icon_name = iconName;
    }
    return {
        actor: controlBtn.actor,
        setPlaybackStatus
    };
}

;// CONCATENATED MODULE: ./src/ui/Toolbar/StopButton.ts


function createStopBtn(args) {
    const { onClick } = args;
    const stopBtn = createControlBtn({
        iconName: STOP_ICON_NAME,
        tooltipTxt: "Stop",
        onClick
    });
    return {
        actor: stopBtn.actor
    };
}

;// CONCATENATED MODULE: ./src/ui/InfoSection.ts


const { BoxLayout: InfoSection_BoxLayout } = imports.gi.St;
function createInfoSection() {
    const channelInfoItem = createInfoItem(RADIO_SYMBOLIC_ICON_NAME);
    const songInfoItem = createInfoItem(SONG_INFO_ICON_NAME);
    const infoSection = new InfoSection_BoxLayout({
        vertical: true
    });
    [channelInfoItem, songInfoItem].forEach(infoItem => {
        infoSection.add_child(infoItem.actor);
    });
    function createInfoItem(iconName) {
        const iconMenuItem = createIconMenuItem({
            iconName,
            maxCharNumber: MAX_STRING_LENGTH,
        });
        return iconMenuItem;
    }
    function setChannel(channeName) {
        channelInfoItem.setText(channeName);
    }
    function setSongTitle(songTitle) {
        songInfoItem.setText(songTitle);
    }
    return {
        actor: infoSection,
        setSongTitle,
        setChannel
    };
}

;// CONCATENATED MODULE: ./src/ui/Toolbar/DownloadButton.ts


function createDownloadButton(args) {
    const { onClick } = args;
    const downloadButton = createControlBtn({
        iconName: DOWNLOAD_ICON_NAME,
        tooltipTxt: "Download current song from Youtube",
        onClick
    });
    return {
        actor: downloadButton.actor
    };
}

;// CONCATENATED MODULE: ./src/ui/Toolbar/CopyButton.ts


function createCopyButton(args) {
    const { onClick } = args;
    const defaultTooltipTxt = "Copy current song title to Clipboard";
    const controlBtn = createControlBtn({
        iconName: COPY_ICON_NAME,
        tooltipTxt: defaultTooltipTxt,
        onClick: handleClick
    });
    function handleClick() {
        controlBtn.tooltip.show();
        onClick();
        // showCopyInTooltip()
    }
    // For some reasons I don't understand, this function has stopped working after refactoring the popup Menu. No idea how to debug this. Therefore deactivating this for now :-(. It is thrown an  warning when clicking on the button but this has nothing to do with the tooltip
    function showCopyInTooltip() {
        const tooltip = controlBtn.tooltip;
        tooltip.set_text("Copied");
        tooltip.show();
        setTimeout(() => {
            tooltip.hide();
            tooltip.set_text(defaultTooltipTxt);
        }, 500);
    }
    return {
        actor: controlBtn.actor,
    };
}

;// CONCATENATED MODULE: ./src/functions/downloadFromYoutube.ts
const { spawnCommandLineAsyncIO } = imports.misc.util;
const { get_home_dir: downloadFromYoutube_get_home_dir } = imports.gi.GLib;
function downloadSongFromYoutube(args) {
    const { title, downloadDir, onDownloadFinished, onDownloadFailed } = args;
    let hasBeenCancelled = false;
    // When using the default value of the settings, the dir starts with ~ what can't be understand when executing command. 
    // After changing the value in the configs dialogue, the value starts with file:// what youtube-dl can't handle. Saving to network directories (e.g. ftp) doesn't work 
    const music_dir_absolut = downloadDir.replace('~', downloadFromYoutube_get_home_dir()).replace('file://', '');
    // ytsearch option found here https://askubuntu.com/a/731511/1013434 (not given in the youtube-dl docs ...)
    const downloadCommand = `youtube-dl --output "${music_dir_absolut}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replaceAll('"', '\\\"')}" --add-metadata --embed-thumbnail`;
    const process = spawnCommandLineAsyncIO(downloadCommand, (stdout, stderr) => {
        try {
            if (hasBeenCancelled) {
                hasBeenCancelled = false;
                return;
            }
            if (stderr)
                throw new Error(stderr);
            if (stdout) {
                const downloadPath = getDownloadPath(stdout);
                if (!downloadPath)
                    throw new Error('File not saved');
                onDownloadFinished(downloadPath);
            }
        }
        catch (error) {
            global.logError(`The following error occured at youtube download attempt: ${error}. The used download Command was: ${downloadCommand}`);
            onDownloadFailed();
        }
    });
    function cancel() {
        hasBeenCancelled = true;
        // it seems to be no problem to call this even after the process has already finished
        process.force_exit();
    }
    return { cancel };
}
function getDownloadPath(stdout) {
    const arrayOfLines = stdout.match(/[^\r\n]+/g);
    // there is only one line in stdout which gives the path of the downloaded mp3. This start with [ffmpeg] Destination ...
    const searchString = '[ffmpeg] Destination: ';
    return arrayOfLines.find(line => line.includes(searchString))
        .split(searchString)[1];
}

;// CONCATENATED MODULE: ./src/functions/promiseHelpers.ts
const { spawnCommandLineAsyncIO: promiseHelpers_spawnCommandLineAsyncIO } = imports.misc.util;
const spawnCommandLinePromise = function (command) {
    return new Promise((resolve, reject) => {
        promiseHelpers_spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode]);
        });
    });
};

;// CONCATENATED MODULE: ./src/ui/Notifications/NotificationBase.ts
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { messageTray } = imports.ui.main;
const { Icon: NotificationBase_Icon, IconType: NotificationBase_IconType } = imports.gi.St;

const messageSource = new SystemNotificationSource('Radio Applet');
messageTray.add(messageSource);
function createBasicNotification(args) {
    const { notificationText, isMarkup = false, transient = true } = args;
    const icon = new NotificationBase_Icon({
        icon_type: NotificationBase_IconType.SYMBOLIC,
        icon_name: RADIO_SYMBOLIC_ICON_NAME,
        icon_size: 25
    });
    const notification = new Notification(messageSource, __meta.name, notificationText, { icon, bodyMarkup: isMarkup });
    notification.setTransient(transient);
    notification.notify = () => {
        messageSource.notify(notification);
    };
    return notification;
}

;// CONCATENATED MODULE: ./src/ui/Notifications/GenericNotification.ts

function notify(args) {
    const { text } = args;
    const notification = createBasicNotification({
        notificationText: text
    });
    notification.notify();
}

;// CONCATENATED MODULE: ./src/mpv/CheckInstallation.ts



const { find_program_in_path, file_test, FileTest } = imports.gi.GLib;
async function installMpvWithMpris() {
    const mprisPluginDownloaded = checkMprisPluginDownloaded();
    const mpvInstalled = checkMpvInstalled();
    !mprisPluginDownloaded && await downloadMrisPluginInteractive();
    if (!mpvInstalled) {
        const notificationText = `Please ${mprisPluginDownloaded ? '' : 'also'} install the mpv package.`;
        notify({ text: notificationText });
        await installMpvInteractive();
    }
}
function checkMpvInstalled() {
    return find_program_in_path('mpv');
}
function checkMprisPluginDownloaded() {
    return file_test(MPRIS_PLUGIN_PATH, FileTest.IS_REGULAR);
}
function installMpvInteractive() {
    return new Promise(async (resolve, reject) => {
        if (checkMpvInstalled())
            return resolve();
        if (!find_program_in_path("apturl"))
            return reject();
        const [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            apturl apt://mpv`);
        // exitCode 0 means sucessfully. See: man apturl
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
}
function downloadMrisPluginInteractive() {
    return new Promise(async (resolve, reject) => {
        if (checkMprisPluginDownloaded()) {
            return resolve();
        }
        let [stderr, stdout, exitCode] = await spawnCommandLinePromise(`python3  ${__meta.path}/download-dialog-mpris.py`);
        if (stdout.trim() !== 'Continue') {
            return reject();
        }
        [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            wget ${MPRIS_PLUGIN_URL} -O ${MPRIS_PLUGIN_PATH}`);
        // Wget always prints to stderr - exitcode 0 means it was sucessfull 
        // see:  https://stackoverflow.com/questions/13066518/why-does-wget-output-to-stderr-rather-than-stdout
        // and https://www.gnu.org/software/wget/manual/html_node/Exit-Status.html
        return (exitCode === 0) ? resolve() : reject(stderr);
    });
}

;// CONCATENATED MODULE: ./src/functions/copyText.ts
const { Clipboard, ClipboardType } = imports.gi.St;
function copyText(text) {
    Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, text);
}

;// CONCATENATED MODULE: ./src/ui/Applet/Applet.ts
const { Applet, AllowedLayout } = imports.ui.applet;
const { Bin } = imports.gi.St;
const { EventType } = imports.gi.Clutter;
function createApplet(args) {
    const { orientation, panelHeight, instanceId, icon, label, onClick, onScroll, onMiddleClick, onAppletMoved, onAppletRemoved, onRightClick } = args;
    const applet = new Applet(orientation, panelHeight, instanceId);
    let appletReloaded = false;
    [icon, label].forEach(widget => {
        applet.actor.add_child(widget);
    });
    applet.on_applet_clicked = onClick;
    applet.on_applet_middle_clicked = onMiddleClick;
    applet.setAllowedLayout(AllowedLayout.BOTH);
    applet.on_applet_reloaded = function () {
        appletReloaded = true;
    };
    applet.on_applet_removed_from_panel = function () {
        appletReloaded ? onAppletMoved() : onAppletRemoved();
        appletReloaded = false;
    };
    applet.actor.connect('event', (actor, event) => {
        if (event.type() !== EventType.BUTTON_PRESS)
            return;
        if (event.get_button() === 3) {
            onRightClick();
        }
    });
    applet.actor.connect('scroll-event', (actor, event) => {
        onScroll(event.get_scroll_direction());
    });
    return applet;
}

;// CONCATENATED MODULE: ./src/ui/Applet/AppletIcon.ts

const { Icon: AppletIcon_Icon, IconType: AppletIcon_IconType } = imports.gi.St;
const { IconType: IconTypeEnum } = imports.gi.St;
function createAppletIcon(args) {
    const { panel, locationLabel } = args;
    let playbackStatus;
    const playbackStatusStyleMap = new Map([
        ['Stopped', ' '],
        ['Loading', ' ']
    ]);
    const icon = new AppletIcon_Icon({});
    let normalIconType;
    // the icon type passed from outside is overriten when the playbackstatus is 'loading' 
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
            iconName = RADIO_SYMBOLIC_ICON_NAME;
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
            setIconTypeInternal(IconTypeEnum.SYMBOLIC, LOADING_ICON_NAME);
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

;// CONCATENATED MODULE: ./src/ui/Applet/AppletLabel.ts
const { Label: AppletLabel_Label } = imports.gi.St;
const { EllipsizeMode } = imports.gi.Pango;
const { ActorAlign: AppletLabel_ActorAlign } = imports.gi.Clutter;
function createAppletLabel() {
    const label = new AppletLabel_Label({
        reactive: true,
        track_hover: true,
        style_class: 'applet-label',
        y_align: AppletLabel_ActorAlign.CENTER,
        y_expand: false,
        visible: false
    });
    // No idea why needed but without the label is not shown 
    label.clutter_text.ellipsize = EllipsizeMode.NONE;
    let visible;
    let text;
    /**
     *
     * @param newValue text to show on the label. The text however is only visible in the GUI when visible is true. It is also shown no text when passing null for text but in that case the text is shown again when calling this function again with a string (i.e this function is intended to be used with null when the text shall only temporarily be hidden)
     *
     */
    function setText(newValue) {
        text = newValue;
        if (!visible)
            return;
        label.show();
        newValue ? label.text = ` ${newValue}` : label.hide();
    }
    function setVisibility(newValue) {
        visible = newValue;
        if (text)
            label.visible = newValue;
        if (visible && text)
            setText(text);
    }
    return {
        actor: label,
        setVisibility,
        setText,
    };
}

;// CONCATENATED MODULE: ./src/ui/Applet/AppletTooltip.ts

const { PanelItemTooltip } = imports.ui.tooltips;
function createAppletTooltip(args) {
    const { orientation, applet } = args;
    const tooltip = new PanelItemTooltip(applet, null, orientation);
    setDefaultTooltip();
    function setVolume(volume) {
        tooltip.set_text(`Volume: ${volume.toString()} %`);
    }
    function setDefaultTooltip() {
        tooltip.set_text(DEFAULT_TOOLTIP_TXT);
    }
    return {
        setVolume,
        setDefaultTooltip
    };
}

;// CONCATENATED MODULE: ./src/ui/Notifications/YoutubeDownloadFinishedNotification.ts

const { spawnCommandLine: YoutubeDownloadFinishedNotification_spawnCommandLine } = imports.misc.util;
function notifyYoutubeDownloadFinished(args) {
    const { downloadPath } = args;
    const notification = createBasicNotification({
        notificationText: `Download finished. File saved to ${downloadPath}`
    });
    const playBtnId = 'openBtn';
    notification.addButton(playBtnId, 'Play');
    notification.connect('action-invoked', (actor, id) => {
        if (id === playBtnId) {
            YoutubeDownloadFinishedNotification_spawnCommandLine(`xdg-open '${downloadPath}'`);
        }
    });
    notification.notify();
}

;// CONCATENATED MODULE: ./src/ui/Notifications/YoutubeDownloadStartedNotification.ts

function notifyYoutubeDownloadStarted(args) {
    const { title, onCancelClicked } = args;
    const notification = createBasicNotification({
        notificationText: `Downloading ${title} ...`,
    });
    const cancelBtnId = 'cancelBtn';
    notification.addButton(cancelBtnId, 'Cancel');
    notification.connect('action-invoked', (actor, id) => {
        if (id === cancelBtnId)
            onCancelClicked();
    });
    notification.notify();
}

;// CONCATENATED MODULE: ./src/ui/Notifications/YoutubeDownloadFailedNotification.ts


const { spawnCommandLine: YoutubeDownloadFailedNotification_spawnCommandLine } = imports.misc.util;
const { get_home_dir: YoutubeDownloadFailedNotification_get_home_dir } = imports.gi.GLib;
function notifyYoutubeDownloadFailed() {
    const notificationText = `Couldn't download Song from Youtube due to an Error. Make Sure you have the newest version of youtube-dl installed. 
        \n<b>Important:</b> Don't use apt for the installation but follow the installation instruction given on the Radio Applet Site in the Cinnamon Store instead
        \nFor more information see the logs`;
    const notification = createBasicNotification({
        notificationText,
        isMarkup: true,
        transient: false
    });
    const viewStoreBtnId = 'viewStoreBtn';
    const viewLogBtnId = 'viewLogBtn';
    notification.addButton(viewStoreBtnId, 'View Installation Instruction');
    notification.addButton(viewLogBtnId, "View Logs");
    notification.connect('action-invoked', (actor, id) => {
        if (id === viewStoreBtnId) {
            YoutubeDownloadFailedNotification_spawnCommandLine(`xdg-open ${APPLET_SITE} `);
        }
        if (id === viewLogBtnId) {
            YoutubeDownloadFailedNotification_spawnCommandLine(`xdg-open ${YoutubeDownloadFailedNotification_get_home_dir()}/.xsession-errors`);
        }
    });
    notification.notify();
}

;// CONCATENATED MODULE: ./src/ui/Seeker.ts



const { BoxLayout: Seeker_BoxLayout, Label: Seeker_Label } = imports.gi.St;
function createTimeLabel() {
    return new Seeker_Label({
        // used to ensure that the width doesn't change on some fonts
        style: 'font-family: mono'
    });
}
function createSeeker(args) {
    const { onPositionChanged } = args;
    const container = new Seeker_BoxLayout({
        style_class: POPUP_MENU_ITEM_CLASS
    });
    createActivWidget({
        widget: container
    });
    // length in seconds
    let length = 100;
    // position in seconds
    let position;
    const positionLabel = createTimeLabel();
    const lengthLabel = createTimeLabel();
    const slider = createSlider({
        initialValue: 0.5,
        onValueChanged: handleValueChanged
    });
    [positionLabel, slider.actor, lengthLabel].forEach(widget => {
        container.add_child(widget);
    });
    /** @param value in seconds */
    function setLength(value) {
        length = value;
        lengthLabel.set_text(secondsToFormatedMin(value));
        refreshSliderValue();
    }
    /** @param value in seconds */
    function setPosition(value) {
        position = value;
        positionLabel.set_text(secondsToFormatedMin(position));
        refreshSliderValue();
    }
    function refreshSliderValue() {
        const sliderValue = length === 0 ? 0 : Math.min(position / length, 1);
        slider.setValue(sliderValue, true);
    }
    function handleValueChanged(value) {
        const newPosition = value * length;
        onPositionChanged(newPosition);
    }
    /**
     * converts seconds to a string in the form of: mm:ss
     *
     * e.g. 10 seconds = 00:10, 100 seconds = 01:40,  6000 seconds = 100:00
     *
     * @param seconds
     * @returns
     */
    function secondsToFormatedMin(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds - minutes * 60;
        // ensures minutes and seconds are shown with at least two digits
        return [minutes, remainingSeconds].map(value => {
            const valueString = value.toString().padStart(2, '0');
            return valueString;
        }).join(":");
    }
    return {
        actor: container,
        setLength,
        setPosition
    };
}

;// CONCATENATED MODULE: ./node_modules/lodash-es/isObject.js
/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/* harmony default export */ const lodash_es_isObject = (isObject);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_freeGlobal.js
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/* harmony default export */ const _freeGlobal = (freeGlobal);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_root.js


/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = _freeGlobal || freeSelf || Function('return this')();

/* harmony default export */ const _root = (root);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Symbol.js


/** Built-in value references. */
var Symbol = _root.Symbol;

/* harmony default export */ const _Symbol = (Symbol);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getRawTag.js


/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _getRawTag_hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = _Symbol ? _Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = _getRawTag_hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

/* harmony default export */ const _getRawTag = (getRawTag);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_objectToString.js
/** Used for built-in method references. */
var _objectToString_objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var _objectToString_nativeObjectToString = _objectToString_objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return _objectToString_nativeObjectToString.call(value);
}

/* harmony default export */ const _objectToString = (objectToString);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseGetTag.js




/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var _baseGetTag_symToStringTag = _Symbol ? _Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (_baseGetTag_symToStringTag && _baseGetTag_symToStringTag in Object(value))
    ? _getRawTag(value)
    : _objectToString(value);
}

/* harmony default export */ const _baseGetTag = (baseGetTag);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isFunction.js



/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!lodash_es_isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = _baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/* harmony default export */ const lodash_es_isFunction = (isFunction);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_coreJsData.js


/** Used to detect overreaching core-js shims. */
var coreJsData = _root["__core-js_shared__"];

/* harmony default export */ const _coreJsData = (coreJsData);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_isMasked.js


/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(_coreJsData && _coreJsData.keys && _coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/* harmony default export */ const _isMasked = (isMasked);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_toSource.js
/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/* harmony default export */ const _toSource = (toSource);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIsNative.js





/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var _baseIsNative_funcProto = Function.prototype,
    _baseIsNative_objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var _baseIsNative_funcToString = _baseIsNative_funcProto.toString;

/** Used to check objects for own properties. */
var _baseIsNative_hasOwnProperty = _baseIsNative_objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  _baseIsNative_funcToString.call(_baseIsNative_hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!lodash_es_isObject(value) || _isMasked(value)) {
    return false;
  }
  var pattern = lodash_es_isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(_toSource(value));
}

/* harmony default export */ const _baseIsNative = (baseIsNative);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getValue.js
/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/* harmony default export */ const _getValue = (getValue);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getNative.js



/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = _getValue(object, key);
  return _baseIsNative(value) ? value : undefined;
}

/* harmony default export */ const _getNative = (getNative);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_defineProperty.js


var defineProperty = (function() {
  try {
    var func = _getNative(Object, 'defineProperty');
    func({}, '', {});
    return func;
  } catch (e) {}
}());

/* harmony default export */ const _defineProperty = (defineProperty);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseAssignValue.js


/**
 * The base implementation of `assignValue` and `assignMergeValue` without
 * value checks.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function baseAssignValue(object, key, value) {
  if (key == '__proto__' && _defineProperty) {
    _defineProperty(object, key, {
      'configurable': true,
      'enumerable': true,
      'value': value,
      'writable': true
    });
  } else {
    object[key] = value;
  }
}

/* harmony default export */ const _baseAssignValue = (baseAssignValue);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_createBaseFor.js
/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/* harmony default export */ const _createBaseFor = (createBaseFor);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseFor.js


/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = _createBaseFor();

/* harmony default export */ const _baseFor = (baseFor);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseTimes.js
/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/* harmony default export */ const _baseTimes = (baseTimes);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isObjectLike.js
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/* harmony default export */ const lodash_es_isObjectLike = (isObjectLike);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIsArguments.js



/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return lodash_es_isObjectLike(value) && _baseGetTag(value) == argsTag;
}

/* harmony default export */ const _baseIsArguments = (baseIsArguments);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isArguments.js



/** Used for built-in method references. */
var isArguments_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var isArguments_hasOwnProperty = isArguments_objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = isArguments_objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = _baseIsArguments(function() { return arguments; }()) ? _baseIsArguments : function(value) {
  return lodash_es_isObjectLike(value) && isArguments_hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

/* harmony default export */ const lodash_es_isArguments = (isArguments);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isArray.js
/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/* harmony default export */ const lodash_es_isArray = (isArray);

;// CONCATENATED MODULE: ./node_modules/lodash-es/stubFalse.js
/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

/* harmony default export */ const lodash_es_stubFalse = (stubFalse);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isBuffer.js



/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? _root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || lodash_es_stubFalse;

/* harmony default export */ const lodash_es_isBuffer = (isBuffer);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_isIndex.js
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

/* harmony default export */ const _isIndex = (isIndex);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isLength.js
/** Used as references for various `Number` constants. */
var isLength_MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= isLength_MAX_SAFE_INTEGER;
}

/* harmony default export */ const lodash_es_isLength = (isLength);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIsTypedArray.js




/** `Object#toString` result references. */
var _baseIsTypedArray_argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    _baseIsTypedArray_funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[_baseIsTypedArray_argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[_baseIsTypedArray_funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return lodash_es_isObjectLike(value) &&
    lodash_es_isLength(value.length) && !!typedArrayTags[_baseGetTag(value)];
}

/* harmony default export */ const _baseIsTypedArray = (baseIsTypedArray);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseUnary.js
/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/* harmony default export */ const _baseUnary = (baseUnary);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_nodeUtil.js


/** Detect free variable `exports`. */
var _nodeUtil_freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var _nodeUtil_freeModule = _nodeUtil_freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var _nodeUtil_moduleExports = _nodeUtil_freeModule && _nodeUtil_freeModule.exports === _nodeUtil_freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = _nodeUtil_moduleExports && _freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = _nodeUtil_freeModule && _nodeUtil_freeModule.require && _nodeUtil_freeModule.require('util').types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

/* harmony default export */ const _nodeUtil = (nodeUtil);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isTypedArray.js




/* Node.js helper references. */
var nodeIsTypedArray = _nodeUtil && _nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? _baseUnary(nodeIsTypedArray) : _baseIsTypedArray;

/* harmony default export */ const lodash_es_isTypedArray = (isTypedArray);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_arrayLikeKeys.js







/** Used for built-in method references. */
var _arrayLikeKeys_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _arrayLikeKeys_hasOwnProperty = _arrayLikeKeys_objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = lodash_es_isArray(value),
      isArg = !isArr && lodash_es_isArguments(value),
      isBuff = !isArr && !isArg && lodash_es_isBuffer(value),
      isType = !isArr && !isArg && !isBuff && lodash_es_isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? _baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || _arrayLikeKeys_hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           _isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

/* harmony default export */ const _arrayLikeKeys = (arrayLikeKeys);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_isPrototype.js
/** Used for built-in method references. */
var _isPrototype_objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || _isPrototype_objectProto;

  return value === proto;
}

/* harmony default export */ const _isPrototype = (isPrototype);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_overArg.js
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/* harmony default export */ const _overArg = (overArg);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_nativeKeys.js


/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = _overArg(Object.keys, Object);

/* harmony default export */ const _nativeKeys = (nativeKeys);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseKeys.js



/** Used for built-in method references. */
var _baseKeys_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _baseKeys_hasOwnProperty = _baseKeys_objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!_isPrototype(object)) {
    return _nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (_baseKeys_hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/* harmony default export */ const _baseKeys = (baseKeys);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isArrayLike.js



/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && lodash_es_isLength(value.length) && !lodash_es_isFunction(value);
}

/* harmony default export */ const lodash_es_isArrayLike = (isArrayLike);

;// CONCATENATED MODULE: ./node_modules/lodash-es/keys.js




/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return lodash_es_isArrayLike(object) ? _arrayLikeKeys(object) : _baseKeys(object);
}

/* harmony default export */ const lodash_es_keys = (keys);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseForOwn.js



/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && _baseFor(object, iteratee, lodash_es_keys);
}

/* harmony default export */ const _baseForOwn = (baseForOwn);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_listCacheClear.js
/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

/* harmony default export */ const _listCacheClear = (listCacheClear);

;// CONCATENATED MODULE: ./node_modules/lodash-es/eq.js
/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/* harmony default export */ const lodash_es_eq = (eq);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_assocIndexOf.js


/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (lodash_es_eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/* harmony default export */ const _assocIndexOf = (assocIndexOf);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_listCacheDelete.js


/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = _assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

/* harmony default export */ const _listCacheDelete = (listCacheDelete);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_listCacheGet.js


/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = _assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/* harmony default export */ const _listCacheGet = (listCacheGet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_listCacheHas.js


/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return _assocIndexOf(this.__data__, key) > -1;
}

/* harmony default export */ const _listCacheHas = (listCacheHas);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_listCacheSet.js


/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = _assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

/* harmony default export */ const _listCacheSet = (listCacheSet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_ListCache.js






/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = _listCacheClear;
ListCache.prototype['delete'] = _listCacheDelete;
ListCache.prototype.get = _listCacheGet;
ListCache.prototype.has = _listCacheHas;
ListCache.prototype.set = _listCacheSet;

/* harmony default export */ const _ListCache = (ListCache);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_stackClear.js


/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new _ListCache;
  this.size = 0;
}

/* harmony default export */ const _stackClear = (stackClear);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_stackDelete.js
/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

/* harmony default export */ const _stackDelete = (stackDelete);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_stackGet.js
/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/* harmony default export */ const _stackGet = (stackGet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_stackHas.js
/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/* harmony default export */ const _stackHas = (stackHas);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Map.js



/* Built-in method references that are verified to be native. */
var _Map_Map = _getNative(_root, 'Map');

/* harmony default export */ const _Map = (_Map_Map);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_nativeCreate.js


/* Built-in method references that are verified to be native. */
var nativeCreate = _getNative(Object, 'create');

/* harmony default export */ const _nativeCreate = (nativeCreate);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_hashClear.js


/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = _nativeCreate ? _nativeCreate(null) : {};
  this.size = 0;
}

/* harmony default export */ const _hashClear = (hashClear);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_hashDelete.js
/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

/* harmony default export */ const _hashDelete = (hashDelete);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_hashGet.js


/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var _hashGet_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _hashGet_hasOwnProperty = _hashGet_objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (_nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return _hashGet_hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/* harmony default export */ const _hashGet = (hashGet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_hashHas.js


/** Used for built-in method references. */
var _hashHas_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _hashHas_hasOwnProperty = _hashHas_objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return _nativeCreate ? (data[key] !== undefined) : _hashHas_hasOwnProperty.call(data, key);
}

/* harmony default export */ const _hashHas = (hashHas);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_hashSet.js


/** Used to stand-in for `undefined` hash values. */
var _hashSet_HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (_nativeCreate && value === undefined) ? _hashSet_HASH_UNDEFINED : value;
  return this;
}

/* harmony default export */ const _hashSet = (hashSet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Hash.js






/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = _hashClear;
Hash.prototype['delete'] = _hashDelete;
Hash.prototype.get = _hashGet;
Hash.prototype.has = _hashHas;
Hash.prototype.set = _hashSet;

/* harmony default export */ const _Hash = (Hash);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_mapCacheClear.js




/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new _Hash,
    'map': new (_Map || _ListCache),
    'string': new _Hash
  };
}

/* harmony default export */ const _mapCacheClear = (mapCacheClear);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_isKeyable.js
/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/* harmony default export */ const _isKeyable = (isKeyable);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getMapData.js


/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return _isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/* harmony default export */ const _getMapData = (getMapData);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_mapCacheDelete.js


/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = _getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

/* harmony default export */ const _mapCacheDelete = (mapCacheDelete);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_mapCacheGet.js


/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return _getMapData(this, key).get(key);
}

/* harmony default export */ const _mapCacheGet = (mapCacheGet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_mapCacheHas.js


/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return _getMapData(this, key).has(key);
}

/* harmony default export */ const _mapCacheHas = (mapCacheHas);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_mapCacheSet.js


/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = _getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

/* harmony default export */ const _mapCacheSet = (mapCacheSet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_MapCache.js






/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = _mapCacheClear;
MapCache.prototype['delete'] = _mapCacheDelete;
MapCache.prototype.get = _mapCacheGet;
MapCache.prototype.has = _mapCacheHas;
MapCache.prototype.set = _mapCacheSet;

/* harmony default export */ const _MapCache = (MapCache);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_stackSet.js




/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof _ListCache) {
    var pairs = data.__data__;
    if (!_Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new _MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

/* harmony default export */ const _stackSet = (stackSet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Stack.js







/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new _ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = _stackClear;
Stack.prototype['delete'] = _stackDelete;
Stack.prototype.get = _stackGet;
Stack.prototype.has = _stackHas;
Stack.prototype.set = _stackSet;

/* harmony default export */ const _Stack = (Stack);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_setCacheAdd.js
/** Used to stand-in for `undefined` hash values. */
var _setCacheAdd_HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, _setCacheAdd_HASH_UNDEFINED);
  return this;
}

/* harmony default export */ const _setCacheAdd = (setCacheAdd);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_setCacheHas.js
/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

/* harmony default export */ const _setCacheHas = (setCacheHas);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_SetCache.js




/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new _MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = _setCacheAdd;
SetCache.prototype.has = _setCacheHas;

/* harmony default export */ const _SetCache = (SetCache);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_arraySome.js
/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/* harmony default export */ const _arraySome = (arraySome);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_cacheHas.js
/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

/* harmony default export */ const _cacheHas = (cacheHas);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_equalArrays.js




/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Check that cyclic values are equal.
  var arrStacked = stack.get(array);
  var othStacked = stack.get(other);
  if (arrStacked && othStacked) {
    return arrStacked == other && othStacked == array;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new _SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!_arraySome(other, function(othValue, othIndex) {
            if (!_cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

/* harmony default export */ const _equalArrays = (equalArrays);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Uint8Array.js


/** Built-in value references. */
var Uint8Array = _root.Uint8Array;

/* harmony default export */ const _Uint8Array = (Uint8Array);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_mapToArray.js
/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/* harmony default export */ const _mapToArray = (mapToArray);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_setToArray.js
/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/* harmony default export */ const _setToArray = (setToArray);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_equalByTag.js







/** Used to compose bitmasks for value comparisons. */
var _equalByTag_COMPARE_PARTIAL_FLAG = 1,
    _equalByTag_COMPARE_UNORDERED_FLAG = 2;

/** `Object#toString` result references. */
var _equalByTag_boolTag = '[object Boolean]',
    _equalByTag_dateTag = '[object Date]',
    _equalByTag_errorTag = '[object Error]',
    _equalByTag_mapTag = '[object Map]',
    _equalByTag_numberTag = '[object Number]',
    _equalByTag_regexpTag = '[object RegExp]',
    _equalByTag_setTag = '[object Set]',
    _equalByTag_stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var _equalByTag_arrayBufferTag = '[object ArrayBuffer]',
    _equalByTag_dataViewTag = '[object DataView]';

/** Used to convert symbols to primitives and strings. */
var symbolProto = _Symbol ? _Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case _equalByTag_dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case _equalByTag_arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new _Uint8Array(object), new _Uint8Array(other))) {
        return false;
      }
      return true;

    case _equalByTag_boolTag:
    case _equalByTag_dateTag:
    case _equalByTag_numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return lodash_es_eq(+object, +other);

    case _equalByTag_errorTag:
      return object.name == other.name && object.message == other.message;

    case _equalByTag_regexpTag:
    case _equalByTag_stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case _equalByTag_mapTag:
      var convert = _mapToArray;

    case _equalByTag_setTag:
      var isPartial = bitmask & _equalByTag_COMPARE_PARTIAL_FLAG;
      convert || (convert = _setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= _equalByTag_COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = _equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

/* harmony default export */ const _equalByTag = (equalByTag);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_arrayPush.js
/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/* harmony default export */ const _arrayPush = (arrayPush);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseGetAllKeys.js



/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return lodash_es_isArray(object) ? result : _arrayPush(result, symbolsFunc(object));
}

/* harmony default export */ const _baseGetAllKeys = (baseGetAllKeys);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_arrayFilter.js
/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

/* harmony default export */ const _arrayFilter = (arrayFilter);

;// CONCATENATED MODULE: ./node_modules/lodash-es/stubArray.js
/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

/* harmony default export */ const lodash_es_stubArray = (stubArray);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getSymbols.js



/** Used for built-in method references. */
var _getSymbols_objectProto = Object.prototype;

/** Built-in value references. */
var _getSymbols_propertyIsEnumerable = _getSymbols_objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? lodash_es_stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return _arrayFilter(nativeGetSymbols(object), function(symbol) {
    return _getSymbols_propertyIsEnumerable.call(object, symbol);
  });
};

/* harmony default export */ const _getSymbols = (getSymbols);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getAllKeys.js




/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return _baseGetAllKeys(object, lodash_es_keys, _getSymbols);
}

/* harmony default export */ const _getAllKeys = (getAllKeys);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_equalObjects.js


/** Used to compose bitmasks for value comparisons. */
var _equalObjects_COMPARE_PARTIAL_FLAG = 1;

/** Used for built-in method references. */
var _equalObjects_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _equalObjects_hasOwnProperty = _equalObjects_objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & _equalObjects_COMPARE_PARTIAL_FLAG,
      objProps = _getAllKeys(object),
      objLength = objProps.length,
      othProps = _getAllKeys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : _equalObjects_hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Check that cyclic values are equal.
  var objStacked = stack.get(object);
  var othStacked = stack.get(other);
  if (objStacked && othStacked) {
    return objStacked == other && othStacked == object;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

/* harmony default export */ const _equalObjects = (equalObjects);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_DataView.js



/* Built-in method references that are verified to be native. */
var DataView = _getNative(_root, 'DataView');

/* harmony default export */ const _DataView = (DataView);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Promise.js



/* Built-in method references that are verified to be native. */
var _Promise_Promise = _getNative(_root, 'Promise');

/* harmony default export */ const _Promise = (_Promise_Promise);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_Set.js



/* Built-in method references that are verified to be native. */
var Set = _getNative(_root, 'Set');

/* harmony default export */ const _Set = (Set);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_WeakMap.js



/* Built-in method references that are verified to be native. */
var WeakMap = _getNative(_root, 'WeakMap');

/* harmony default export */ const _WeakMap = (WeakMap);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getTag.js








/** `Object#toString` result references. */
var _getTag_mapTag = '[object Map]',
    _getTag_objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    _getTag_setTag = '[object Set]',
    _getTag_weakMapTag = '[object WeakMap]';

var _getTag_dataViewTag = '[object DataView]';

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = _toSource(_DataView),
    mapCtorString = _toSource(_Map),
    promiseCtorString = _toSource(_Promise),
    setCtorString = _toSource(_Set),
    weakMapCtorString = _toSource(_WeakMap);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = _baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((_DataView && getTag(new _DataView(new ArrayBuffer(1))) != _getTag_dataViewTag) ||
    (_Map && getTag(new _Map) != _getTag_mapTag) ||
    (_Promise && getTag(_Promise.resolve()) != promiseTag) ||
    (_Set && getTag(new _Set) != _getTag_setTag) ||
    (_WeakMap && getTag(new _WeakMap) != _getTag_weakMapTag)) {
  getTag = function(value) {
    var result = _baseGetTag(value),
        Ctor = result == _getTag_objectTag ? value.constructor : undefined,
        ctorString = Ctor ? _toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return _getTag_dataViewTag;
        case mapCtorString: return _getTag_mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return _getTag_setTag;
        case weakMapCtorString: return _getTag_weakMapTag;
      }
    }
    return result;
  };
}

/* harmony default export */ const _getTag = (getTag);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIsEqualDeep.js









/** Used to compose bitmasks for value comparisons. */
var _baseIsEqualDeep_COMPARE_PARTIAL_FLAG = 1;

/** `Object#toString` result references. */
var _baseIsEqualDeep_argsTag = '[object Arguments]',
    _baseIsEqualDeep_arrayTag = '[object Array]',
    _baseIsEqualDeep_objectTag = '[object Object]';

/** Used for built-in method references. */
var _baseIsEqualDeep_objectProto = Object.prototype;

/** Used to check objects for own properties. */
var _baseIsEqualDeep_hasOwnProperty = _baseIsEqualDeep_objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = lodash_es_isArray(object),
      othIsArr = lodash_es_isArray(other),
      objTag = objIsArr ? _baseIsEqualDeep_arrayTag : _getTag(object),
      othTag = othIsArr ? _baseIsEqualDeep_arrayTag : _getTag(other);

  objTag = objTag == _baseIsEqualDeep_argsTag ? _baseIsEqualDeep_objectTag : objTag;
  othTag = othTag == _baseIsEqualDeep_argsTag ? _baseIsEqualDeep_objectTag : othTag;

  var objIsObj = objTag == _baseIsEqualDeep_objectTag,
      othIsObj = othTag == _baseIsEqualDeep_objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && lodash_es_isBuffer(object)) {
    if (!lodash_es_isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new _Stack);
    return (objIsArr || lodash_es_isTypedArray(object))
      ? _equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : _equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & _baseIsEqualDeep_COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && _baseIsEqualDeep_hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && _baseIsEqualDeep_hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new _Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new _Stack);
  return _equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

/* harmony default export */ const _baseIsEqualDeep = (baseIsEqualDeep);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIsEqual.js



/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!lodash_es_isObjectLike(value) && !lodash_es_isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return _baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

/* harmony default export */ const _baseIsEqual = (baseIsEqual);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIsMatch.js



/** Used to compose bitmasks for value comparisons. */
var _baseIsMatch_COMPARE_PARTIAL_FLAG = 1,
    _baseIsMatch_COMPARE_UNORDERED_FLAG = 2;

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new _Stack;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined
            ? _baseIsEqual(srcValue, objValue, _baseIsMatch_COMPARE_PARTIAL_FLAG | _baseIsMatch_COMPARE_UNORDERED_FLAG, customizer, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

/* harmony default export */ const _baseIsMatch = (baseIsMatch);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_isStrictComparable.js


/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !lodash_es_isObject(value);
}

/* harmony default export */ const _isStrictComparable = (isStrictComparable);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_getMatchData.js



/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = lodash_es_keys(object),
      length = result.length;

  while (length--) {
    var key = result[length],
        value = object[key];

    result[length] = [key, value, _isStrictComparable(value)];
  }
  return result;
}

/* harmony default export */ const _getMatchData = (getMatchData);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_matchesStrictComparable.js
/**
 * A specialized version of `matchesProperty` for source values suitable
 * for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue &&
      (srcValue !== undefined || (key in Object(object)));
  };
}

/* harmony default export */ const _matchesStrictComparable = (matchesStrictComparable);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseMatches.js




/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatches(source) {
  var matchData = _getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return _matchesStrictComparable(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || _baseIsMatch(object, source, matchData);
  };
}

/* harmony default export */ const _baseMatches = (baseMatches);

;// CONCATENATED MODULE: ./node_modules/lodash-es/isSymbol.js



/** `Object#toString` result references. */
var isSymbol_symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (lodash_es_isObjectLike(value) && _baseGetTag(value) == isSymbol_symbolTag);
}

/* harmony default export */ const lodash_es_isSymbol = (isSymbol);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_isKey.js



/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (lodash_es_isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || lodash_es_isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

/* harmony default export */ const _isKey = (isKey);

;// CONCATENATED MODULE: ./node_modules/lodash-es/memoize.js


/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || _MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = _MapCache;

/* harmony default export */ const lodash_es_memoize = (memoize);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_memoizeCapped.js


/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
function memoizeCapped(func) {
  var result = lodash_es_memoize(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });

  var cache = result.cache;
  return result;
}

/* harmony default export */ const _memoizeCapped = (memoizeCapped);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_stringToPath.js


/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = _memoizeCapped(function(string) {
  var result = [];
  if (string.charCodeAt(0) === 46 /* . */) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, subString) {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

/* harmony default export */ const _stringToPath = (stringToPath);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_arrayMap.js
/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/* harmony default export */ const _arrayMap = (arrayMap);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseToString.js





/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var _baseToString_symbolProto = _Symbol ? _Symbol.prototype : undefined,
    symbolToString = _baseToString_symbolProto ? _baseToString_symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (lodash_es_isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return _arrayMap(value, baseToString) + '';
  }
  if (lodash_es_isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/* harmony default export */ const _baseToString = (baseToString);

;// CONCATENATED MODULE: ./node_modules/lodash-es/toString.js


/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString_toString(value) {
  return value == null ? '' : _baseToString(value);
}

/* harmony default export */ const lodash_es_toString = (toString_toString);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_castPath.js





/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @param {Object} [object] The object to query keys on.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value, object) {
  if (lodash_es_isArray(value)) {
    return value;
  }
  return _isKey(value, object) ? [value] : _stringToPath(lodash_es_toString(value));
}

/* harmony default export */ const _castPath = (castPath);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_toKey.js


/** Used as references for various `Number` constants. */
var _toKey_INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || lodash_es_isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -_toKey_INFINITY) ? '-0' : result;
}

/* harmony default export */ const _toKey = (toKey);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseGet.js



/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = _castPath(path, object);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[_toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

/* harmony default export */ const _baseGet = (baseGet);

;// CONCATENATED MODULE: ./node_modules/lodash-es/get.js


/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : _baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

/* harmony default export */ const lodash_es_get = (get);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseHasIn.js
/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}

/* harmony default export */ const _baseHasIn = (baseHasIn);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_hasPath.js







/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  path = _castPath(path, object);

  var index = -1,
      length = path.length,
      result = false;

  while (++index < length) {
    var key = _toKey(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result || ++index != length) {
    return result;
  }
  length = object == null ? 0 : object.length;
  return !!length && lodash_es_isLength(length) && _isIndex(key, length) &&
    (lodash_es_isArray(object) || lodash_es_isArguments(object));
}

/* harmony default export */ const _hasPath = (hasPath);

;// CONCATENATED MODULE: ./node_modules/lodash-es/hasIn.js



/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': 2 }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b');
 * // => true
 *
 * _.hasIn(object, ['a', 'b']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return object != null && _hasPath(object, path, _baseHasIn);
}

/* harmony default export */ const lodash_es_hasIn = (hasIn);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseMatchesProperty.js








/** Used to compose bitmasks for value comparisons. */
var _baseMatchesProperty_COMPARE_PARTIAL_FLAG = 1,
    _baseMatchesProperty_COMPARE_UNORDERED_FLAG = 2;

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatchesProperty(path, srcValue) {
  if (_isKey(path) && _isStrictComparable(srcValue)) {
    return _matchesStrictComparable(_toKey(path), srcValue);
  }
  return function(object) {
    var objValue = lodash_es_get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? lodash_es_hasIn(object, path)
      : _baseIsEqual(srcValue, objValue, _baseMatchesProperty_COMPARE_PARTIAL_FLAG | _baseMatchesProperty_COMPARE_UNORDERED_FLAG);
  };
}

/* harmony default export */ const _baseMatchesProperty = (baseMatchesProperty);

;// CONCATENATED MODULE: ./node_modules/lodash-es/identity.js
/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

/* harmony default export */ const lodash_es_identity = (identity);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseProperty.js
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/* harmony default export */ const _baseProperty = (baseProperty);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_basePropertyDeep.js


/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return _baseGet(object, path);
  };
}

/* harmony default export */ const _basePropertyDeep = (basePropertyDeep);

;// CONCATENATED MODULE: ./node_modules/lodash-es/property.js





/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': 2 } },
 *   { 'a': { 'b': 1 } }
 * ];
 *
 * _.map(objects, _.property('a.b'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
 * // => [1, 2]
 */
function property(path) {
  return _isKey(path) ? _baseProperty(_toKey(path)) : _basePropertyDeep(path);
}

/* harmony default export */ const lodash_es_property = (property);

;// CONCATENATED MODULE: ./node_modules/lodash-es/_baseIteratee.js






/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
  // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
  if (typeof value == 'function') {
    return value;
  }
  if (value == null) {
    return lodash_es_identity;
  }
  if (typeof value == 'object') {
    return lodash_es_isArray(value)
      ? _baseMatchesProperty(value[0], value[1])
      : _baseMatches(value);
  }
  return lodash_es_property(value);
}

/* harmony default export */ const _baseIteratee = (baseIteratee);

;// CONCATENATED MODULE: ./node_modules/lodash-es/mapValues.js




/**
 * Creates an object with the same keys as `object` and values generated
 * by running each own enumerable string keyed property of `object` thru
 * `iteratee`. The iteratee is invoked with three arguments:
 * (value, key, object).
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Object
 * @param {Object} object The object to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Object} Returns the new mapped object.
 * @see _.mapKeys
 * @example
 *
 * var users = {
 *   'fred':    { 'user': 'fred',    'age': 40 },
 *   'pebbles': { 'user': 'pebbles', 'age': 1 }
 * };
 *
 * _.mapValues(users, function(o) { return o.age; });
 * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
 *
 * // The `_.property` iteratee shorthand.
 * _.mapValues(users, 'age');
 * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
 */
function mapValues(object, iteratee) {
  var result = {};
  iteratee = _baseIteratee(iteratee, 3);

  _baseForOwn(object, function(value, key, object) {
    _baseAssignValue(result, key, iteratee(value, key, object));
  });
  return result;
}

/* harmony default export */ const lodash_es_mapValues = (mapValues);

;// CONCATENATED MODULE: ./src/polyfill.ts

const { Variant } = imports.gi.GLib;
function initPolyfills() {
    // included in LM 20.2 (cinnamon 5.0.4) but not in LM 20.0 (cinnamon 4.6.7). (20.1 not tested)
    // Copied from https://stackoverflow.com/a/17606289/11603006
    if (!String.prototype.hasOwnProperty('replaceAll')) {
        String.prototype.replaceAll = function (search, replacement) {
            var target = this;
            return target.split(search).join(replacement);
        };
    }
    // @ts-ignore
    if (!Array.prototype.flat) {
        Object.defineProperty(Array.prototype, 'flat', {
            configurable: true,
            writable: true,
            value: function () {
                var depth = typeof arguments[0] === 'undefined' ? 1 : Number(arguments[0]) || 0;
                var result = [];
                var forEach = result.forEach;
                var flatDeep = function (arr, depth) {
                    forEach.call(arr, function (val) {
                        if (depth > 0 && Array.isArray(val)) {
                            flatDeep(val, depth - 1);
                        }
                        else {
                            result.push(val);
                        }
                    });
                };
                flatDeep(this, depth);
                return result;
            },
        });
    }
    // Copied from https://github.com/behnammodi/polyfill/blob/master/array.polyfill.js
    // included in LM 20.1 (cinnamon 4.8) but not in LM 20.0 (cinnamon 4.6.7)
    if (!Array.prototype.flatMap) {
        Object.defineProperty(Array.prototype, 'flatMap', {
            configurable: true,
            writable: true,
            value: function () {
                return Array.prototype.map.apply(this, arguments).flat(1);
            },
        });
    }
    // included in LM 20.1 (cinnamon 4.8) but not in LM 20.0 (cinnamon 4.6.7)
    Variant.prototype.deepUnpack = Variant.prototype.deep_unpack;
    // // included in LM 20.1 (cinnamon 4.8) but not in LM 20.0 (cinnamon 4.6.7)
    // // TODO: write unit test. Are arrays handled correct??
    if (!Variant.prototype.recursiveUnpack) {
        Variant.prototype.recursiveUnpack = function () {
            function recursiveUnpackKey(key) {
                if (key instanceof Variant) {
                    const deepUnpackedVal = key.deep_unpack();
                    return deepUnpackedVal instanceof Variant
                        ? deepUnpackedVal.recursiveUnpack() : deepUnpackedVal;
                }
                return key;
            }
            const deepUnpackedVal = this.deep_unpack();
            return lodash_es_isObject(deepUnpackedVal) ? lodash_es_mapValues(deepUnpackedVal, recursiveUnpackKey) : deepUnpackedVal;
        };
    }
}

;// CONCATENATED MODULE: ./src/index.ts



























const { ScrollDirection: src_ScrollDirection } = imports.gi.Clutter;
const { getAppletDefinition } = imports.ui.appletManager;
const { panelManager } = imports.ui.main;
const { BoxLayout: src_BoxLayout } = imports.gi.St;
function main(args) {
    const { orientation, panelHeight, instanceId } = args;
    initPolyfills();
    // this is a workaround for now. Optimally the lastVolume should be saved persistently each time the volume is changed but this lead to significant performance issue on scrolling at the moment. However this shouldn't be the case as it is no problem to log the volume each time the volume changes (so it is a problem in the config implementation). As a workaround the volume is only saved persistently when the radio stops but the volume obviously can't be received anymore from dbus when the player has been already stopped ... 
    let lastVolume;
    let mpvHandler;
    let installationInProgress = false;
    const appletDefinition = getAppletDefinition({
        applet_id: instanceId,
    });
    const panel = panelManager.panels.find(panel => (panel === null || panel === void 0 ? void 0 : panel.panelId) === appletDefinition.panelId);
    panel.connect('icon-size-changed', () => appletIcon.updateIconSize());
    const appletIcon = createAppletIcon({
        locationLabel: appletDefinition.location_label,
        panel
    });
    const appletLabel = createAppletLabel();
    const applet = createApplet({
        icon: appletIcon.actor,
        label: appletLabel.actor,
        instanceId,
        orientation,
        panelHeight,
        onClick: handleAppletClicked,
        onScroll: handleScroll,
        onMiddleClick: () => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.togglePlayPause(),
        onAppletMoved: () => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.deactivateAllListener(),
        onAppletRemoved: handleAppletRemoved,
        onRightClick: () => popupMenu === null || popupMenu === void 0 ? void 0 : popupMenu.close()
    });
    const appletTooltip = createAppletTooltip({
        applet,
        orientation
    });
    const configs = createConfig({
        uuid: __meta.uuid,
        instanceId,
        onIconChanged: handleIconTypeChanged,
        onIconColorPlayingChanged: (color) => {
            appletIcon.setColorWhenPlaying(color);
        },
        onIconColorPausedChanged: (color) => {
            appletIcon.setColorWhenPaused(color);
        },
        onChannelOnPanelChanged: (channelOnPanel) => {
            appletLabel.setVisibility(channelOnPanel);
        },
        onMyStationsChanged: handleStationsUpdated,
    });
    const channelStore = new ChannelStore(configs.userStations);
    const channelList = createChannelList({
        stationNames: channelStore.activatedChannelNames,
        onChannelClicked: handleChannelClicked
    });
    const volumeSlider = createVolumeSlider({
        onVolumeChanged: (volume) => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.setVolume(volume)
    });
    const popupMenu = (0,cinnamonpopup/* createPopupMenu */.S)({ launcher: applet.actor });
    const infoSection = createInfoSection();
    //toolbar
    const playPauseBtn = createPlayPauseButton({
        onClick: () => mpvHandler.togglePlayPause()
    });
    const stopBtn = createStopBtn({
        onClick: () => mpvHandler.stop()
    });
    const downloadBtn = createDownloadButton({
        onClick: handleDownloadBtnClicked
    });
    const copyBtn = createCopyButton({
        onClick: () => copyText(mpvHandler.getCurrentTitle())
    });
    const mediaControlToolbar = createMediaControlToolbar({
        controlBtns: [playPauseBtn.actor, downloadBtn.actor, copyBtn.actor, stopBtn.actor]
    });
    const seeker = createSeeker({
        onPositionChanged: (value) => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.setPosition(value)
    });
    const radioActiveSection = new src_BoxLayout({
        vertical: true,
        visible: false
    });
    [
        infoSection.actor,
        mediaControlToolbar,
        volumeSlider.actor,
        seeker.actor
    ].forEach(widget => {
        radioActiveSection.add_child(createSeparatorMenuItem());
        radioActiveSection.add_child(widget);
    });
    popupMenu.add_child(channelList.actor);
    popupMenu.add_child(radioActiveSection);
    mpvHandler = createMpvHandler({
        getInitialVolume: () => { return configs.initialVolume; },
        onVolumeChanged: handleVolumeChanged,
        onLengthChanged: hanldeLengthChanged,
        onPositionChanged: handlePositionChanged,
        checkUrlValid: (url) => channelStore.checkUrlValid(url),
        onTitleChanged: handleTitleChanged,
        onPlaybackstatusChanged: handlePlaybackstatusChanged,
        lastUrl: configs.lastUrl,
        onUrlChanged: handleUrlChanged
    });
    // CALLBACKS
    async function handleAppletClicked() {
        if (installationInProgress)
            return;
        try {
            installationInProgress = true;
            await installMpvWithMpris();
            popupMenu.toggle();
        }
        catch (error) {
            const notificationText = "Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.";
            notify({ text: notificationText });
            global.logError(error);
        }
        finally {
            installationInProgress = false;
        }
    }
    function handleAppletRemoved() {
        mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.deactivateAllListener();
        mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.stop();
    }
    function handleScroll(scrollDirection) {
        const volumeChange = scrollDirection === src_ScrollDirection.UP ? VOLUME_DELTA : -VOLUME_DELTA;
        mpvHandler.increaseDecreaseVolume(volumeChange);
    }
    function handleChannelClicked(name) {
        const channelUrl = channelStore.getChannelUrl(name);
        mpvHandler.setUrl(channelUrl);
    }
    function handleTitleChanged(title) {
        infoSection.setSongTitle(title);
    }
    function handleVolumeChanged(volume) {
        volumeSlider.setVolume(volume);
        appletTooltip.setVolume(volume);
        lastVolume = volume;
    }
    function handleIconTypeChanged(iconType) {
        appletIcon.setIconType(iconType);
    }
    function handleStationsUpdated(stations) {
        const stationsChanged = channelStore.checkListChanged(stations);
        if (!stationsChanged)
            return;
        channelStore.channelList = stations;
        channelList.setStationNames(channelStore.activatedChannelNames);
        const lastUrlValid = channelStore.checkUrlValid(configs.lastUrl);
        if (!lastUrlValid)
            mpvHandler.stop();
    }
    function handlePlaybackstatusChanged(playbackstatus) {
        if (playbackstatus === 'Stopped') {
            radioActiveSection.hide();
            configs.lastVolume = lastVolume;
            configs.lastUrl = null;
            appletLabel.setText(null);
            appletTooltip.setDefaultTooltip();
            popupMenu.close();
        }
        if (playbackstatus !== 'Stopped' && !radioActiveSection.visible)
            radioActiveSection.show();
        channelList.setPlaybackStatus(playbackstatus);
        appletIcon.setPlaybackStatus(playbackstatus);
        if (playbackstatus === 'Playing' || playbackstatus === 'Paused') {
            playPauseBtn.setPlaybackStatus(playbackstatus);
        }
    }
    function handleUrlChanged(url) {
        const channelName = url ? channelStore.getChannelName(url) : null;
        appletLabel.setText(channelName);
        channelList.setCurrentChannel(channelName);
        infoSection.setChannel(channelName);
        configs.lastUrl = url;
    }
    function hanldeLengthChanged(length) {
        seeker.setLength(length);
    }
    function handlePositionChanged(position) {
        seeker === null || seeker === void 0 ? void 0 : seeker.setPosition(position);
    }
    function handleDownloadBtnClicked() {
        const title = mpvHandler.getCurrentTitle();
        const downloadProcess = downloadSongFromYoutube({
            downloadDir: configs.musicDownloadDir,
            title,
            onDownloadFinished: (path) => notifyYoutubeDownloadFinished({
                downloadPath: path
            }),
            onDownloadFailed: notifyYoutubeDownloadFailed
        });
        notifyYoutubeDownloadStarted({
            title,
            onCancelClicked: () => downloadProcess.cancel()
        });
    }
    return applet;
}

})();

radioApplet = __webpack_exports__;
/******/ })()
;