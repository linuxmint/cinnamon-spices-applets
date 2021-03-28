const { TextIconApplet, AllowedLayout } = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
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
	private channelNameOnPanel: boolean
	private customInitVolume: number
	private keepVolume: boolean
	private lastVolume: number
	private channelList: Channel[]
	private mainMenu: PopupMenu
	// currentUrl must be saved to settings to load it on cinnamon restart
	private currentUrl: string
	private music_dir: string

	private channelStore: ChannelStore
	private menuManager: imports.ui.popupMenu.PopupMenuManager
	private orientation: imports.gi.St.Side
	private mpvPlayer: MpvPlayerHandler

	public constructor(orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
		super(orientation, panelHeight, instanceId);

		this.orientation = orientation

		// Allow Applet to be used on vertical and horizontal panels. By default only horizontal panels are allowed
		this.setAllowedLayout(AllowedLayout.BOTH);
		this.settings = new AppletSettings(this, __meta.uuid, instanceId);
	}

	public async init(orientation: imports.gi.St.Side) {
		this.initSettings()

		//  must be called before init of mpv player. Therefore called outside of initGui... 
		this.createContextMenu()

		this.channelStore = new ChannelStore(this.channelList)
		await this.initMpvPlayer()

		this.currentUrl = this.mpvPlayer.currentUrl

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

		this.setIconColor()
		this.setAppletLabel()
		this.setAppletTooltip()

		this.createMenu(this.playbackStatus)
	}


	private async initMpvPlayer() {

		this.mpvPlayer = new MpvPlayerHandler({
			validUrls: this.activatedChannelUrls,
			currentUrl: this.currentUrl,
			initialVolume: this.initialVolume,

			onStopped: (...args) => this.handleRadioStopped(),
			onVolumeChanged: (...args) => this.handleVolumeChanged(...args),
			onStarted: (...args) => this.handleRadioStarted(...args),
			onChannelChanged: (...args) => this.handleChannelChanged(args[0]),
			onPaused: (...args) => this.handleRadioPaused(),
			onResumed: (...args) => this.handleRadioResumed(),
		})

		await this.mpvPlayer.init()

	}

	private createMenu(playbackStatus: PlaybackStatus) {

		this.menuManager ??= new PopupMenuManager(this)

		this.mainMenu = new PopupMenu({
			launcher: this,
			orientation: this.orientation,
			stations: this.activatedChannelNames,
			onChannelClicked: (...args) => this.handleChannelClicked(...args),
			onStopClicked: () => this.mpvPlayer.stop(),
			onVolumeSliderChanged: (volume: number) => this.volume = volume,
			initialChannel: this.currentChannelName,
			initialPlaybackstatus: playbackStatus,
			volume: this.volume
		})

		this.menuManager.addMenu(this.mainMenu)
	}

	private createContextMenu() {
		this._applet_context_menu.addAction(
			"Copy current song title",
			() => this.handleCopySong()
		)
		this._applet_context_menu.addAction(
			"Download from Youtube",
			() => downloadSongFromYoutube(this.mpvPlayer.currentSong, this.music_dir)
		)
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


	private setIconColor() {
		const color = this.playbackStatus === "Playing" ? this.symbolicIconColorWhenPlaying : true
		this.actor.style = `color: ${color}`
	}


	private setAppletLabel() {
		const label = (this.channelNameOnPanel && this.playbackStatus === "Playing")
			? ' ' + this.currentChannelName : ''

		this.set_applet_label(label)
	}

	private setAppletTooltip() {
		const tooltipTxt = this.playbackStatus === "Stopped" ? "Radio++" : `Volume: ${this.volume.toString()}%`
		this.set_applet_tooltip(tooltipTxt)
	}

	private handleRadioStopped() {

		this.currentUrl = null

		this.setAppletLabel()
		this.setIconColor()
		this.setAppletTooltip()
		this.mainMenu.playbackStatus = "Stopped"

		// theoretically it would make sense to save the last volume when the volume changes (as it is not guranteed that this method is called when cinnamon crashes) but this has hugh performance issues when changing the volume by scrolling
		this.lastVolume = this.mpvPlayer.volume
		this.updateMpvInitialVolume()
	}

	private handleRadioPaused() {
		this.setAppletLabel()
		this.setIconColor()
		this.mainMenu.playbackStatus = 'Paused'
	}

	private handleRadioResumed() {
		this.setAppletLabel()
		this.setIconColor()

		this.mainMenu.playbackStatus = 'Playing'
	}

	private handleRadioStarted(channelUrl: string) {
		this.currentUrl = channelUrl

		this.setAppletLabel()
		this.setIconColor()
		this.setAppletTooltip()
		this.mainMenu.setChannel(this.currentChannelName)
	}

	private handleChannelChanged(newUrl: string) {
		this.currentUrl = newUrl

		this.setAppletLabel()
		this.setIconColor() // needed when paused before!		

		this.mainMenu.setChannel(this.currentChannelName)
	}

	private handleChannelListChanged(channelList: Channel[]) {
		this.channelStore = new ChannelStore(channelList)
		this.mainMenu.stationsList = this.activatedChannelNames
		this.mpvPlayer.validUrls = this.activatedChannelUrls
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
		this.setAppletTooltip()
		this.mainMenu.volume = volume
	}

	private get initialVolume() {
		const initvolume = this.keepVolume ? this.lastVolume : this.customInitVolume
		return initvolume
	}

	private updateMpvInitialVolume() {
		this.mpvPlayer.initialVolume = this.initialVolume
	}

	public on_applet_removed_from_panel() {
		this.mpvPlayer.stop()
		// TODO: add method to types
		//this.settings.finalize();
	}

	public async on_applet_clicked(event: any): Promise<void> {
		try {
			await checkInstallMrisPlugin()
			await checkInstallMpv()
			this.mainMenu.toggle()
		} catch (error) {
			notifySend("couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.")
		}
	}


	private handleMouseScroll(event: any) {
		const direction = event.get_scroll_direction();
		const volumeChange = (direction === ScrollDirection.UP) ? 5 : -5

		this.volume += volumeChange
	}

	private get currentChannelName() {
		return this.channelStore.getChannelName(this.currentUrl)
	}

	private get activatedChannelNames() {
		return this.channelStore.activatedChannelNames
	}

	private get activatedChannelUrls() {
		return this.channelStore.activatedChannelUrls
	}

	private get playbackStatus() {
		return this.mpvPlayer.playbackStatus
	}

	private get volume() {
		return this.mpvPlayer?.volume ?? this.initialVolume
	}

	private set volume(newVolume: number) {
		this.mpvPlayer.volume = newVolume
	}

	public on_applet_middle_clicked(event: any) {
		this.mpvPlayer.togglePlayPause()
	}
}