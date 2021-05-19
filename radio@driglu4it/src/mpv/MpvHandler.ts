import { MprisListenerArguments, listenToMpvMpris } from 'mpv/MpvMprisListener'

import { createMpvMprisController, MprisControllerArguments } from 'mpv/MpvMprisController'

import { listenToDbus } from 'mpv/dbus'
import { createCvcHandler } from 'mpv/CvcHandler'
import { createMpvMprisBase } from 'mpv/MpvMprisBase'
import { AdvancedPlaybackStatus, PlaybackStatus } from 'types'


interface Arguments extends MprisListenerArguments,
    MprisControllerArguments {
    onPlaybackstatusChanged: (playbackStatus: AdvancedPlaybackStatus, lastVolume?: number) => void,
}

export function createMpvHandler(args: Omit<Arguments, "mprisBase">) {

    const {
        checkUrlValid,
        getInitialVolume,
        onUrlChanged,
        onInitialized,
        onVolumeChanged,
        onTitleChanged,
        onPlaybackstatusChanged,
        initialUrl
    } = args


    const dbus = listenToDbus({
        onMpvRegistered: () => mprisListener.activateListener(),
        onMpvStopped: () => handlePlaybackStatusChanged('Stopped')
    })


    const mprisBase = createMpvMprisBase()


    const mprisListener = listenToMpvMpris({

        onInitialized,
        onVolumeChanged: handleMprisVolumeChanged,
        checkUrlValid,
        onTitleChanged,
        onUrlChanged,
        onPlaybackstatusChanged: handlePlaybackStatusChanged,
        mprisBase,
        initialUrl
    })

    function handlePlaybackStatusChanged(playbackStatus: PlaybackStatus) {

        let lastVolume = null

        if (playbackStatus === 'Playing') {
            mprisBase.setStop(false)
            cvcHandler.setVolume(mprisController.getVolume())
        }

        if (playbackStatus === 'Stopped') {
            mprisListener.deactivateListener()
            mprisBase.setStop(true)
            lastVolume = mprisListener.getLastVolume()
        }

        onPlaybackstatusChanged(playbackStatus, lastVolume)
    }

    const mprisController = createMpvMprisController({
        getInitialVolume,
        mprisBase
    })

    const cvcHandler = createCvcHandler({
        onVolumeChanged: mprisController.setVolume
    })

    function handleMprisVolumeChanged(newVolume: number) {
        cvcHandler.setVolume(newVolume)
        onVolumeChanged(newVolume)
    }

    return {
        setChannelUrl: mprisController.setChannel,
        setVolume: mprisController.setVolume,
        getCurrentTitle: mprisController.getCurrentTitle,
        togglePlayPause: mprisController.togglePlayPause,
        increaseDecreaseVolume: mprisController.increaseDecreaseVolume,
        stop: mprisController.stop,
        // it is very confusing but dbus must be returned!
        // Otherwilse all listeners stop working after about 20 seconds which is fucking difficult to debug
        dbus
    }
}