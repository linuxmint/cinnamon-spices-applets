import { spawnCommandLinePromise } from "functions/promiseHelpers";
import { notifySend } from "functions/notify";

const { get_home_dir } = imports.gi.GLib;

export async function downloadSongFromYoutube(song: string, downloadDir: string) {

    if (!song) return

    // when using the default value of the settings, the dir starts with ~ what can't be understand when executing command. Else it starts with file:// what youtube-dl can't handle. Saving to network directories (e.g. ftp) doesn't work 
    const music_dir_absolut =
        downloadDir.replace('~', get_home_dir()).replace('file://', '')


    const downloadCommand = `
        youtube-dl -o "${music_dir_absolut}/%(title)s.%(ext)s"          --extract-audio --audio-format mp3 ytsearch1:"${song.replace('"', '\"')}" --add-metadata --embed-thumbnail`

    try {
        notifySend(`Downloading ${song} ...`)

        const [error, stdout] = await spawnCommandLinePromise(downloadCommand)

        if (error) throw new Error(error)

        const arrayOfLines = stdout.match(/[^\r\n]+/g);
        // there is only one line in stdout which gives the path of the downloaded mp3. This start with [ffmpeg] Destination ...
        const searchString = '[ffmpeg] Destination: '
        const filePath =
            (arrayOfLines.find(line => line.includes(searchString))
                .split(searchString))[1]

        if (!filePath) throw new Error("couldn't download song")

        notifySend(`download finished. File saved to ${filePath}`)


    } catch (error) {
        const notifyMsg = ("Couldn't download song from Youtube due to an Error. Make Sure you have the newest version installed. Visit the Radio Applet Site in the Cinnamon Store for installation instruction")
        notifySend(notifyMsg)
        global.logError(`${notifyMsg} The following error occured: ${error}. The used download Command was: ${downloadCommand}`)
    }
}

