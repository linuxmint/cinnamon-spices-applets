import {  YoutubeDownloadServiceProps, YoutubeDownloadServiceReturnType } from "./YoutubeDownloadManager";
const { spawnCommandLineAsyncIO } = imports.misc.util;


export function downloadWithYoutubeDl(props: YoutubeDownloadServiceProps): YoutubeDownloadServiceReturnType {
    const { downloadDir, title, onFinished, onSuccess, onError } = props

    let hasBeenCancelled = false

    // ytsearch option found here https://askubuntu.com/a/731511/1013434 (not given in the youtube-dl docs ...)
    const downloadCommand = `youtube-dl --output "${downloadDir}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replaceAll('"', '\\\"')}" --add-metadata --embed-thumbnail`


    const process = spawnCommandLineAsyncIO(downloadCommand, (stdout, stderr) => {

        onFinished()

        if (hasBeenCancelled) {
            hasBeenCancelled = false
            return
        }

        if (stdout) {
            const downloadPath = getDownloadPath(stdout)

            if (!downloadPath) {
                onError('downloadPath could not be determined from stdout. Most likely the download has failed', downloadCommand)
                return
            }

            onSuccess(downloadPath)
            return
        }

        if (stderr) {
            onError(stderr, downloadCommand)
            return
        }
    })


    function cancel() {
        hasBeenCancelled = true
        // it seems to be no problem to call this even after the process has already finished
        process.force_exit()
    }

    return { cancel }

}

function getDownloadPath(stdout: string) {
    const arrayOfLines = stdout.match(/[^\r\n]+/g);

    // there is only one line in stdout which gives the path of the downloaded mp3. This start with [ffmpeg] Destination ...
    const searchString = '[ffmpeg] Destination: '

    return arrayOfLines?.find(line => line.includes(searchString))
        ?.split(searchString)[1]
}