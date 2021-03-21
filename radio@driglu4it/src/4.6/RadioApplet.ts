// see: https://projects.linuxmint.com/reference/git/cinnamon-tutorials/importer.html
const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem } = imports.ui.popupMenu;

const { Clipboard, ClipboardType } = imports.gi.St

import { MpvPlayerHandler } from "./MpvPlayerHandler";
import { PlaybackStatus, Channel } from './types'
import { PopupMenu } from './PopupMenu'
import { ChannelStore } from "./ChannelStore";
import { checkInstallMpv, checkInstallMrisPlugin, notifySend, downloadSongFromYoutube } from './utils'

const { ScrollDirection } = imports.gi.Clutter;


const { AppletSettings } = imports.ui.settings;


export class RadioApplet extends TextIconApplet {

	// setting variables
	private settings: imports.ui.settings.AppletSettings;
	private iconType: string
	private symbolicIconColorWhenPlaying: string
	private channelList: Channel[]

	private channelStore: ChannelStore

	private channelNameOnPanel: boolean
	private keepVolume: string
	private lastVolume: number
	private customInitVolume: number

	private menuManager: imports.ui.popupMenu.PopupMenuManager
	private orientation: imports.gi.St.Side

	// TODO: uuid can be received from meta
	private uuid: string
	private mpvPlayer: MpvPlayerHandler
	private mainMenu: PopupMenu
	// currentUrl must be saved to settings to load it on cinnamon restart
	private currentUrl: string

	private music_dir: string


	public constructor(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
		super(orientation, panelHeight, instanceId);

		this.uuid = metadata.uuid
		this.orientation = orientation

		// Allow Applet to be used on vertical and horizontal panels. By default only horizontal panels are allowed
		this.setAllowedLayout(AllowedLayout.BOTH);

		this.settings = new AppletSettings(this, this.uuid, instanceId);

	}

	public async init(orientation: imports.gi.St.Side) {
		this.initSettings()

		this.initChannelStore(this.channelList)
		await this.initMpvPlayer()

		this.initGui()

		this.actor.connect('scroll-event', (actor: any, event: any) => this.handleMouseScroll(event))

	}

	private initSettings() {
		this.settings.bind("icon-type", "iconType", () => this.setIcon());
		this.settings.bind("color-on", "symbolicIconColorWhenPlaying", () => this.setIconColor());
		this.settings.bind("channel-on-panel", "channelNameOnPanel", () => this.setAppletLabel());
		this.settings.bind("initial-volume", "customInitVolume", () => this.updateMpvInitialVolume())
		this.settings.bind("keep-volume-between-sessions", "keepVolume", () => this.updateMpvInitialVolume());
		this.settings.bind("last-volume", "lastVolume", () => this.updateMpvInitialVolume());
		this.settings.bind("tree", "channelList", (channelList: Channel[]) => this.handleChannelListChanged(channelList));
		this.settings.bind("current-url", "currentUrl");
		this.settings.bind("music-download-dir-select", "music_dir");
	}

	private initGui() {
		this.setIcon()

		const playbackStatus = this.mpvPlayer.playbackStatus
		const channelName = this.mpvPlayer.currentUrl ?
			this.channelStore.getChannelName(this.mpvPlayer.currentUrl) : null

		this.setIconColor(playbackStatus)
		this.setAppletLabel(playbackStatus, channelName)
		this.setAppletTooltip(playbackStatus, this.mpvPlayer?.volume)
		this.createMenu(channelName, playbackStatus)
		this.createContextMenu()
	}

	private initChannelStore(channelList: Channel[]) {
		this.channelStore = new ChannelStore(channelList)
	}

	private async initMpvPlayer() {

		this.mpvPlayer = new MpvPlayerHandler({
			validUrls: this.channelStore.getActivatedChannelUrls(),
			currentUrl: this.currentUrl,
			initialVolume: this.initialVolume,

			onStopped: (...args) => this.handleRadioStopped(...args),
			onVolumeChanged: (...args) => this.handleVolumeChanged(...args),
			onStarted: (...args) => this.handleRadioStarted(...args),
			onChannelChanged: (...args) => this.handleChannelChanged(...args),
			onPaused: (...args) => this.handleRadioPaused(...args),
			onResumed: (...args) => this.handleRadioResumed(...args),
		})

		await this.mpvPlayer.init()

	}

	private createMenu(channelName: string | null, playbackStatus: PlaybackStatus) {

		const stationNames = this.channelStore.getActivatedChannelNames()

		if (!this.menuManager) this.menuManager = new PopupMenuManager(this)
		// TODO: WTF?
		this.mainMenu = new PopupMenu(
			this, this.orientation, stationNames,
			(...args) => this.handleChannelClicked(...args),
			() => this.mpvPlayer.stop(),
			channelName,
			playbackStatus
		)
		this.menuManager.addMenu(this.mainMenu)

	}

