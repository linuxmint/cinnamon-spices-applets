"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStore = void 0;
class ChannelStore {
    constructor(channelList) {
        this.channelList = channelList.map(channel => {
            return Object.assign(Object.assign({}, channel), { url: channel.url.trim() });
        });
    }
    getActivatedChannelUrls() {
        const filteredChannelList = this.channelList.filter(channel => channel.inc);
        return filteredChannelList.map(channel => channel.url);
    }
    getActivatedChannelNames() {
        const filteredChannelList = this.channelList.filter(channel => channel.inc);
        return filteredChannelList.map(channel => channel.name);
    }
    getChannelName(channelUrl) {
        const channel = this.channelList.find(cnl => cnl.url === channelUrl);
        return channel ? channel.name : null;
    }
    getChannelUrl(channelName) {
        const channel = this.channelList.find(cnl => cnl.name === channelName);
        return channel ? channel.url : null;
    }
}
exports.ChannelStore = ChannelStore;
