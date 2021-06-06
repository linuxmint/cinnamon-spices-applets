"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadSongFromYoutube = void 0;
const { spawnCommandLineAsyncIO } = imports.misc.util;
const { get_home_dir } = imports.gi.GLib;
function downloadSongFromYoutube(args) {
    const { title, downloadDir, onDownloadFinished, onDownloadFailed } = args;
    let hasBeenCancelled = false;
    const music_dir_absolut = downloadDir.replace('~', get_home_dir()).replace('file://', '');
    const downloadCommand = `
        youtube-dl --output "${music_dir_absolut}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replace('"', '\"')}" --add-metadata --embed-thumbnail`;
    const process = spawnCommandLineAsyncIO(downloadCommand, (stdout, stderr) => {
        try {
            if (hasBeenCancelled) {
                hasBeenCancelled = false;
                return;
            }
            if (stderr)
                throw new Error(stderr);
            if (stdout) {
                const downloadPath = getDownloadPath(stdout);
                if (!downloadPath)
                    throw new Error('File not saved');
                onDownloadFinished(downloadPath);
            }
        }
        catch (error) {
            global.logError(`The following error occured at youtube download attempt: ${error}. The used download Command was: ${downloadCommand}`);
            onDownloadFailed();
        }
    });
    function cancel() {
        hasBeenCancelled = true;
        process.force_exit();
    }
    return { cancel };
}
exports.downloadSongFromYoutube = downloadSongFromYoutube;
function getDownloadPath(stdout) {
    const arrayOfLines = stdout.match(/[^\r\n]+/g);
    const searchString = '[ffmpeg] Destination: ';
    return arrayOfLines.find(line => line.includes(searchString))
        .split(searchString)[1];
}