	private createContextMenu() {
		const copyTitleItem = new PopupMenuItem("Copy current song title")
		copyTitleItem.connect("activate", () => this.handleCopySong())

		const youtubeDownloadItem = new PopupMenuItem("Download from Youtube")
		youtubeDownloadItem.connect('activate', () =>
			downloadSongFromYoutube(this.mpvPlayer.currentSong, this.music_dir)
		)

		this._applet_context_menu.addMenuItem(copyTitleItem, 0)
		this._applet_context_menu.addMenuItem(youtubeDownloadItem, 1)
		this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());

	}

	private handleCopySong() {
		const currentSong = this.mpvPlayer.currentSong

		if (currentSong) {
			Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, currentSong)
		}
	}

	private setIcon() {
		if (this.iconType === "SYMBOLIC") this.set_applet_icon_symbolic_name('radioapplet')
		else this.set_applet_icon_name(`radioapplet-${this.iconType.toLowerCase()}`)
	}

	/**
	 * 
	 * @param playbackStatus should always be passed (except when setting changes)
	 * @returns 
	 */
	private setIconColor(playbackStatus?: PlaybackStatus) {
		playbackStatus ??= this.mpvPlayer.playbackStatus
		const color = playbackStatus === "Playing" ? this.symbolicIconColorWhenPlaying : true
		this.actor.style = `color: ${color}`
	}


	/**
	 * 
	 * @param playbackStatus should always be passed (except when setting changes)
	 * @param currentChannelName only needed when radio ist not stopped
	 * @returns 
	 */

	private setAppletLabel(playbackStatus?: PlaybackStatus, currentChannelName?: string) {

		playbackStatus ??= this.mpvPlayer.playbackStatus


		if (playbackStatus === "Playing") {
			currentChannelName ??= this.channelStore.getChannelName(this.currentUrl)
		}

		const label = (this.channelNameOnPanel && playbackStatus === "Playing")
			? ' ' + currentChannelName : ''

		this.set_applet_label(label)
	}

	private setAppletTooltip(playbackStatus: PlaybackStatus, volume?: number) {

		const tooltipTxt = playbackStatus === "Stopped" ? "Radio++" : `Volume: ${volume.toString()}%`
		this.set_applet_tooltip(tooltipTxt)
	}


	private handleRadioStopped(previousChannelUrl: string) {

		this.currentUrl = null
		const previousChannelName = this.channelStore.getChannelName(previousChannelUrl)

		this.setAppletLabel('Stopped')
		this.setIconColor('Stopped')
		this.setAppletTooltip('Stopped')
		this.mainMenu.activateStopItem(previousChannelName)
	}

	private handleRadioPaused(channelUrl: string) {

		const channelName = this.channelStore.getChannelName(channelUrl)

		this.mainMenu.pauseChannelItem(channelName)
		this.setIconColor('Paused')
		this.setAppletLabel('Paused')
	}

	private handleRadioResumed(channelUrl: string) {

		const channelName = this.channelStore.getChannelName(channelUrl)
		this.mainMenu.resumeChannelItem(channelName)
		this.setIconColor('Playing')
		this.setAppletLabel('Playing')

	}

	private handleRadioStarted(channelUrl: string) {
		this.currentUrl = channelUrl
		const channelName = this.channelStore.getChannelName(channelUrl)

		this.mainMenu.activateChannelItem(channelName)

		this.setAppletTooltip('Playing', this.mpvPlayer.volume)
		this.setIconColor('Playing')
		this.setAppletLabel('Playing', channelName)

	}

	private handleChannelChanged(oldUrl: string, newUrl: string) {
		this.currentUrl = newUrl

		const newChannelName = this.channelStore.getChannelName(newUrl)
		const oldChannelName = this.channelStore.getChannelName(oldUrl)

		this.mainMenu.changeChannelItem(newChannelName, oldChannelName)

		this.setIconColor('Playing') // can happen when paused before!		
		this.setAppletLabel('Playing', newChannelName)
	}

	private handleChannelListChanged(channelList: Channel[]) {

		this.initChannelStore(channelList)
		this.mainMenu.updateStationList(this.channelStore.getActivatedChannelNames(),
			this.mpvPlayer.playbackStatus, this.channelStore.getChannelName(this.currentUrl))


		this.mpvPlayer.updateValidUrls(this.channelStore.getActivatedChannelUrls())
	}

	private handleChannelClicked(channelName: string) {

		const url = this.channelStore.getChannelUrl(channelName)
		const playbackStatus = this.mpvPlayer.playbackStatus;

		if (playbackStatus === "Stopped") {
			this.mpvPlayer.start(url);
			return
		}

		if (this.mpvPlayer.currentUrl !== url) {
			this.mpvPlayer.changeChannel(url)
			return
		}

		if (playbackStatus === "Paused") this.mpvPlayer.togglePlayPause()

	}

	private handleVolumeChanged(volume: number) {
		this.setAppletTooltip('Playing', volume)
		if (volume) this.lastVolume = volume
	}


	private get initialVolume() {
		return this.keepVolume ? this.lastVolume : this.customInitVolume
	}


	private updateMpvInitialVolume() {
		this.mpvPlayer.initialVolume = this.initialVolume
	}

	/** Override function */
	public on_applet_removed_from_panel(deleteConfig: any) {
		// TODO!!
	}

	public async on_applet_clicked(event: any): Promise<void> {

		try {
			await checkInstallMrisPlugin()
			await checkInstallMpv()
			this.mainMenu.toggle()
		} catch (error) {
			global.log(`error occured: ${error}`)
			notifySend("couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.")
		}
	}


	private handleMouseScroll(event: any) {
		const direction = event.get_scroll_direction();
		const volumeChange = (direction === ScrollDirection.UP) ? 5 : -5
		this.mpvPlayer.increaseDecreaseVolume(volumeChange)
	}

	public on_applet_middle_clicked(event: any) {
		this.mpvPlayer.togglePlayPause()
	}


}