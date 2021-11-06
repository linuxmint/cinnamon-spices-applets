import { Channel } from './types'

export class ChannelStore {
    private _channelList: Channel[]

    constructor(channelList: Channel[]) {
        this.channelList = channelList

    }

    public set channelList(channelList: Channel[]) {

        this._channelList = channelList.flatMap(channel => {
            return channel.inc ? { ...channel, url: channel.url.trim() } : []
        })

    }

    public get activatedChannelUrls() {
        return this._channelList.map(channel => channel.url)
    }


    public get activatedChannelNames() {
        return this._channelList.map(channel => channel.name)
    }

    // TODO: what is when two Channels have the same Name or Url? :O
    public getChannelName(channelUrl: string) {
        const channel = this._channelList.find(cnl => cnl.url === channelUrl)

        return channel ? channel.name : null
    }

    public getChannelUrl(channelName: string) {
        const channel = this._channelList.find(cnl => cnl.name === channelName)
        return channel ? channel.url : null
    }

    public checkListChanged(channelList: Channel[]) {
        return JSON.stringify(channelList) === JSON.stringify(this._channelList) ?
            false : true
    }

    public checkUrlValid(channelUrl: string) {
        return this._channelList.some(cnl => cnl.url === channelUrl)
    }

}