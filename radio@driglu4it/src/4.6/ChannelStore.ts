import { Channel } from './types'

export class ChannelStore {
    private channelList: Channel[]

    constructor(channelList: Channel[]) {
        this.channelList = channelList.map(channel => {
            return { ...channel, url: channel.url.trim() }
        })
    }


    public get activatedChannelUrls() {
        const filteredChannelList = this.channelList.filter(channel => channel.inc)

        return filteredChannelList.map(channel => channel.url)

        // TODO: add babel to allow the usage of flatMap!
        // return this.channelList.flatMap(channel =>
        //     channel.inc ? channel.url : []
        // )
    }


    public get activatedChannelNames() {
        const filteredChannelList = this.channelList.filter(channel => channel.inc)
        return filteredChannelList.map(channel => channel.name)

        // TODO: add babel to allow the usage of flatMap!
        // return this.channelList.flatMap(channel =>
        //     channel.inc ? channel.name : []
        // )
    }



    // TODO: what is when two Channels have the same Name or Url? :O
    public getChannelName(channelUrl: string) {
        const channel = this.channelList.find(cnl => cnl.url === channelUrl)

        return channel ? channel.name : null
    }

    public getChannelUrl(channelName: string) {
        const channel = this.channelList.find(cnl => cnl.name === channelName)
        return channel ? channel.url : null
    }


}