import { MAX_STRING_LENGTH } from 'consts';
import { limitString } from 'functions/limitString';
import { PlaybackStatus } from 'types';
const { PopupBaseMenuItem } = imports.ui.popupMenu


interface Arguments {
    channelName: string,
}

export function createChannelMenuItem(args: Arguments) {

    const {
        channelName
    } = args

    const dummyActor = Object.create(new PopupBaseMenuItem())
    dummyActor.channelName = limitString(channelName, MAX_STRING_LENGTH)


    function setPlaybackStatus(playbackStatus: PlaybackStatus) {
        dummyActor.playbackStatus = playbackStatus
    }

    return {
        setPlaybackStatus,
        actor: dummyActor
    }
}