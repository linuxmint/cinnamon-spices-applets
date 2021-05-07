import { MprisListenerArguments, listenToMpvMpris } from 'mpv/MpvMprisListener'

import { createMpvMprisController, MprisControllerArguments } from 'mpv/MpvMprisController'

import { listenToDbus } from 'mpv/dbus'
import { createCvcHandler } from 'mpv/CvcHandler'
import { createMpvMprisBase } from 'mpv/MpvMprisBase'


interface Arguments extends MprisListenerArguments,
    MprisControllerArguments {
    onStopped: { (volume: number): void }
}

export interface MpvHandler {
    togglePlayPause: { (): void },
    increaseDecreaseVolume: { (volumeChange: number): void },
    channelUrl: string,
    dbus: any,
    volume: number,
    stop: { (): void },
    currentTitle: string
}

export async function createMpvHandler(args: Omit<Arguments, "mprisBase">) {

    const {
        ckeckUrlValid,
        getInitialVolume,

        onChannelChanged,
        onInitialized,
        onStarted,
        onVolumeChanged,
        onStopped,
        onPaused,
        onResumed,
        onTitleChanged
    } = args


    const dbus = await listenToDbus({
        onMpvRegistered: () => mprisListener.activateListener(),
        onMpvStopped: handleMpvStopped
    })

    function handleMpvStopped() {
        mprisListener.deactivateListener()
        mprisBase.setStop(true)
        onStopped(mprisController.getVolume())
    }

    const mprisBase = await createMpvMprisBase()


    const mprisListener = await listenToMpvMpris({
        onChannelChanged,
        onInitialized,
        onStarted: handleStarted,
        onVolumeChanged: handleMprisVolumeChanged,
        ckeckUrlValid,
        onPaused,
        onResumed,
        onTitleChanged,
        mprisBase
    })


    function handleStarted(volume: number, url: string) {
        onStarted(volume, url)
        cvcHandler.setVolume(volume)
        mprisBase.setStop(false)
    }

    const mprisController = await createMpvMprisController({
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

    const mpvHandler: MpvHandler = {
        set channelUrl(url: string) {
            mprisController.setChannel(url)
        },
        set volume(newVolume: number) {
            mprisController.setVolume(newVolume)
        },
        get currentTitle() {
            return mprisController.getCurrentTitle()
        },
        togglePlayPause: mprisController.togglePlayPause,
        increaseDecreaseVolume: mprisController.increaseDecreaseVolume,
        dbus,
        stop: mprisController.stop
    }

    return mpvHandler
}