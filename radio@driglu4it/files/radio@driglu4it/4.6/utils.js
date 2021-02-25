const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { getDBusProxyWithOwnerAsync, getDBusPropertiesAsync, getDBusAsync } = imports.misc.interfaces;

const { file_new_for_path } = imports.gi.Gio;
const { find_program_in_path } = imports.gi.GLib;

var timeLastNotification = 0
var lastNotificationMsg = ""

const spawnCommandLinePromise = function (command) {
    return new Promise((resolve, reject) => {
        spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            (stdout) ? resolve([null, stdout, 0]) : resolve([stderr, null, exitCode])
        })
    })
}

// sends a notification but only if there hasn't been already the same notification in the last 10 seks
const notifySend = function (notificationMsg) {
    const currentTime = Date.now()

    const timeDiff = currentTime - timeLastNotification

    if (timeDiff < 10000 && lastNotificationMsg === notificationMsg) return
    const iconPath = `${__meta.path}/icon.png`;
    spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notificationMsg + '" -i ' + iconPath);

    timeLastNotification = currentTime
    lastNotificationMsg = notificationMsg
}

const checkInstallMprisPlugin = function (targetPath) {
    const MPRIS_PLUGIN_URL = "https://github.com/hoyon/mpv-mpris/releases/download/0.5/mpris.so"

    return new Promise(async (resolve, reject) => {

        if (file_new_for_path(targetPath).query_exists(null)) return resolve()
        let [stderr, stdout, exitCode] = await spawnCommandLinePromise(
            `python3  ${__meta.path}/download-dialog-mpris.py`
        )

        if (stdout.trim() !== 'Continue') { return reject() }


        [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
                 wget ${MPRIS_PLUGIN_URL} -O ${targetPath}`);

        // Wget always prints to stderr - exitcode 0 means it was sucessfull 
        // see:  https://stackoverflow.com/questions/13066518/why-does-wget-output-to-stderr-rather-than-stdout
        // and https://www.gnu.org/software/wget/manual/html_node/Exit-Status.html
        return (exitCode === 0) ? resolve() : reject(stderr)

    })
}

const checkInstallMpv = function (packageName) {
    return new Promise(async (resolve, reject) => {

        if (find_program_in_path("mpv")) return resolve()

        if (!find_program_in_path("apturl")) return reject()

        notifySend(_("Please also install the '%s' package.").format("mpv"))

        const [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            apturl apt://mpv`
        )
        // exitCode 0 means sucessfully see: man apturl
        return (exitCode === 0) ? resolve() : reject(stderr)

    })
}

const checkInstallYoutubeDl = function () {
    return new Promise(async (resolve, reject) => {

        const [error, version] = await spawnCommandLinePromise('youtube-dl --version')
        if (version && version.trim() === "2021.02.04.1") return resolve()

        if (!find_program_in_path("apturl")) return reject()

        const [stderr, stdout, errMessage] = await spawnCommandLinePromise(
            `python3  ${__meta.path}/download-dialog-youtube-dl.py`
        )
        if (stdout.trim() !== 'Continue') return reject()

        await spawnCommandLinePromise(
            `${__meta.path}/install-latest-youtube-dl.sh`)

        return resolve()

    })
}

const downloadFromYoutube = function (dir, searchTerm) {

    const downloadCommand = `youtube-dl -o "${dir}/%(title)s.%(ext)s"  --extract-audio --audio-format mp3 ytsearch1:"${searchTerm.replace('"', '\"')}" --add-metadata --embed-thumbnail`

    return new Promise(async (resolve, reject) => {

        const [error, stdout] = await spawnCommandLinePromise(downloadCommand)

        if (error) { return reject(error) }

        const arrayOfLines = stdout.match(/[^\r\n]+/g);
        // there is only one line in stdout which gives the path of the downloaded mp3. This start with [ffmpeg] Destination ...
        const searchString = '[ffmpeg] Destination: '
        const filePath = (arrayOfLines.find(line => line.includes(searchString)).split(searchString))[1]

        filePath ? resolve(filePath) : reject("couldn't get filePath")
    })

}

// TODO error handling
const getDBusProxyWithOwnerPromise = function (name, path) {
    return new Promise((resolve, reject) => {
        getDBusProxyWithOwnerAsync(...Object.values(arguments), (p, e) => {
            resolve(p)
        })
    })
}

const getDBusPropertiesPromise = function (name, path) {
    return new Promise((resolve, reject) => {
        getDBusPropertiesAsync(...Object.values(arguments), (p, e) => {
            resolve(p)
        })
    })
}

const getDBusPromise = function () {
    return new Promise((resolve, reject) => {
        getDBusAsync((p, e) => {
            resolve(p)
        })
    })
}
