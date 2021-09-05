const VALID_URLS = ['http://valid1.mp3', 'http://valid2.pls']

const VALID_URL_1 = VALID_URLS[0]
const VALID_URL_2 = VALID_URLS[1]
const INVALID_URL = "dummyInvalidUrl"
const MOCKED_LOADING_TIME = 10
const VALID_VOLUME_PERCENT_1 = 80
const VALID_VOLUME_PERCENT_2 = 50

import { initMprisMocks } from '../../utils/MpvMock'
const { resetInterfaces, simulateMpvStart, simulateTitleChanged } = initMprisMocks(
    { loadingTime: MOCKED_LOADING_TIME }
)

import { createMpvHandler } from 'mpv/MpvHandler'
import { MprisMediaPlayerDbus } from 'types'
import { MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME } from 'consts'
const { getDBusProxyWithOwner } = imports.misc.interfaces
const { MixerControl } = imports.gi.Cvc

const onPlaybackstatusChanged = jest.fn(() => { })
const onUrlChanged = jest.fn(() => { })
const onVolumeChanged = jest.fn(() => { })
const onTitleChanged = jest.fn(() => { })
const onLengthChanged = jest.fn(() => { })
const onPositionChanged = jest.fn(() => { })

function checkUrlValid(url: string) {
    const urlValid = VALID_URLS.includes(url)
    return urlValid
}

const callbacks = { onPlaybackstatusChanged, onUrlChanged, onVolumeChanged, onTitleChanged, onLengthChanged, onPositionChanged }

function initMpvListener(args: { lastUrl?: string }) {

    const {
        lastUrl
    } = args

    let mprisListener = createMpvHandler({
        ...callbacks,
        checkUrlValid,
        lastUrl,
        getInitialVolume: () => { return 50 },
    })

    return mprisListener
}

function createMpvDbusServerPlayer(): MprisMediaPlayerDbus {
    return getDBusProxyWithOwner(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME) as MprisMediaPlayerDbus
}

afterEach(() => {
    const serverPlayer = createMpvDbusServerPlayer()
    serverPlayer.StopSync()
    resetInterfaces()
})

describe('Starting mpv with valid url is working', () => {

    async function simulateValidMpvStart() {
        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })
    }

    // Mocks have to be improved for this
    it.todo('Other players with mpris interfaces are paused');

    it("onPlaybackstatusChanged should be called immediately with 'Loading'", () => {

        initMpvListener({})

        simulateValidMpvStart()

        expect(onPlaybackstatusChanged).toHaveBeenCalledWith('Loading')
        expect(onPlaybackstatusChanged).toHaveBeenCalledTimes(1)
    });

    it("on PlaybackstatusChanges should be called after stream has been loaded with 'Playing'", async () => {
        initMpvListener({})

        await simulateValidMpvStart()

        expect(onPlaybackstatusChanged).toHaveBeenCalledTimes(2)
        expect(onPlaybackstatusChanged).toHaveBeenCalledWith('Playing')

    })

    it('starting mpv with valid url should trigger onVolumeChanged once', async () => {
        initMpvListener({})
        await simulateValidMpvStart()

        expect(onVolumeChanged).toHaveBeenCalledWith(VALID_VOLUME_PERCENT_1)
        expect(onVolumeChanged).toHaveBeenCalledTimes(1)
    })

    it('starting mpv with valid url should trigger OnTitleChanged twice', async () => {
        initMpvListener({})
        await simulateValidMpvStart()

        expect(onTitleChanged).toHaveBeenCalledTimes(2)

    })

    it('starting mpv with valid url should trigger OnUrlChanged once', async () => {
        initMpvListener({})
        await simulateValidMpvStart()

        expect(onUrlChanged).toHaveBeenCalledWith(VALID_URL_1)
        expect(onUrlChanged).toHaveBeenCalledTimes(1)
    })
});

describe('Create Handler while mpv is already running is working', () => {

    // when this works, it is expect that also other callbacks are working
    it.todo('changing volume should trigger onVolumeChange');

});

