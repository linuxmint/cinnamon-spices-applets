import { getDBusProxyWithOwnerPromise } from 'functions/promiseHelpers'
import { MprisMediaPlayer, PlaybackStatus } from 'types'
import { MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME, MAX_VOLUME } from 'CONSTANTS'


export type MpvMprisBase = {
    mediaServerPlayer: MprisMediaPlayer,
    getPlaybackStatus: { (): PlaybackStatus },
    getVolume: { (): number }

}

// functions shared by MpvMprisListener and MpvMprisContoller
export async function createMpvMprisBase() {


    const mediaServerPlayer = await getDBusProxyWithOwnerPromise(
        MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME) as MprisMediaPlayer

    let stopped: boolean;

    if (!mediaServerPlayer.PlaybackStatus) stopped = true


    function getPlaybackStatus() {

        const playbackStatus: PlaybackStatus =
            stopped ? "Stopped" : mediaServerPlayer.PlaybackStatus

        return playbackStatus
    }

    /**
    * returns the current Volume normalized and changes the volume if above maximum
    * 
    */
    function getVolume() {

        if (mediaServerPlayer.Volume == null) return null // mpv not running

        let currentVolume = Math.round(mediaServerPlayer.Volume * 100)

        if (currentVolume > MAX_VOLUME) {
            mediaServerPlayer.Volume = MAX_VOLUME / 100
            currentVolume = MAX_VOLUME
        }

        return currentVolume
    }

    function setStop(stoppedNew: boolean) {
        stopped = stoppedNew
    }


    return {
        mediaServerPlayer,
        getPlaybackStatus,
        getVolume,
        setStop
    }

}