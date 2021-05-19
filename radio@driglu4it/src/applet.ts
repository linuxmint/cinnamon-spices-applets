import { createConfig } from "Config";
import { ChannelStore } from "ChannelStore";
import { createChannelList } from "ui/ChannelList/ChannelList";
import { AdvancedPlaybackStatus, Channel, IconType, PlaybackStatus } from "types";
import { createMpvHandler } from "mpv/MpvHandler";
import { VolumeSlider } from "ui/VolumeSlider";
import { createRadioPopupMenu } from "ui/RadioPopupMenu";
import { createMediaControlToolbar } from "ui/Toolbar/MediaControlToolbar";
import { createPlayPauseButton } from "ui/Toolbar/PlayPauseButton";
import { createStopBtn } from "ui/Toolbar/StopButton";
import { createSongInfoItem } from "ui/InfoSection/SongInfoItem";
import { createChannelInfoItem } from "ui/InfoSection/ChannelInfoItem";
import { createDownloadButton } from "ui/Toolbar/DownloadButton";
import { createCopyButton } from "ui/Toolbar/CopyButton";
import { downloadSongFromYoutube } from "functions/downloadFromYoutube";
import { notifySend } from "functions/notify";
import { checkInstallMpv, checkInstallMrisPlugin } from "mpv/CheckInstallation";
import { copyText } from "functions/copyText";
import { createApplet } from "ui/Applet/Applet";
import { createAppletIcon } from "ui/Applet/AppletIcon";
import { createAppletLabel } from "ui/Applet/AppletLabel";
import { createAppletTooltip } from "ui/Applet/AppletTooltip";

const { ScrollDirection } = imports.gi.Clutter;

const Main = imports.ui.main
const AppletManager = imports.ui.appletManager;

/** 
 * 
 * entry point. Must return the applet. Not allowed to be renamed or to be async. 
 *  * 
 */
