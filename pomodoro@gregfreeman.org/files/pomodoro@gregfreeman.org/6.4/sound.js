const Util = imports.misc.util;
const GLib = imports.gi.GLib;

/**
 * Spawns a command and returns the process ID (PID) of the spawned process.
 * If the command could not be spawned or no PID is available, null is returned.
 *
 * @param {string} command - The command to be spawned.
 * @returns {number|null} The process ID (PID) of the spawned process, or null if no PID is available or the command could not be spawned.
 */
function spawnCommandAndGetPid(command) {
    const flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL | GLib.SpawnFlags.STDERR_TO_DEV_NULL;
    const argv = GLib.shell_parse_argv(command)[1];
    let pid = null;

    try {
        const [success, spawnedPid] = GLib.spawn_async(null, argv, null, flags, null);
        if (!success) {
            global.logError("Failed to spawn command: " + command);
            return null;
        }
        pid = spawnedPid;
    } catch (error) {
        global.logError("Exception when spawning command: " + command + ", error: " + error.message);
        return null;
    }

    return pid; // Return the PID of the successfully spawned process.
}

function addPathIfRelative(soundPath, basePath) {
    if (soundPath.startsWith('file://')) {
        soundPath = soundPath.substring(7);
    }
    if (soundPath.startsWith('/')) {
        return soundPath;
    }
    let fullPath = basePath ? `${basePath}/` : '';
    fullPath += soundPath;
    return fullPath;
}

function isPlayable() {
    return GLib.find_program_in_path('play') !== null;
}

class SoundEffect {
    constructor(soundPath) {
        this._pid = null;
        this.setSoundPath(soundPath);
    }

    setSoundPath(soundPath) {
        let isPlayable = this._playerExists();
        if (!GLib.file_test(soundPath, GLib.FileTest.EXISTS)) {
            isPlayable = false;
            global.logError(`${soundPath} is not playable`);
        }
        this._isPlayable = isPlayable;
        this._soundPath = soundPath;
    }

    /**
     * Plays a sound with the given parameters.
     *
     * @param {Object} params - An object containing the parameters for the sound.
     * @param {boolean} params.preview - If true, plays a preview of the sound for 2 seconds. Default is false.
     * @param {number} params.volume - The volume at which to play the sound between 0 and 1. Default is 1.
     * @param {boolean} params.loop - If true, loops the sound. Default is false.
     * @returns {boolean} True if the sound was successfully played, false otherwise.
     */
    play(params = { preview: false, volume: 1, loop: false }) {
        if (!this._isPlayable) {
            return false;
        }
        if (this._pid !== null) {
            this.stop();
        }
        let command = `play --volume ${params.volume.toFixed(2)} -q ${GLib.shell_quote(this._soundPath)}`;
        if (params.loop) {
            command += " repeat 9999";
        }
        if (params.preview) {
            command += " trim 0 00:00:02.0";
        }
        this._pid = spawnCommandAndGetPid(command);
        if (this._pid === null) {
            return false;
        }
        return true;
    }

    playOnce() {
        return this.play();
    }

    stop() {
        if (this._pid === null) {
            return;
        }
        const command = `kill -9 ${this._pid}`;
        Util.trySpawnCommandLine(command);
        this._pid = null;
    }

    isPlaying() {
        return this._pid !== null;
    }

    getSoundPath() {
        return this._soundPath;
    }

    _playerExists() {
        return isPlayable();
    }
}
