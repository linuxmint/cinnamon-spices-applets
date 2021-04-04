const { getDBusProxyWithOwnerAsync, getDBusPropertiesAsync, getDBusAsync } = imports.misc.interfaces;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;

const { file_new_for_path } = imports.gi.Gio;
const { find_program_in_path } = imports.gi.GLib;
const { get_home_dir } = imports.gi.GLib;

import { MPRIS_PLUGIN_PATH } from './constants'


export const getDBusProxyWithOwnerPromise = function (name: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // ts is complaining when using ...Object.values(arguments)
        getDBusProxyWithOwnerAsync(name, path, (p: any, e: Error) => {
            resolve(p)
        })
    })
}


export const getDBusPropertiesPromise = function (name: string, path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // ts is complaining when using ...Object.values(arguments)
        getDBusPropertiesAsync(name, path, (p: any, e: Error) => {
            resolve(p)
        })
    })
}

export const getDBusPromise = function (): Promise<any> {
    return new Promise((resolve, reject) => {
        getDBusAsync((p: any, e: Error) => {
            resolve(p)
        })
    })
}

export const notifySend = function (notifactionMsg: string) {
    const iconPath = `${__meta.path}/icon.png`;
    spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notifactionMsg + '" -i ' + iconPath);
}


const spawnCommandLinePromise = function (command: string) {
    return new Promise<[stdout: string | null, stderr: string | null, exitCode: number]>((resolve, reject) => {
        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode])
        })
    })
}

export const checkInstallMpv = function () {
    return new Promise<void>(async (resolve, reject) => {
        if (find_program_in_path("mpv")) return resolve()
        if (!find_program_in_path("apturl")) return reject()

        notifySend("Please also install the mpv package.")

        const [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            apturl apt://mpv`
        )

        // exitCode 0 means sucessfully. See: man apturl
        return (exitCode === 0) ? resolve() : reject(stderr)

    })
}

export const checkInstallMrisPlugin = function () {
    const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so"

    return new Promise<void>(async (resolve, reject) => {


        if (file_new_for_path(MPRIS_PLUGIN_PATH).query_exists(null)) {
            return resolve()
        }

        let [stderr, stdout, exitCode] = await spawnCommandLinePromise(
            `python3  ${__meta.path}/download-dialog-mpris.py`
        )

        if (stdout.trim() !== 'Continue') { return reject() }

        [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            wget ${MPRIS_PLUGIN_URL} -O ${MPRIS_PLUGIN_PATH}`);

        // Wget always prints to stderr - exitcode 0 means it was sucessfull 
        // see:  https://stackoverflow.com/questions/13066518/why-does-wget-output-to-stderr-rather-than-stdout
        // and https://www.gnu.org/software/wget/manual/html_node/Exit-Status.html
        return (exitCode === 0) ? resolve() : reject(stderr)

    })
}

export const checkInstallYoutubeDl = async function () {

    return new Promise<void>(async (resolve, reject) => {
        const [error, version] = await spawnCommandLinePromise('youtube-dl --version')
        if (version && version.trim() === "2021.02.10") return resolve()

        if (!find_program_in_path("apturl")) {
            notifySend("Not the correct version of youtube-dl installed. Please install youtube-dl 2021.02.04.1")
            return reject()
        }

        const [stderr, stdout, errMessage] = await spawnCommandLinePromise(
            `python3  ${__meta.path}/download-dialog-youtube-dl.py`
        )
        if (stdout.trim() !== 'Continue') return reject()

        await spawnCommandLinePromise(
            `${__meta.path}/install-latest-youtube-dl.sh`)

        return resolve()

    })

}


export const downloadSongFromYoutube = async function (song: string, downloadDir: string) {

    if (!song) return

    // when using the default value of the settings, the dir starts with ~ what can't be understand when executing command. Else it starts with file:// what youtube-dl can't handle. Saving to network directories (e.g. ftp) doesn't work 
    const music_dir_absolut =
        downloadDir.replace('~', get_home_dir()).replace('file://', '')


    const downloadCommand = `youtube-dl -o "${music_dir_absolut}/%(title)s.%(ext)s"  --extract-audio --audio-format mp3 ytsearch1:"${song.replace('"', '\"')}" --add-metadata --embed-thumbnail`

    try {
        await checkInstallYoutubeDl()

        notifySend(`Downloading ${song} ...`)

        const [error, stdout] = await spawnCommandLinePromise(downloadCommand)

        if (error) throw new Error(error)

        const arrayOfLines = stdout.match(/[^\r\n]+/g);
        // there is only one line in stdout which gives the path of the downloaded mp3. This start with [ffmpeg] Destination ...
        const searchString = '[ffmpeg] Destination: '
        const filePath = (arrayOfLines.find(line => line.includes(searchString)).split(searchString))[1]

        if (!filePath) throw new Error("couldn't download song")

        notifySend(`download finished. File saved to ${filePath}`)


    } catch (error) {
        const notifyMsg = ("Couldn't download song from Youtube due to an Error.")
        notifySend(notifyMsg + "See Logs for more information")
        global.logError(`${notifyMsg} The following error occured: ${error} `)
    }



}