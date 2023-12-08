import { spawnCommandLinePromise } from "../../functions/promiseHelpers";
import { MPRIS_PLUGIN_PATH, MPRIS_PLUGIN_URL } from '../../consts'
import { notify } from "../../lib/notify";
const { find_program_in_path, file_test, FileTest } = imports.gi.GLib;


export async function installMpvWithMpris() {
    const mprisPluginDownloaded = checkMprisPluginDownloaded()
    const mpvInstalled = checkMpvInstalled()

    !mprisPluginDownloaded && await downloadMrisPluginInteractive()

    if (!mpvInstalled) {
        const notificationText = `Please ${mprisPluginDownloaded ? '' : 'also'} install the mpv package.`
        notify(notificationText)
        await installMpvInteractive()
    }
}

function checkMpvInstalled() {
    return find_program_in_path('mpv')
}

function checkMprisPluginDownloaded() {
    return file_test(MPRIS_PLUGIN_PATH, FileTest.IS_REGULAR)
}

function installMpvInteractive() {
    return new Promise<void>(async (resolve, reject) => {

        if (checkMpvInstalled()) return resolve()

        if (!find_program_in_path("apturl")) return reject()

        const [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            apturl apt://mpv`
        )

        // exitCode 0 means sucessfully. See: man apturl
        return (exitCode === 0) ? resolve() : reject(stderr)
    })
}

function downloadMrisPluginInteractive() {
    return new Promise<void>(async (resolve, reject) => {

        if (checkMprisPluginDownloaded()) {
            return resolve()
        }

        let [stderr, stdout, exitCode] = await spawnCommandLinePromise(
            `python3  ${__meta.path}/download-dialog-mpris.py`
        )

        if (stdout?.trim() !== 'Continue') { return reject() }

        [stderr, stdout, exitCode] = await spawnCommandLinePromise(`
            wget ${MPRIS_PLUGIN_URL} -O ${MPRIS_PLUGIN_PATH}`);

        // Wget always prints to stderr - exitcode 0 means it was sucessfull 
        // see:  https://stackoverflow.com/questions/13066518/why-does-wget-output-to-stderr-rather-than-stdout
        // and https://www.gnu.org/software/wget/manual/html_node/Exit-Status.html
        return (exitCode === 0) ? resolve() : reject(stderr)

    })
}

