import { createConfig } from "Config";
import { ChannelStore } from "ChannelStore";
import { createChannelList } from "ui/ChannelList";
import { Channel, PlaybackStatus } from "types";
import { createRadioApplet } from "ui/RadioApplet";
import { createMpvHandler, MpvHandler } from "mpv/MpvHandler";
import { VolumeSlider } from "ui/VolumeSlider";
import { createRadioPopupMenu } from "ui/RadioPopupMenu";
import { createMediaControlToolbar } from "ui/MediaControlToolbar";
import { createPlayPauseButton, PlayPauseButton } from "ui/PlayPauseButton";
import { createStopBtn } from "ui/StopButton";
import { createSongInfoItem, SongInfoItem } from "ui/SongInfoItem";
import { ChannelInfoItem, createChannelInfoItem } from "ui/ChannelInfoItem";
import { createDownloadButton } from "ui/DownloadButton";
import { createCopyButton } from "ui/CopyButton";
import { downloadSongFromYoutube } from "functions/downloadFromYoutube";
import { notifySend } from "functions/notify";
import { checkInstallMpv, checkInstallMrisPlugin } from "mpv/CheckInstallation";
import { copyText } from "functions/copyText";

const { ScrollDirection } = imports.gi.Clutter;

let mpvHandler: MpvHandler


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
) {

	const configs = createConfig({
		uuid: __meta.uuid,
		instanceId,

		onIconChanged: (iconType) => {
			radioApplet.updateState({ iconType })
		},
		onIconColorChanged: (color) => {
			radioApplet.updateState({ colorWhenPlaying: color })
		},
		onChannelOnPanelChanged: (channelOnPanel) => {
			radioApplet.updateState({ channelOnPanel })
		},
		onMyStationsChanged: handleStationsUpdated,
	})

	const radioApplet = createRadioApplet({
		iconType: configs.iconType,
		colorWhenPlaying: configs.symbolicIconColorWhenPlaying,
		channelOnPanel: configs.channelNameOnPanel,
		orientation,
		panelHeight,
		instanceId,
		onAppletClick: handleAppletClicked,
		onScroll: handleScroll,
		onAppletMiddleClick: () => mpvHandler.togglePlayPause(),
		onAppletRemovedFromPanel: () => mpvHandler.stop()
	})

	const channelStore = new ChannelStore(configs.userStations)

	const channelList = createChannelList({
		stationNames: channelStore.activatedChannelNames,
		onChannelClicked: handleChannelClicked
	})

	const volumeSlider = new VolumeSlider({
		onValueChanged: (volume: number) => mpvHandler.volume = volume
	})

	// toolbar
	const songInfoItem = createSongInfoItem() as SongInfoItem

	const channelInfoItem = createChannelInfoItem() as ChannelInfoItem

	const playPauseBtn = createPlayPauseButton({
		onClick: () => mpvHandler.togglePlayPause()
	}) as PlayPauseButton

	const stopBtn = createStopBtn({
		onClick: () => mpvHandler.stop()
	})

	const downloadBtn = createDownloadButton({
		onClick: () => downloadSongFromYoutube(mpvHandler.currentTitle, configs.musicDownloadDir)
	})

	const copyBtn = createCopyButton({
		onClick: () => copyText(mpvHandler.currentTitle)
	})

	const mediaControlToolbar = createMediaControlToolbar({
		controlBtns: [playPauseBtn, downloadBtn, copyBtn, stopBtn]
	})

	const popupMenu = createRadioPopupMenu({
		radioApplet,
		orientation,
		channelList,
		volumeSlider,
		songInfoItem,
		channelInfoItem,
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
			notifySend("couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.")
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
		// it is assumed that when the
		const url = configs.lastUrl

		if (playbackStatus === 'Stopped' || !url) {
			return
		}
		popupMenu.running = true
		const channelName = channelStore.getChannelName(url)

		playPauseBtn.playPause = playbackStatus

		volumeSlider.value = volume

		radioApplet.updateState({ playbackStatus, channelName, volume })
		channelList.updateState({ channelName, playbackStatus })
		channelInfoItem.channel = channelName

		return url // returning url to ensure that not also onStarted is called
	}

	function handleRadioStarted(volume: number, url: string,) {

		popupMenu.running = true

		const channelName = channelStore.getChannelName(url)
		const playbackStatus: PlaybackStatus = "Playing"

		volumeSlider.value = volume
		configs.lastUrl = url
		radioApplet.updateState({ channelName, playbackStatus, volume })
		channelList.updateState({ channelName, playbackStatus })
		channelInfoItem.channel = channelName
	}

	function handleChannelClicked(name: string) {
		mpvHandler.channelUrl = channelStore.getChannelUrl(name)
	}

	function handleRadioPaused() {
		playPauseBtn.playPause = "Paused"
		radioApplet.updateState({ playbackStatus: "Paused" })
		channelList.updateState({ playbackStatus: "Paused" })
	}

	function handleRadioResumed() {
		playPauseBtn.playPause = "Playing"
		radioApplet.updateState({ playbackStatus: "Playing" })
		channelList.updateState({ playbackStatus: "Playing" })
	}

	function handleChannelChanged(url: string) {
		const channelName = channelStore.getChannelName(url)
		configs.lastUrl = url
		radioApplet.updateState({ channelName })
		channelList.updateState({ channelName })
		channelInfoItem.channel = channelName
	}

	async function handleRadioStopped(volume: number) {
		radioApplet.updateState({ playbackStatus: "Stopped" });
		channelList.updateState({ playbackStatus: "Stopped" });

		popupMenu.running = false

		configs.lastVolume = volume
	}

	function handleTitleChanged(title: string) {
		songInfoItem.title = title
	}

	function handleVolumeChanged(volume: number) {
		volumeSlider.value = volume
		radioApplet.updateState({ volume })
	}

	function handleStationsUpdated(stations: Channel[]) {

		const stationsChanged = channelStore.checkListChanged(stations)

		if (!stationsChanged) return
		channelStore.channelList = stations
		channelList.updateState(
			{ stationNames: channelStore.activatedChannelNames }
		)

		const lastUrlValid = channelStore.checkUrlValid(configs.lastUrl)
		if (!lastUrlValid) mpvHandler.stop()

	}

	async function initMpvHandler() {
		mpvHandler = await createMpvHandler({
			getInitialVolume: () => { return configs.initialVolume },
			onChannelChanged: handleChannelChanged,
			onInitialized: handleRadioInitialized,
			onStarted: handleRadioStarted,
			onStopped: handleRadioStopped,
			onVolumeChanged: handleVolumeChanged,
			ckeckUrlValid: (url) => channelStore.checkUrlValid(url),
			onPaused: handleRadioPaused,
			onResumed: handleRadioResumed,
			onTitleChanged: handleTitleChanged,
		})
	}

	initMpvHandler()

	return radioApplet
}
