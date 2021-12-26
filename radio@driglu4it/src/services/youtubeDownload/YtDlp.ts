import { YoutubeDownloadServiceProps, YoutubeDownloadServiceReturnType } from "./YoutubeDownloadManager";
const { spawnCommandLineAsyncIO } = imports.misc.util;


export function downloadWithYtDlp(props: YoutubeDownloadServiceProps): YoutubeDownloadServiceReturnType {
    const { downloadDir, title, onFinished, onSuccess, onError } = props

    let hasBeenCancelled = false

    const downloadCommand = `yt-dlp --output "${downloadDir}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replaceAll('"', '\\\"')}" --add-metadata --embed-thumbnail`

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
        process.force_exit()
    }

    return { cancel }
}

function getDownloadPath(stdout: string) {
    const arrayOfLines = stdout.match(/[^\r\n]+/g);

    const searchString = '[ExtractAudio] Destination: '

    return arrayOfLines?.find(line => line.includes(searchString))
        ?.split(searchString)[1]
}