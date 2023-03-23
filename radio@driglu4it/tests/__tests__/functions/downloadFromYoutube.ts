
interface YoutbeDlOption {
    command: string,
    value?: string
}

const mockedDownloadtime = 1 // in ms

function spawnCommandLineAsyncIO(command: string, cb: (stdout: string, stderr: string, exitCode: number) =>
    void) {

    const subStrings = createSubstrings()

    subStrings.forEach((subString, index) => {

        const isCommandOption = subString.startsWith('--') || !subStrings[index - 1]?.startsWith('--')

        if (isCommandOption) {

            let option: YoutbeDlOption = { command: subString }
            let potentialCommandValue = subStrings[index + 1]
            const commandHasValue = !potentialCommandValue?.startsWith('--') && potentialCommandValue

            if (commandHasValue)
                option.value = potentialCommandValue

            youtubeDlOptions.push(option)
        }
    })

    if (youtubeDlOptions[0].command !== 'youtube-dl')
        throw new RangeError('spawnCommandLineAsyncIo not called with youtube-dl')

    const timer = setTimeout(() => {
        // @ts-ignore
        youtubeInstalled ? cb(workingExample.stdOut, null, 0) : cb(null, 'line 1: youtube-dl: command not found', 127)
    }, mockedDownloadtime);

    return {
        force_exit: () => {
            clearTimeout(timer)
            // @ts-ignore
            cb(null, null, 1)
        }
    }

    function createSubstrings() {
        let spaceIndex = -1
        let isInsideDoubleQuote = false
        const subStrings: string[] = [];
        const chars = [...command]

        chars.forEach((char, index) => {

            if (char === " " && !isInsideDoubleQuote || index + 1 === chars.length) {
                subStrings.push(command.substring(spaceIndex + 1, index + 1).trim())
                spaceIndex = index
            }

            if (char === "\"" && command[index - 1] !== "\\") {
                isInsideDoubleQuote = !isInsideDoubleQuote
            }
        })

        return subStrings
    }
}

imports.misc.util = {
    // @ts-ignore
    spawnCommandLineAsyncIO
}

import { initPolyfills } from 'polyfill';
import { downloadSongFromYoutube } from "functions/downloadFromYoutube";

// replaceAll not working in node 14.17.3
initPolyfills()

const workingExample = {
    title: 'Lady Gaga - Stupid Love',
    downloadDir: '/home/jonathan/Music/Radio',
    stdOut: `[download] Downloading playlist: Lady Gaga - Stupid Love
    [youtube: search]query "Lady Gaga - Stupid Love": Downloading page 1
    [youtube: search]playlist Lady Gaga - Stupid Love: Downloading 1 videos
    [download] Downloading video 1 of 1
    [youtube] 5L6xyaeiV58: Downloading webpage
    [youtube] 5L6xyaeiV58: Downloading thumbnail ...
    [youtube] 5L6xyaeiV58: Writing thumbnail to: /home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).jpg
    [download] Destination: /home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).webm
    \u000d[download]   0.0 % of 3.36MiB at 20.21KiB / s ETA 02: 50\u000d[download]   0.1 % of 3.36MiB at 60.37KiB / s ETA 00: 56\u000d[download]   0.2 % of 3.36MiB at 140.34KiB / s ETA 00: 24\u000d[download]   0.4 % of 3.36MiB at 299.62KiB / s ETA 00: 11\u000d[download]   0.9 % of 3.36MiB at 433.91KiB / s ETA 00: 07\u000d[download]   1.8 % of 3.36MiB at 286.46KiB / s ETA 00: 11\u000d[download]   3.7 % of 3.36MiB at 529.41KiB / s ETA 00: 06\u000d[download]   7.4 % of 3.36MiB at 897.32KiB / s ETA 00: 03\u000d[download]  14.9 % of 3.36MiB at  1.32MiB / s ETA 00: 02\u000d[download]  29.7 % of 3.36MiB at  1.89MiB / s ETA 00: 01\u000d[download]  59.5 % of 3.36MiB at  2.38MiB / s ETA 00: 00\u000d[download] 100.0 % of 3.36MiB at  2.66MiB / s ETA 00: 00\u000d[download] 100 % of 3.36MiB in 00: 01
    [ffmpeg] Destination: /home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).mp3
    Deleting original file /home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).webm(pass - k to keep)
    [ffmpeg] Adding metadata to '/home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).mp3'
    [ffmpeg] Adding thumbnail to "/home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).mp3"
    [download] Finished downloading playlist: Lady Gaga - Stupid Love`,
    filePath: '/home/jonathan/Music/Radio/Lady Gaga - Stupid Love (Official Music Video).mp3'
}

const onDownloadFinished = jest.fn(() => { })
const onDownloadFailed = jest.fn(() => { })

function downloadWithValidValues() {
    return downloadSongFromYoutube({
        title: workingExample.title,
        downloadDir: workingExample.downloadDir,
        onDownloadFinished,
        onDownloadFailed
    })
}

let youtubeInstalled: boolean = false
let youtubeDlOptions: YoutbeDlOption[] = []




afterEach(() => {
    jest.clearAllMocks()
    youtubeInstalled = false
    youtubeDlOptions = []
})

it('sucessful download handled correctly', done => {

    youtubeInstalled = true

    downloadWithValidValues()

    setTimeout(() => {
        expect(onDownloadFinished).toHaveBeenCalledWith(workingExample.filePath)
        done()
    }, mockedDownloadtime);

})

// skipping output as already handled in previous test
it('youtubeDl called with correct arguments', done => {
    youtubeInstalled = true

    downloadWithValidValues()

    setTimeout(() => {

        ['--extract-audio', '--add-metadata', '--embed-thumbnail'].forEach(command => {
            expect(youtubeDlOptions.find(option => option.command === command)).toBeTruthy()
        })

        const audioFormat = youtubeDlOptions?.find(option => option.command === '--audio-format')?.value
        expect(audioFormat).toBe('mp3')
        done()
    }, mockedDownloadtime);

})

it('error handling working', done => {

    downloadWithValidValues()

    setTimeout(() => {
        expect(onDownloadFailed).toHaveBeenCalled()
        done()
    }, mockedDownloadtime);

})

describe('canceling download is working', () => {
    it('no callback executed when canceling download', () => {
        const downloadProcess = downloadWithValidValues()
        downloadProcess.cancel()
        expect(onDownloadFailed).not.toHaveBeenCalled()
    })

    it('canceling download has no impact for next download attempt', done => {
        const downloadProcess = downloadWithValidValues()
        downloadProcess.cancel()

        downloadWithValidValues()

        setTimeout(() => {
            expect(onDownloadFailed).toHaveBeenCalled()
            youtubeInstalled = true

            downloadWithValidValues()
            setTimeout(() => {
                expect(onDownloadFinished).toHaveBeenCalledWith(workingExample.filePath)
                done()
            }, mockedDownloadtime);

        }, mockedDownloadtime);
    })
})

it('double quotes are correctly escaped', () => {
    youtubeInstalled = true

    const title = `"Good 4 U" von Olivia Rodrigo`

    downloadSongFromYoutube({
        title: `"Good 4 U" von Olivia Rodrigo`,
        downloadDir: workingExample.downloadDir,
        onDownloadFinished,
        onDownloadFailed
    })

    const searchPrefix = 'ytsearch1:'

    const searchTerm = youtubeDlOptions?.find(
        option => option.command.startsWith(searchPrefix)
    )?.command.split(searchPrefix)[1].substr(1).slice(0, -1)

    expect(title.replaceAll('"', '\\"')).toBe(searchTerm)

})