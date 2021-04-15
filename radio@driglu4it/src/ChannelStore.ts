import { Channel } from './types'

export class ChannelStore {
    private _channelList: Channel[]

    constructor(channelList: Channel[]) {
        this.channelList = channelList

    }

    public set channelList(channelList: Channel[]) {

        const filteredChannelList = channelList.filter(channel => channel.inc)

        this._channelList = filteredChannelList.map(channel => {
            return { ...channel, url: channel.url.trim() }
        })
        // TODO: add babel to allow the usage of flatMap!
        // return this.channelList.flatMap(channel =>
        //     channel.inc ? channel.url : []
        // )
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