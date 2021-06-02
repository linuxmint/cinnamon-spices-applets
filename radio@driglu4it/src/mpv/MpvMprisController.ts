const { spawnCommandLine } = imports.misc.util;

import { MPRIS_PLUGIN_PATH, MAX_VOLUME } from 'consts'
import { MpvMprisBase } from 'mpv/MpvMprisBase';

export interface MprisControllerArguments {
    mprisBase: MpvMprisBase,
    getInitialVolume: { (): number }

}

export function createMpvMprisController(args: MprisControllerArguments) {

    let {
        getInitialVolume,
        mprisBase
    } = args


    const {
        mediaServerPlayer,
        getPlaybackStatus,
        getVolume,
    } = mprisBase


    function increaseDecreaseVolume(volumeChange: number) {

        // newVolume is the current Volume plus(or minus) volumeChange 
        // but at least 0 and maximum Max_Volume
        const newVolume = Math.min(
            MAX_VOLUME,
            Math.max(0, getVolume() + volumeChange)
        )

        setVolume(newVolume)

    }


    /**
     * 
     * @param newVolume volume in percent
     */
    function setVolume(newVolume: number) {

        if (getVolume() === newVolume) return

        mediaServerPlayer.Volume = newVolume / 100
    }



    function setChannel(url: string) {

        const mpvRunning = getPlaybackStatus() !== 'Stopped'

        if (!mpvRunning) {

            const command = `mpv --script=${MPRIS_PLUGIN_PATH} ${url} 
                --volume=${getInitialVolume()}`
            spawnCommandLine(command)
            return
        }

        mediaServerPlayer.OpenUriRemote(url)
        mediaServerPlayer.PlayRemote()

    }

    function togglePlayPause() {
        if (getPlaybackStatus() === "Stopped") return

        mediaServerPlayer.PlayPauseRemote()
    }

    function stop() {
        if (getPlaybackStatus() === "Stopped") return

        mediaServerPlayer.StopRemote()
    }

    function getCurrentTitle(): string {
        if (getPlaybackStatus() === "Stopped") return

        // @ts-ignore
        return mediaServerPlayer.Metadata["xesam:title"].unpack()
    }

    const mpvMprisController = {
        setChannel,
        togglePlayPause,
        increaseDecreaseVolume,
        getInitialVolume,
        setVolume,
        getVolume,
        stop,
        getCurrentTitle
    }

    return mpvMprisController
}