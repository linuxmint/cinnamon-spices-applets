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
    onVolumeSliderChanged: { (volume: number): void }
};

export class PopupMenu extends AppletPopupMenu {

    private stopItem: imports.ui.popupMenu.PopupMenuItem
    private myStationsSubMenu: imports.ui.popupMenu.PopupSubMenu
    private channelMap: Map<string, PlayMausMenuItem>
    private onChannelClicked: { (name: string): void }

    private currentChannelMenuItem: PlayMausMenuItem | null;

    private volumeSlider: VolumeSlider


    public constructor({
        launcher,
        orientation,
        stations,
        onChannelClicked,
        onStopClicked,
        initialChannel,
        initialPlaybackstatus,
        onVolumeSliderChanged
    }: Arguments) {

        super(launcher, orientation)

        this.channelMap = new Map<string, PlayMausMenuItem>()
        this.onChannelClicked = onChannelClicked

        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My Stations")
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu

        this.addMenuItem(myStationsSubMenuWrapper)

        this.volumeSlider = new VolumeSlider(50, onVolumeSliderChanged)

        this.volumeSlider.connect('value-changed', (value: number) => global.log(`slider value changed to ${value}`))

        this.addMenuItem(this.volumeSlider)

        this.addStationsToMenu(stations);
        this.initStopItem(onStopClicked, initialPlaybackstatus === "Stopped")
        initialChannel && this.setChannelName(initialChannel, initialPlaybackstatus)

    }


    public set volume(newVolume: number) {
        this.volumeSlider.setValue(newVolume)
    }

    private initStopItem(onClick: { (): void }, stopped: boolean) {
        this.stopItem = new PopupMenuItem("Stop");
        this.addMenuItem(this.stopItem)
        this.stopItem.connect('activate', () => onClick())

        if (stopped) this.playbackStatus = "Stopped"
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

        currentChannelName ? this.setChannelName(currentChannelName, playbackStatus) : this.playbackStatus = "Stopped"
    }


    public open(animate: boolean) {
        super.open(animate)
        this.myStationsSubMenu.open(animate)
    }

    public setChannelName(name: string, playbackStatus: PlaybackStatus = "Playing") {
        if (this.currentChannelMenuItem) this.currentChannelMenuItem.playbackStatus = "Stopped"

        this.currentChannelMenuItem = this.channelMap.get(name)
        this.playbackStatus = playbackStatus
    }

    public set playbackStatus(playbackStatus: PlaybackStatus) {

        if (!this.currentChannelMenuItem && playbackStatus !== "Stopped") {
            global.logError(`can't change playbackStatus to ${playbackStatus} as no channel is defined`)
        }

        if (this.currentChannelMenuItem) this.currentChannelMenuItem.playbackStatus = playbackStatus
        this.stopItem.setShowDot(playbackStatus === 'Stopped')

        if (playbackStatus === 'Stopped') this.currentChannelMenuItem = null
    }

}