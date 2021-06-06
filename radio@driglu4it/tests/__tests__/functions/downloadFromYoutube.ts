
// @ts-ignore
imports.misc.util.spawnCommandLineAsyncIO = mockCommandLineAsyncIo

import { downloadSongFromYoutube } from "functions/downloadFromYoutube";

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

const mockedDownloadtime = 1 // in ms

function mockCommandLineAsyncIo(command: string, cb: (stdout: string, stderr: string, exitCode: number) =>
    void) {

    const timer = setTimeout(() => {
        youtubeInstalled ? cb(workingExample.stdOut, null, 0) : cb(null, 'line 1: youtube-dl: command not found', 127)
    }, mockedDownloadtime);

    return {
        force_exit: () => {
            clearTimeout(timer)
            cb(null, null, 1)
        }
    }
}

afterEach(() => {
    jest.clearAllMocks()
    youtubeInstalled = false
})

it('sucessful download handled correctly', done => {

    youtubeInstalled = true

    downloadWithValidValues()

    setTimeout(() => {
        expect(onDownloadFinished).toHaveBeenCalledWith(workingExample.filePath)
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
