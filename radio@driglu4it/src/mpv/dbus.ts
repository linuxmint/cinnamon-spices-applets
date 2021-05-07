import { getDBusPromise, getDBusProxyWithOwnerPromise } from 'functions/promiseHelpers'

import { MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PLAYER_NAME } from 'CONSTANTS'



interface Arguments {
    /**
     * Callback fired after mpv process has started. This callback allows to register Mpris Listener. The Mpris Listener will be immedietaly informed about Media Metadata changes. */
    onMpvRegistered: { (): void },
    onMpvStopped: { (): void }
}


// mpvStarted
export async function listenToDbus(args: Arguments) {

    const {
        onMpvRegistered,
        onMpvStopped
    } = args

    const dbus = await getDBusPromise()

    dbus.connectSignal('NameOwnerChanged', (...args) => {
        const name = args[2][0]
        const oldOwner = args[2][1]
        const newOwner = args[2][2]

        if (name !== MPV_MPRIS_BUS_NAME) return

        if (newOwner) {
            onMpvRegistered()
            pauseAllOtherMediaPlayer()
        }
        oldOwner && onMpvStopped()

    })


    async function pauseAllOtherMediaPlayer() {
        const allMprisPlayerBusNames = await getAllMrisPlayerBusNames()

        allMprisPlayerBusNames.forEach(async busName => {

            if (busName === MPV_MPRIS_BUS_NAME) return

            const mediaServerPlayer = await
                getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, busName)
            mediaServerPlayer.PauseRemote()
        })

    }

    function getAllMrisPlayerBusNames() {
        const name_regex = /^org\.mpris\.MediaPlayer2\./;

        return new Promise<string[]>((resolve, reject) => {
            dbus.ListNamesRemote(names => {
                const busNames = names[0].filter(busName =>
                    name_regex.test(busName)
                )
                const busNamesArr = Object.values(busNames)
                resolve(busNamesArr)
            })
        })
    }

    const checkMpvRunning = async function () {
        return (await getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME)
    }

    return {
        // dbus,
        checkMpvRunning
    }

}