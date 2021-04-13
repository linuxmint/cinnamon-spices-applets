import { notifySend } from "functions/notify";
import { spawnCommandLinePromise } from "functions/promiseHelpers";

import { MPRIS_PLUGIN_PATH, MPRIS_PLUGIN_URL } from 'CONSTANTS'

const { file_new_for_path } = imports.gi.Gio;
const { find_program_in_path } = imports.gi.GLib;

export function checkInstallMpv() {
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

export function checkInstallMrisPlugin() {
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

