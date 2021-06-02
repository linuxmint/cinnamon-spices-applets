import { listenToMpvMpris } from 'mpv/MpvMprisListener'
import { createMpvMprisBase } from 'mpv/MpvMprisBase'
const { spawnCommandLine } = imports.misc.util
import { MPRIS_PLUGIN_PATH } from 'consts'

// @ts-ignore
const { emitPropsChanges, clearInterfaces } = imports.misc.interfaces

const validUrls = ['http://valid1.mp3', 'http://valid2.pls']

const validUrl1 = validUrls[0]
const validUrl2 = validUrls[1]
const invalidUrl = "dummyInvalidUrl"

const onInitialized = jest.fn(() => { })
const onPlaybackstatusChanged = jest.fn(() => { })
const onUrlChanged = jest.fn(() => { })
const onVolumeChanged = jest.fn(() => { })
const onTitleChanged = jest.fn(() => { })

function checkUrlValid(url: string) {
    return validUrls.includes(url)
}

const callbacks = { onInitialized, onPlaybackstatusChanged, onUrlChanged, onVolumeChanged, onTitleChanged }


async function initMpvListener(args: { initialUrl?: string }) {

    let mprisBase = await createMpvMprisBase()

    let mprisListener = await listenToMpvMpris({
        ...callbacks,
        checkUrlValid,
        mprisBase,
        initialUrl: args.initialUrl
    })

    mprisListener.activateListener()

    return mprisListener
}

function startRadio(url, volume) {
    spawnCommandLine(`mpv --volume=${volume} --script=${MPRIS_PLUGIN_PATH} ${url}`)
}

afterEach(() => {
    jest.clearAllMocks();
    clearInterfaces()
})

it('onInitialized called with correct arguments when no initialUrl is passed', async () => {
    await initMpvListener({ initialUrl: null })

    expect(onInitialized).toHaveBeenCalledWith('Stopped', null)
})

// TODO: also title should be passed!
it('onInitialized called with correct arguments when initialUrl is passed and mpv is playing', async () => {

    const volume = 80

    startRadio(validUrl1, volume)
    await initMpvListener({ initialUrl: validUrl1 })

    expect(onInitialized).toHaveBeenCalledWith("Playing", volume)
})

it('onPlaybackstatusChanged called after mpv has been starting with valid url', async () => {
    await initMpvListener({ initialUrl: validUrl1 })
    const volume = 80

    startRadio(validUrl1, volume)

    expect(onPlaybackstatusChanged).toHaveBeenCalledWith('Playing')
})

it('starting mpv with invalid url is ignored', async () => {

    await initMpvListener({})

    jest.clearAllMocks()
    startRadio(invalidUrl, 80)

    Object.entries(callbacks).forEach(([key, cb]) => {
        expect(cb).not.toHaveBeenCalled()
    })

})

it('onTitleChanged called when title changes', async () => {

    await initMpvListener({})
    startRadio(validUrl1, 80)

    jest.clearAllMocks()

    const title1 = 'title1'

    const propChange = {
        Metadata: {
            "xesam:title": title1,
        }
    }

    emitPropsChanges(propChange)
    emitPropsChanges(propChange) // this should be ignored as the title doesn't change

    expect(onTitleChanged).toHaveBeenNthCalledWith(1, title1)
    expect(onTitleChanged).toHaveBeenCalledTimes(1)

})

it('onVolumeChanged called when volume changes', async () => {
    await initMpvListener({})
    startRadio(validUrl1, 80)

    const newVolume = 90

    const propChange = {
        Volume: newVolume / 100
    }

    emitPropsChanges(propChange)

    expect(onVolumeChanged).toHaveBeenCalledWith(newVolume)

})

it('onUrlChanged called when changing to valid url', async () => {

    startRadio(validUrl1, 80)
    await initMpvListener({ initialUrl: validUrl1 })

    const propChange = {
        Metadata: {
            'xesam:url': validUrl2
        }
    }

    emitPropsChanges(propChange)
    emitPropsChanges(propChange) // this should be ignored as the url doesn't change

    expect(onUrlChanged).toHaveBeenNthCalledWith(1, validUrl2)
    expect(onUrlChanged).toHaveBeenCalledTimes(1)

})

/**
     * changing to an invalid url is ignored because of streams with .pls format (and maybe also others). When starting .pls streams the following happens: 
     * 
     * - the props listener is informed with the pls stream url 
     * - mpv receives a new url from the .pls link 
     * - the props listener is informed with new (invalid) url
     * 
     * So it is AFAICS not possible to determine 100 % correctly if the url has changed due to a user manually opening a new url (or file) or due to the behaviour described above. However it seems much more valube to correclty handle .pls files than user opening an invalid url as this a very uncommon behaviour (theoretically possible with playerctl) 
     * 
     * 
*/
it('changing to invalid url is ignored', async () => {
    await initMpvListener({})
    startRadio(validUrl1, 80)

    jest.clearAllMocks()

    const dummyTitle = "dummy Title"

    const propChange = {
        Metadata: {
            "xesam:url": invalidUrl,
            "xesam:title": dummyTitle
        }
    }

    emitPropsChanges(propChange)

    expect(onUrlChanged).not.toHaveBeenCalled()
    expect(onTitleChanged).toHaveBeenCalledWith(dummyTitle)

})

// TODO: it is important that playbackstatus changes is always called first

// // TODO: test corner case: starting mpv with invalid url and changing later to valid url

// TODO make test for volume 0