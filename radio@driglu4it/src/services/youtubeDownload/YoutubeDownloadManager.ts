import { APPLET_SITE } from "../../consts";
import { notify, notifyError } from "../../lib/notify";
import { YoutubeClis } from "../../types";
import { configs } from "../Config";
import { downloadWithYoutubeDl } from "./YoutubeDl";
import { downloadWithYtDlp } from "./YtDlp";

const { spawnCommandLine } = imports.misc.util
const { get_tmp_dir, get_home_dir } = imports.gi.GLib
const { File, FileCopyFlags } = imports.gi.Gio

export interface YoutubeDownloadServiceProps {
    downloadDir: string
    title: string
    onFinished: () => void,
    onSuccess: (downloadPath: string) => void,
    onError: (errorMessage: string, downloadCommand: string) => void
}

export interface YoutubeDownloadServiceReturnType {
    cancel: () => void
}

interface DownloadProcess {
    songTitle: string,
    cancelDownload: () => void
}

const notifyYoutubeDownloadFailed = (props: { youtubeCli: YoutubeClis, errorMessage: string }) => {

    const { youtubeCli, errorMessage } = props

    notifyError(`Couldn't download Song from Youtube due to an Error. Make Sure you have the newest version of ${youtubeCli} installed. 
    \n<b>Important:</b> Don't use apt for the installation but follow the installation instruction given on the Radio Applet Site in the Cinnamon Store instead`, errorMessage, {
        additionalBtns: [
            {
                text: 'View Installation Instruction',
                onClick: () => spawnCommandLine(`xdg-open ${APPLET_SITE} `)
            }
        ]
    })
}

const notifyYoutubeDownloadStarted = (title: string) => {
    notify(`Downloading ${title} ...`, {
        buttons: [
            {
                text: 'Cancel',
                onClick: () => cancelDownload(title)
            }
        ]
    })
}

const notifyYoutubeDownloadFinished = (props: { downloadPath: string, fileAlreadyExist?: boolean }) => {
    const {
        downloadPath,
        fileAlreadyExist = false
    } = props

    notify(
        fileAlreadyExist ?
            'Downloaded Song not saved as a file with the same name already exists' :
            `Download finished. File saved to ${downloadPath}`,
        {
            isMarkup: true,
            transient: false,
            buttons: [
                {
                    text: 'Play',
                    onClick: () => spawnCommandLine(`xdg-open '${downloadPath}'`)
                }
            ]
        }
    )
}

let downloadProcesses: DownloadProcess[] = []

const downloadingSongsChangedListener: ((downloadingSongs: DownloadProcess[]) => void)[] = []

export function downloadSongFromYoutube(title: string) {

    const downloadDir = configs.settingsObject.musicDownloadDir
    const youtubeCli = configs.settingsObject.youtubeCli

    const music_dir_absolut = downloadDir.charAt(0) === '~' ?
        downloadDir.replace('~', get_home_dir()) : downloadDir

    if (!title) return

    const sameSongIsDownloading = downloadProcesses.find(process => {
        return process.songTitle === title
    })

    if (sameSongIsDownloading)
        return

    const downloadProps: YoutubeDownloadServiceProps = {
        title,
        downloadDir: get_tmp_dir(),
        onError: (errorMessage, downloadCommand: string,) => {
            notifyYoutubeDownloadFailed({ youtubeCli, errorMessage: `The following error occured at youtube download attempt: ${errorMessage}. The used download Command was: ${downloadCommand}` })
        },
        onFinished: () => {
            downloadProcesses = downloadProcesses.filter(downloadingSong => downloadingSong.songTitle !== title)
            downloadingSongsChangedListener.forEach(listener => listener(downloadProcesses))
        },
        onSuccess: (downloadPath) => {
            const tmpFile = File.new_for_path(downloadPath)
            const fileName = tmpFile.get_basename()
            const targetPath = `${music_dir_absolut}/${fileName}`
            const targetFile = File.parse_name(targetPath)

            if (targetFile.query_exists(null)) {
                notifyYoutubeDownloadFinished({ downloadPath: targetPath, fileAlreadyExist: true })
                return
            }

            try {
                // @ts-ignore
                tmpFile.move(File.parse_name(targetPath), FileCopyFlags.BACKUP, null, null)
                notifyYoutubeDownloadFinished({ downloadPath: targetPath })

            } catch (error) {
                const errorMessage = error instanceof imports.gi.GLib.Error ? error.message : 'Unknown Error Type'
                notifyYoutubeDownloadFailed({ youtubeCli, errorMessage: `Failed to copy download from tmp dir. The following error occurred: ${errorMessage}` })
            }

        }
    }

    const { cancel } = youtubeCli === 'youtube-dl' ?
        downloadWithYoutubeDl(downloadProps) :
        downloadWithYtDlp(downloadProps)

    notifyYoutubeDownloadStarted(title)

    downloadProcesses.push({ songTitle: title, cancelDownload: cancel })
    downloadingSongsChangedListener.forEach(listener => listener(downloadProcesses))
}

export const getCurrentDownloadingSongs = () => {
    return downloadProcesses.map((downloadingSong) => downloadingSong.songTitle)
}

export const cancelDownload = (songTitle: string) => {
    const downloadProcess = downloadProcesses.find((process) => process.songTitle === songTitle)

    if (!downloadProcess) {
        global.logWarning(`can't cancel download for song ${songTitle} as it seems that the song is currently not downloading`)
        return
    }
    downloadProcess.cancelDownload()
}

export function addDownloadingSongsChangeListener(callback: (downloadingSongs: DownloadProcess[]) => void) {
    downloadingSongsChangedListener.push(callback)
}
