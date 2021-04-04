import { PlayMausMenuItem } from "./PlayPauseMenuItem";
import { PlaybackStatus } from "./types";
import { VolumeSlider } from "./VolumeSlider"

const { AppletPopupMenu } = imports.ui.applet;
const { PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;


interface Arguments {
    launcher: any,
    orientation: imports.gi.St.Side,
    stations: string[],
    onChannelClicked: { (name: string): void },
    onStopClicked: { (): void },
    initialChannel: string | null,
    initialPlaybackstatus: PlaybackStatus,
    volume: number,
    onVolumeSliderChanged: { (volume: number): void }
};

export class PopupMenu extends AppletPopupMenu {

    private stopItem: imports.ui.popupMenu.PopupMenuItem
    private myStationsSubMenu: imports.ui.popupMenu.PopupSubMenu
    private channelMap: Map<string, PlayMausMenuItem>
    private onChannelClicked: { (name: string): void }
    private onVolumeSliderChanged: { (volume: number): void }
    private currentChannelMenuItem: PlayMausMenuItem | null;
    private onStopClicked: { (): void }

    private volumeSlider: VolumeSlider
    private _volume: number


    public constructor({
        launcher,
        orientation,
        stations,
        onChannelClicked,
        onStopClicked,
        initialChannel,
        initialPlaybackstatus,
        volume,
        onVolumeSliderChanged
    }: Arguments) {

        super(launcher, orientation)

        this.channelMap = new Map<string, PlayMausMenuItem>()
        this.onChannelClicked = onChannelClicked
        this.onVolumeSliderChanged = onVolumeSliderChanged
        this._volume = volume
        this.onStopClicked = onStopClicked

        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My Stations")
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu

        this.addMenuItem(myStationsSubMenuWrapper)

        this.addStationsToMenu(stations);
        initialChannel && this.setChannel(initialChannel, initialPlaybackstatus)

    }

    private initVolumeSlider() {
        this.volumeSlider = new VolumeSlider(this._volume, (volume: number) =>
            this.handleSliderChanged(volume, this.onVolumeSliderChanged))

        this.addMenuItem(this.volumeSlider)
    }

    private handleSliderChanged(volume: number, cb: { (volume: number): void }) {
        this._volume = volume
        cb(volume)
    }

    public set volume(newVolume: number) {

        if (this._volume === newVolume) return
        this.volumeSlider?.setValue(newVolume)
        this._volume = newVolume
    }

    private initStopItem() {
        this.stopItem = new PopupMenuItem("Stop");
        this.addMenuItem(this.stopItem)
        this.stopItem.connect('activate', () => this.onStopClicked())
    }

    public addStationsToMenu(stations: string[]) {
        stations.forEach(name => {
            const channelItem = new PlayMausMenuItem(name)
            this.myStationsSubMenu.addMenuItem(channelItem)
            channelItem.connect('activate', () => this.onChannelClicked(name))
            this.channelMap.set(name, channelItem)
        })
    }

    public set stationsList(stations: string[]) {
        const currentChannelName = stations.find(station => station === this.currentChannelMenuItem?.label.text)

        const playbackStatus = this.currentChannelMenuItem?.playbackStatus ?? 'Stopped'

        this.channelMap.forEach(channelItem => channelItem.destroy())
        this.channelMap.clear()

        this.addStationsToMenu(stations)

        currentChannelName ? this.setChannel(currentChannelName, playbackStatus) : this.playbackStatus = "Stopped"
    }


    public open(animate: boolean) {
        super.open(animate)
        this.myStationsSubMenu.open(animate)
    }

    public setChannel(name: string, playbackStatus: PlaybackStatus = "Playing") {
        if (this.currentChannelMenuItem) this.currentChannelMenuItem.playbackStatus = "Stopped"

        this.currentChannelMenuItem = this.channelMap.get(name)
        this.playbackStatus = playbackStatus
    }

    public set playbackStatus(playbackStatus: PlaybackStatus) {

        if (!this.currentChannelMenuItem && playbackStatus !== "Stopped") {
            global.logError(`can't change playbackStatus to ${playbackStatus} as no channel is defined`)
        }

        if (this.currentChannelMenuItem) this.currentChannelMenuItem.playbackStatus = playbackStatus

        if (playbackStatus === 'Stopped') {
            this.currentChannelMenuItem = null
            this.volumeSlider?.destroy()
            this.volumeSlider = null
            this.stopItem?.destroy()
            this.stopItem = null
            return
        }

        !this.volumeSlider && this.initVolumeSlider()
        !this.stopItem && this.initStopItem()
    }

}