function main(
	metadata: any,
	orientation: imports.gi.St.Side,
	panelHeight: number,
	instanceId: number
): imports.ui.applet.Applet {


	// @ts-ignore
	const appletDefinition = AppletManager.getAppletDefinition({
		applet_id: instanceId
	})

	const panel = Main.panelManager.panels.find(panel => panel?.panelId === appletDefinition.panelId)
	// @ts-ignore
	panel.connect('icon-size-changed', () => appletIcon.updateIconSize())

	const appletIcon = createAppletIcon({
		// @ts-ignore
		locationLabel: appletDefinition.location_label,
		panel
	})

	const appletLabel = createAppletLabel()


	const applet = createApplet({
		icon: appletIcon.actor,
		label: appletLabel.actor,
		instanceId,
		orientation,
		panelHeight,
		onClick: handleAppletClicked,
		onScroll: handleScroll,
		onMiddleClick: () => mpvHandler.togglePlayPause(),
		onAppletRemovedFromPanel: () => mpvHandler.stop()
	})

	const appletTooltip = createAppletTooltip({
		applet,
		orientation
	})

	const configs = createConfig({
		uuid: __meta.uuid,
		instanceId,

		onIconChanged: handleIconTypeChanged,
		onIconColorPlayingChanged: (color) => {
			appletIcon.setColorWhenPlaying(color)
		},
		onIconColorPausedChanged: (color) => {
			global.log(`on Icon color pause changed to: ${color}`)
			appletIcon.setColorWhenPaused(color)
		},
		onChannelOnPanelChanged: (channelOnPanel) => {
			appletLabel.setVisibility(channelOnPanel)
		},
		onMyStationsChanged: handleStationsUpdated,
	})

	const channelStore = new ChannelStore(configs.userStations)

	const channelList = createChannelList({
		stationNames: channelStore.activatedChannelNames,
		onChannelClicked: handleChannelClicked
	})

	const volumeSlider = new VolumeSlider({
		onValueChanged: (volume: number) => mpvHandler.setVolume(volume)
	})

	// infoSection
	const songInfoItem = createSongInfoItem()
	const channelInfoItem = createChannelInfoItem()

	// toolbar
	const playPauseBtn = createPlayPauseButton({
		onClick: () => mpvHandler.togglePlayPause()
	})

	const stopBtn = createStopBtn({
		onClick: () => mpvHandler.stop()
	})

	const downloadBtn = createDownloadButton({
		onClick: () => downloadSongFromYoutube(mpvHandler.getCurrentTitle(), configs.musicDownloadDir)
	})

	const copyBtn = createCopyButton({
		onClick: () => copyText(mpvHandler.getCurrentTitle())
	})

	const mediaControlToolbar = createMediaControlToolbar({
		controlBtns: [playPauseBtn.actor, downloadBtn.actor, copyBtn.actor, stopBtn.actor]
	})

	const popupMenu = createRadioPopupMenu({
		radioApplet: applet,
		orientation,
		channelList: channelList.actor,
		volumeSlider,
		songInfoItem: songInfoItem.actor,
		channelInfoItem: channelInfoItem.actor,
		mediaControlToolbar
	})

	async function handleAppletClicked() {

		try {
			// TODO combine both functions two one
			await checkInstallMrisPlugin()
			await checkInstallMpv()
			popupMenu.toggle()
			channelList.open()
		} catch (error) {
			notifySend("Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.")
		}
	}

	function handleScroll(scrollDirection: imports.gi.Clutter.ScrollDirection) {
		const volumeChange =
			scrollDirection === ScrollDirection.UP ? 5 : -5
		mpvHandler.increaseDecreaseVolume(volumeChange)
	}

	function handleRadioInitialized(
		playbackStatus: PlaybackStatus,
		volume: number
	) {

		if (playbackStatus === 'Stopped') {
			return
		}
		popupMenu.radioActive = true

		handlePlaybackstatusChanged(playbackStatus)
		handleVolumeChanged(volume)
		handleUrlChanged(configs.lastUrl)
	}

	function handleChannelClicked(name: string) {
		const channelUrl = channelStore.getChannelUrl(name)
		mpvHandler.setChannelUrl(channelUrl)
	}

	function handleTitleChanged(title: string) {
		songInfoItem.setSongTitle(title)
	}

	function handleVolumeChanged(volume: number) {
		volumeSlider.value = volume
		appletTooltip.setVolume(volume)
	}

	function handleIconTypeChanged(iconType: IconType) {
		appletIcon.setIconType(iconType)
	}

	function handleStationsUpdated(stations: Channel[]) {

		global.log('handleStationsUpated executed')

		const stationsChanged = channelStore.checkListChanged(stations)

		global.log(`stationsChanged: ${stationsChanged}`)

		if (!stationsChanged) return

		channelStore.channelList = stations
		channelList.setStationNames(channelStore.activatedChannelNames)

		const lastUrlValid = channelStore.checkUrlValid(configs.lastUrl)
		if (!lastUrlValid) mpvHandler.stop()
	}

	function handlePlaybackstatusChanged(playbackstatus: AdvancedPlaybackStatus) {

		// TODO: this should be done by mpvHandler and before playbackstatus set 
		if (playbackstatus === 'Stopped') handleVolumeChanged(null)
		if (playbackstatus === 'Stopped') handleUrlChanged(null)

		channelList.setPlaybackstatus(playbackstatus)

		appletIcon.setPlaybackStatus(playbackstatus)

		popupMenu.radioActive = (playbackstatus !== 'Stopped')

		if (playbackstatus === 'Playing' || playbackstatus === 'Paused') {
			playPauseBtn.setPlaybackStatus(playbackstatus)
		}
	}

	function handleUrlChanged(url: string) {

		const channelName = url ? channelStore.getChannelName(url) : null

		appletLabel.setText(channelName)

		channelList.setCurrentChannel(channelName)
		channelInfoItem.setChannel(channelName)
		configs.lastUrl = url
	}

	const mpvHandler = createMpvHandler({
		getInitialVolume: () => { return configs.initialVolume },
		onInitialized: handleRadioInitialized,
		onVolumeChanged: handleVolumeChanged,
		checkUrlValid: (url) => channelStore.checkUrlValid(url),
		onTitleChanged: handleTitleChanged,
		onPlaybackstatusChanged: handlePlaybackstatusChanged,
		initialUrl: configs.lastUrl,
		onUrlChanged: handleUrlChanged
	})



	return applet
}
