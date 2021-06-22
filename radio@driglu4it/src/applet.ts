import { createConfig } from "Config";
import { ChannelStore } from "ChannelStore";
import { createChannelList } from "ui/ChannelList/ChannelList";
import { AdvancedPlaybackStatus, Channel, IconType, PlaybackStatus } from "types";
import { createMpvHandler } from "mpv/MpvHandler";
import { createVolumeSlider } from "ui/VolumeSlider";
import { createPopupMenu } from 'lib/PopupMenu'
import { createSeparatorMenuItem } from 'lib/PopupSeperator'
import { createMediaControlToolbar } from "ui/Toolbar/MediaControlToolbar";
import { createPlayPauseButton } from "ui/Toolbar/PlayPauseButton";
import { createStopBtn } from "ui/Toolbar/StopButton";
import { createInfoSection } from "ui/InfoSection";
import { createDownloadButton } from "ui/Toolbar/DownloadButton";
import { createCopyButton } from "ui/Toolbar/CopyButton";
import { downloadSongFromYoutube } from "functions/downloadFromYoutube";
import { installMpvWithMpris } from "mpv/CheckInstallation";
import { copyText } from "functions/copyText";
import { createApplet } from "ui/Applet/Applet";
import { createAppletIcon } from "ui/Applet/AppletIcon";
import { createAppletLabel } from "ui/Applet/AppletLabel";
import { createAppletTooltip } from "ui/Applet/AppletTooltip";
import { notifyYoutubeDownloadFinished } from "ui/Notifications/YoutubeDownloadFinishedNotification";
import { notifyYoutubeDownloadStarted } from "ui/Notifications/YoutubeDownloadStartedNotification";
import { notifyYoutubeDownloadFailed } from "ui/Notifications/YoutubeDownloadFailedNotification";
import { notify } from "ui/Notifications/GenericNotification";
import { createSeeker } from "ui/Seeker";
import { VOLUME_DELTA } from "consts";

