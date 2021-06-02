
const { MixerControl } = imports.gi.Cvc; // see https://lazka.github.io/pgi-docs/Cvc-1.0/index.html// 

interface Arguments {
    /**
     * number in percent
     */
    onVolumeChanged: { (volume: number): void }
}

export function createCvcHandler(args: Arguments) {

    const {
        onVolumeChanged
    } = args

    const control = new MixerControl({ name: __meta.name })

    let stream: imports.gi.Cvc.MixerStream

    control.open()

    control.connect('stream-added', (...args: any) => {
        const id: number = args[1]
        const addedStream = control.lookup_stream_id(id)

        if (addedStream?.name !== "mpv Media Player") {
            return
        }

        stream = addedStream
        stream.connect('notify::volume', () => {
            handleVolumeChanged()
        })

    })

    function handleVolumeChanged() {
        const normalizedVolume = normalizeCvcStreamVolume(stream.volume)
        onVolumeChanged(normalizedVolume)
    }

    function normalizeCvcStreamVolume(streamVolume: number) {
        return Math.round(streamVolume / control.get_vol_max_norm() * 100)
    }

    function normalizedVolumeToCvcStreamVolume(normalizedVolume: number) {
        return normalizedVolume / 100 * control.get_vol_max_norm()
    }

    /**
     * 
     * @param newVolume in percent
     */
    function setVolume(newVolume: number) {

        const newStreamVolume = normalizedVolumeToCvcStreamVolume(newVolume)

        if (!stream) return

        if (stream.volume === newStreamVolume) return

        stream.is_muted && stream.change_is_muted(false)
        stream.volume = newStreamVolume
        stream.push_volume()
    }

    return {
        setVolume
    }

}