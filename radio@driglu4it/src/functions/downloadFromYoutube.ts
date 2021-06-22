const { spawnCommandLineAsyncIO } = imports.misc.util;
const { get_home_dir } = imports.gi.GLib;

interface Arguments {
    title: string,
    downloadDir: string,
    onDownloadFinished: (path: string) => void,
    onDownloadFailed: () => void
}

export function downloadSongFromYoutube(args: Arguments) {

    const {
        title,
        downloadDir,
        onDownloadFinished,
        onDownloadFailed
    } = args

    let hasBeenCancelled = false

    // when using the default value of the settings, the dir starts with ~ what can't be understand when executing command. Else it starts with file:// what youtube-dl can't handle. Saving to network directories (e.g. ftp) doesn't work 
    // TODO: Shouldn't this be done in configs(at least replacing ~)? 
    const music_dir_absolut =
        downloadDir.replace('~', get_home_dir()).replace('file://', '')

    const downloadCommand = `
        youtube-dl --output "${music_dir_absolut}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replace('"', '\"')}" --add-metadata --embed-thumbnail`

    const process = spawnCommandLineAsyncIO(downloadCommand, (stdout, stderr) => {

        try {

            if (hasBeenCancelled) {
                hasBeenCancelled = false
                return
            }

            if (stderr) throw new Error(stderr)

            if (stdout) {
                const downloadPath = getDownloadPath(stdout)
                if (!downloadPath) throw new Error('File not saved')

                onDownloadFinished(downloadPath)
            }
        } catch (error) {
            global.logError(`The following error occured at youtube download attempt: ${error}. The used download Command was: ${downloadCommand}`)
            onDownloadFailed()
        }
    })

    function cancel() {
        hasBeenCancelled = true
        // it seems to be no problem to call this after the process has already finished
        process.force_exit()
    }

    return { cancel }
}

function getDownloadPath(stdout: string) {
    const arrayOfLines = stdout.match(/[^\r\n]+/g);

    // there is only one line in stdout which gives the path of the downloaded mp3. This start with [ffmpeg] Destination ...
    const searchString = '[ffmpeg] Destination: '

    return arrayOfLines.find(line => line.includes(searchString))
        .split(searchString)[1]
}