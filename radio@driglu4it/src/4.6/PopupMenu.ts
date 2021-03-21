import { PlayMausMenuItem } from "./PlayPauseMenuItem";
import { PlaybackStatus } from "./types";

const { AppletPopupMenu } = imports.ui.applet;

const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;


export class PopupMenu extends AppletPopupMenu {

    // private menuItems: imports.ui.popupMenu.PopupMenuItem[] 

    private stopItem: imports.ui.popupMenu.PopupMenuItem
    private myStationsSubMenu: imports.ui.popupMenu.PopupSubMenu

    private channelMap: Map<string, PlayMausMenuItem>

    private onChannelCb: { (name: string): void }


    /**
     * 
     * @param launcher: The applet that contains the context menu 
     * @param orinentation: The orientation of the applet 
     * @param stations: array of names shown on the popup menu
     */
    public constructor(
        launcher: any,
        orinentation: imports.gi.St.Side,
        stations: string[],
        onChannelClicked: { (name: string): void },
        onStopClick: { (): void },
        initialChannel: string | null,
        initialPlaybackstatus: PlaybackStatus
    ) {
        super(launcher, orinentation)
        this.channelMap = new Map<string, PlayMausMenuItem>()
        this.onChannelCb = onChannelClicked


        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My Stations")
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu
        this.addMenuItem(myStationsSubMenuWrapper)

        this.addStationsToMenu(stations);
        this.initStopItem(onStopClick)


        if (initialPlaybackstatus === "Stopped") {
            this.stopItem.setShowDot(true)
        } else {
            const channelItem = this.channelMap.get(initialChannel)
            channelItem.changePlayPauseOffStatus(initialPlaybackstatus)
        }
    }

    private initStopItem(onStopClick: { (): void }) {
        this.stopItem = new PopupMenuItem("Stop");
        this.addMenuItem(this.stopItem)
        this.stopItem.connect('activate', () => onStopClick())
    }

    public addStationsToMenu(stations: string[]) {
        stations.forEach(name => {
            const channelItem = new PlayMausMenuItem(name)
            this.myStationsSubMenu.addMenuItem(channelItem)
            channelItem.connect('activate', () => this.onChannelCb(name))
            this.channelMap.set(name, channelItem)
        })


    }

    public activateStopItem(deactivatedChannel: string) {
        this.stopItem.setShowDot(true)

        const deactivatedChannelItem = this.channelMap.get(deactivatedChannel)
        deactivatedChannelItem?.changePlayPauseOffStatus("Stopped")
    }


    public changeChannelItem(activatedChannel: string, deactivatedChannel: string) {
        const activatedChannelItem = this.channelMap.get(activatedChannel)
        activatedChannelItem?.changePlayPauseOffStatus("Playing")

        const deactivatedChannelItem = this.channelMap.get(deactivatedChannel)
        deactivatedChannelItem?.changePlayPauseOffStatus("Stopped")
    }

    public activateChannelItem(activatedChannel: string) {
        const activatedChannelItem = this.channelMap.get(activatedChannel)
        activatedChannelItem?.changePlayPauseOffStatus("Playing")

        this.stopItem.setShowDot(false)

    }

    public pauseChannelItem(pausedChannel: string) {
        const pausedChannelItem = this.channelMap.get(pausedChannel)
        pausedChannelItem?.changePlayPauseOffStatus("Paused")
    }

    public resumeChannelItem(resumedChannel: string) {
        const resumedChannelItem = this.channelMap.get(resumedChannel)
        resumedChannelItem?.changePlayPauseOffStatus("Playing")
    }


    public open(animate: boolean) {
        super.open(animate)
        this.myStationsSubMenu.open(animate)
    }

    public updateStationList(stationList: string[], playbackStatus: PlaybackStatus,
        channel: string | null) {
        this.myStationsSubMenu.removeAll
        for (let channelItem of this.channelMap.values()) {
            channelItem.destroy()
        }
        this.channelMap.clear()
        this.addStationsToMenu(stationList)

        if (!stationList.includes(channel) || playbackStatus === "Stopped") {
            this.stopItem.setShowDot(true)
        } else {
            const channelItem = this.channelMap.get(channel)
            channelItem.changePlayPauseOffStatus(playbackStatus)
        }
    }

}