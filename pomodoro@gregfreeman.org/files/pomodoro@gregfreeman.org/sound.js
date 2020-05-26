const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Params = imports.misc.params;

/**
 *
 * The functions in /usr/share/cinnamon/js/misc/util.js
 * don't return the pid, we need the pid so we can stop sounds
 *
 * @param {string} command
 * @returns {number} process id
 */
function spawnCommandAndGetPid(command) {
    let flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL  | GLib.SpawnFlags.STDERR_TO_DEV_NULL;
    let argv = GLib.shell_parse_argv(command)[1];
    let pid = GLib.spawn_async(null, argv, null, flags, null, null)[1];

    return pid;
}

function addPathIfRelative(soundPath, basePath) {
    if (soundPath.indexOf('file://') === 0) {
        soundPath = soundPath.substring(7);
    }

    // user set a custom absolute path, so lets use that
    if (soundPath.substring(0, 1) == '/') {
        return soundPath;
    }

    let fullPath = '';

    if (basePath) {
        fullPath += basePath + '/';
    }

    fullPath += soundPath;

    return fullPath;
}

function isPlayable() {
    return GLib.find_program_in_path('play') != null;
}

function SoundEffect(soundPath) {
    this._init(soundPath);
}

SoundEffect.prototype = {
    _init: function(soundPath) {
        this._pid = null;

        this.setSoundPath(soundPath);
    },

    setSoundPath: function(soundPath) {
        let isPlayable = this._playerExists();

        if (!GLib.file_test(soundPath, GLib.FileTest.EXISTS)) {
            isPlayable = false;
            global.logError(soundPath + " is not playable");
        }

        this._isPlayable = isPlayable;
        this._soundPath = soundPath;
    },

    /**
     * @param {Object} [params] Parameters
     * @param {boolean} [params.loop=false] play the sound in loop
     * @param {boolean} [params.preview=false] only play a 2 seconds preview of the sound
     * @param {number} [params.volume=1] sound volume from 0 to 1
     * @private
     */
    play: function(params) {
        if (!this._isPlayable) {
            return false;
        }

        if (null != this._pid) {
            this.stop();
        }

        params = Params.parse(params, { preview: false, volume: 1, loop: false });

        let command = "play";

        // Volume
        command += " --volume %.2f".format(params.volume);

        // File to play
        command += " -q %s".format(GLib.shell_quote(this._soundPath));

        if (params.loop) {
            command += " repeat 9999";
        }

        if (params.preview) {
            command += " trim 0 00:00:02.0";
        }

        this._pid = spawnCommandAndGetPid(command);

        return true;
    },

    playOnce: function() {
        return this.play();
    },

    stop: function() {
        if (null == this._pid) {
            return;
        }

        let command = 'kill -9 %d'.format(this._pid);
        Util.trySpawnCommandLine(command);

        this._pid = null;
    },

    isPlaying: function() {
        return this._pid != null;
    },

    getSoundPath: function() {
        return this._soundPath;
    }
};

SoundEffect.prototype._playerExists = isPlayable;