const { ScrollDirection } = imports.gi.Clutter;
const { getAppletDefinition } = imports.ui.appletManager;
const { panelManager } = imports.ui.main
const { IconType, BoxLayout } = imports.gi.St

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

	// this is a workaround for now. Optimally the lastVolume should be saved persistently each time the volume is changed but this lead to significant performance issue on scrolling at the moment. However this shouldn't be the case as it is no problem to log the volume each time the volume changes (so it is a problem in the config implementation). As a workaround the volume is only saved persistently when the radio stops but the volume obviously can't be received anymore from dbus when the player has been already stopped ... 
	let lastVolume: number

	let mpvHandler: ReturnType<typeof createMpvHandler>


	const appletDefinition = getAppletDefinition({
		applet_id: instanceId,
	})

	const panel = panelManager.panels.find(panel =>
		panel?.panelId === appletDefinition.panelId
	)

	panel.connect('icon-size-changed', () => appletIcon.updateIconSize())

	const appletIcon = createAppletIcon({
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
		onMiddleClick: () => mpvHandler?.togglePlayPause(),
		onAppletRemovedFromPanel: () => mpvHandler?.stop(),
		onRightClick: () => popupMenu?.close()
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

	const volumeSlider = createVolumeSlider({
		onVolumeChanged: (volume) => mpvHandler?.setVolume(volume)
	})

	const popupMenu = createPopupMenu({ launcher: applet.actor })
	const infoSection = createInfoSection()

	//toolbar
	const playPauseBtn = createPlayPauseButton({
		onClick: () => mpvHandler.togglePlayPause()
	})

	const stopBtn = createStopBtn({
		onClick: () => mpvHandler.stop()
	})

	const downloadBtn = createDownloadButton({
		onClick: handleDownloadBtnClicked
	})

	const copyBtn = createCopyButton({
		onClick: () => copyText(mpvHandler.getCurrentTitle())
	})

	const mediaControlToolbar = createMediaControlToolbar({
		controlBtns: [playPauseBtn.actor, downloadBtn.actor, copyBtn.actor, stopBtn.actor]
	})

	const seeker = createSeeker({
		onPositionChanged: (value) => mpvHandler?.setPosition(value)
	})

	const radioActiveSection = new BoxLayout({
		vertical: true,
		visible: false
	});

	[
		infoSection.actor,
		mediaControlToolbar,
		volumeSlider.actor,
		seeker.actor
	].forEach(widget => {
		radioActiveSection.add_child(createSeparatorMenuItem())
		radioActiveSection.add_child(widget)
	})

	popupMenu.add_child(channelList.actor)
	popupMenu.add_child(radioActiveSection)

	mpvHandler = createMpvHandler({
		getInitialVolume: () => { return configs.initialVolume },
		onVolumeChanged: handleVolumeChanged,
		onLengthChanged: hanldeLengthChanged,
		onPositionChanged: handlePositionChanged,
		checkUrlValid: (url) => channelStore.checkUrlValid(url),
		onTitleChanged: handleTitleChanged,
		onPlaybackstatusChanged: handlePlaybackstatusChanged,
		lastUrl: configs.lastUrl,
		onUrlChanged: handleUrlChanged
	})


	// CALLBACKS

	async function handleAppletClicked() {
		try {
			await installMpvWithMpris()
			popupMenu.toggle()
		} catch (error) {
			const notificationText = "Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder."
			notify({ text: notificationText })
		}
	}

	function handleScroll(scrollDirection: imports.gi.Clutter.ScrollDirection) {
		const volumeChange =
			scrollDirection === ScrollDirection.UP ? VOLUME_DELTA : -VOLUME_DELTA
		mpvHandler.increaseDecreaseVolume(volumeChange)
	}

	function handleChannelClicked(name: string) {
		const channelUrl = channelStore.getChannelUrl(name)
		mpvHandler.setUrl(channelUrl)
	}

	function handleTitleChanged(title: string) {
		infoSection.setSongTitle(title)
	}

	function handleVolumeChanged(volume: number | null) {
		volumeSlider.setVolume(volume)
		appletTooltip.setVolume(volume)

		lastVolume = volume
	}

	function handleIconTypeChanged(iconType: IconType) {
		appletIcon.setIconType(iconType)
	}

	function handleStationsUpdated(stations: Channel[]) {

		const stationsChanged = channelStore.checkListChanged(stations)

		if (!stationsChanged) return

		channelStore.channelList = stations
		channelList.setStationNames(channelStore.activatedChannelNames)

		const lastUrlValid = channelStore.checkUrlValid(configs.lastUrl)
		if (!lastUrlValid) mpvHandler.stop()
	}

	function handlePlaybackstatusChanged(playbackstatus: AdvancedPlaybackStatus) {

		if (playbackstatus === 'Stopped') {
			radioActiveSection.hide()
			configs.lastVolume = lastVolume
			configs.lastUrl = null
			appletLabel.setText(null)
			handleVolumeChanged(null)
			popupMenu.close()
		}

		if (playbackstatus !== 'Stopped' && !radioActiveSection.visible)
			radioActiveSection.show()

		channelList.setPlaybackStatus(playbackstatus)
		appletIcon.setPlaybackStatus(playbackstatus)

		if (playbackstatus === 'Playing' || playbackstatus === 'Paused') {
			playPauseBtn.setPlaybackStatus(playbackstatus)
		}

	}

	function handleUrlChanged(url: string) {

		const channelName = url ? channelStore.getChannelName(url) : null

		appletLabel.setText(channelName)

		channelList.setCurrentChannel(channelName)
		infoSection.setChannel(channelName)
		configs.lastUrl = url
	}

	function hanldeLengthChanged(length: number) {
		seeker.setLength(length)
	}

	function handlePositionChanged(position: number) {
		seeker?.setPosition(position)
	}

	function handleDownloadBtnClicked() {

		const title = mpvHandler.getCurrentTitle()

		const downloadProcess = downloadSongFromYoutube({
			downloadDir: configs.musicDownloadDir,
			title,
			onDownloadFinished: (path) => notifyYoutubeDownloadFinished({
				downloadPath: path
			}),
			onDownloadFailed: notifyYoutubeDownloadFailed
		})

		notifyYoutubeDownloadStarted({
			title,
			onCancelClicked: () => downloadProcess.cancel()
		})
	}

	return applet
}
