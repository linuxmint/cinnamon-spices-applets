"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStore = void 0;
class ChannelStore {
    constructor(channelList) {
        this.channelList = channelList;
    }
    set channelList(channelList) {
        const filteredChannelList = channelList.filter(channel => channel.inc);
        this._channelList = filteredChannelList.map(channel => {
            return Object.assign(Object.assign({}, channel), { url: channel.url.trim() });
        });
    }
    get activatedChannelUrls() {
        return this._channelList.map(channel => channel.url);
    }
    get activatedChannelNames() {
        return this._channelList.map(channel => channel.name);
    }
    getChannelName(channelUrl) {
        const channel = this._channelList.find(cnl => cnl.url === channelUrl);
        return channel ? channel.name : null;
    }
    getChannelUrl(channelName) {
        const channel = this._channelList.find(cnl => cnl.name === channelName);
        return channel ? channel.url : null;
    }
    checkListChanged(channelList) {
        return JSON.stringify(channelList) === JSON.stringify(this._channelList) ?
            false : true;
    }
    checkUrlValid(channelUrl) {
        return this._channelList.some(cnl => cnl.url === channelUrl);
    }
}
exports.ChannelStore = ChannelStore;