describe('starting mpv with invalid url is working', () => {

    it.todo('should not pause other mpris player');

    it("starting mpv with invalid url shouldn't trigger any callback", async () => {
        initMpvListener({})
        await simulateMpvStart({
            url: INVALID_URL,
            volume: VALID_VOLUME_PERCENT_1,
        })

        Object.values(callbacks)
            .forEach(cb => {
                expect(cb).not.toHaveBeenCalled()
            });

    })
})

describe('changing url is working', () => {

    it('changing url fram valid url to another valid url should immediately change playbackstatus to loading', () => {
        simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        initMpvListener({ lastUrl: VALID_URL_1 })

        onPlaybackstatusChanged.mockClear()

        const serverPlayer = createMpvDbusServerPlayer()
        serverPlayer.OpenUriRemote(VALID_URL_2)

        expect(onPlaybackstatusChanged).toHaveBeenCalledWith('Loading')
        expect(onPlaybackstatusChanged).toBeCalledTimes(1)
    })


    it('changing url from valid url to another valid url should change playbackstatus to previous state after loading', async () => {
        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        const serverPlayer = createMpvDbusServerPlayer()
        serverPlayer.PauseSync()

        initMpvListener({ lastUrl: VALID_URL_1 })
        onPlaybackstatusChanged.mockClear()

        await serverPlayer.OpenUriRemote(VALID_URL_2)

        expect(onPlaybackstatusChanged).toHaveBeenLastCalledWith('Paused')

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
    */
    it('changing url from valid url to invalid url should be ignored', async () => {
        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        initMpvListener({ lastUrl: VALID_URL_1 })

        onUrlChanged.mockClear()

        const serverPlayer = createMpvDbusServerPlayer()
        await serverPlayer.OpenUriRemote(INVALID_URL)

        expect(onUrlChanged).not.toHaveBeenCalled()
 
    })

    // TODO: test corner case: starting mpv with invalid url and changing later to valid url

});

describe('changing volume is working', () => {

    it('changing volume when mpv is running with valid url should trigger onVolumeChanged', async () => {

        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        initMpvListener({
            lastUrl: VALID_URL_1
        })

        const serverPlayer = createMpvDbusServerPlayer()

        serverPlayer.Volume = VALID_VOLUME_PERCENT_2 / 100

        expect(onVolumeChanged).toHaveBeenCalledWith(VALID_VOLUME_PERCENT_2)

    })

    it('changing volume when mpv is running with invalid url has no effect', async () => {
        await simulateMpvStart({
            url: INVALID_URL,
            volume: VALID_VOLUME_PERCENT_1,
        })

        initMpvListener({})

        const serverPlayer = createMpvDbusServerPlayer()
        serverPlayer.Volume = VALID_VOLUME_PERCENT_2 / 100
        expect(onVolumeChanged).not.toHaveBeenCalled()
    })

    it('changing volume to 0 is handled', async () => {
        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        initMpvListener({
            lastUrl: VALID_URL_1
        })

        const serverPlayer = createMpvDbusServerPlayer()
        serverPlayer.Volume = 0
        expect(onVolumeChanged).toHaveBeenCalledWith(0)
    })

    it('setting Volume updates mpris Volume', async () => {
        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        const { setVolume } = initMpvListener({
            lastUrl: VALID_URL_1
        })

        setVolume(VALID_VOLUME_PERCENT_2)

        const serverPlayer = createMpvDbusServerPlayer()

        expect(serverPlayer.Volume).toBe(VALID_VOLUME_PERCENT_2 / 100)
    });

    it('setting Volume udpates cvc Volume', async () => {
        await simulateMpvStart({
            url: VALID_URL_1,
            volume: VALID_VOLUME_PERCENT_1,
        })

        const { setVolume } = initMpvListener({
            lastUrl: VALID_URL_1
        })

        setVolume(VALID_VOLUME_PERCENT_2)

        let cvcStream: imports.gi.Cvc.MixerStream
        const control = new MixerControl({ name: __meta.name })
        control.open()

        control.connect('stream-added', (ctrl, id) => {
            cvcStream = control.lookup_stream_id(id)
        })

        const expectedCvcVolume = control.get_vol_max_norm() * VALID_VOLUME_PERCENT_2 / 100
        expect(cvcStream.volume).toBe(expectedCvcVolume)
    });

});

describe('Changing position is working', () => {
    it.todo('Should change to valid value')
});