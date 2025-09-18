import { APPLET_SITE } from "../../consts";
import { notify, notifyError } from "../../lib/notify";
import { YouTubeClis } from "../../types";
import { configs } from "../Config";
import { downloadWithYouTubeDl } from "./YoutubeDl";
import { downloadWithYtDlp } from "./YtDlp";

const { spawnCommandLine } = imports.misc.util;
const { get_home_dir, dir_make_tmp, DateTime } = imports.gi.GLib;
const { File, FileCopyFlags, FileQueryInfoFlags } = imports.gi.Gio;

export interface YouTubeDownloadServiceProps {
  downloadDir: string;
  title: string;
  onFinished: () => void;
  onSuccess: (downloadCommand: string) => void;
  onError: (errorMessage: string, downloadCommand: string) => void;
}

export interface YouTubeDownloadServiceReturnType {
  cancel: () => void;
}

interface DownloadProcess {
  songTitle: string;
  cancelDownload: () => void;
}

const notifyYouTubeDownloadFailed = (props: {
  youtubeCli: YouTubeClis;
  errorMessage: string;
}) => {
  const { youtubeCli, errorMessage } = props;

  notifyError(
    `Couldn't download Song from YouTube due to an Error. Make Sure you have the newest version of ${youtubeCli} installed. 
    \n<b>Important:</b> Don't use apt for the installation but follow the installation instruction given on the Radio Applet Site in the Cinnamon Store instead.
    \nReview the logs for more information`,
    errorMessage,
    {
      additionalBtns: [
        {
          text: "View Installation Instruction",
          onClick: () => spawnCommandLine(`xdg-open ${APPLET_SITE} `),
        },
        {
          text: "View Logs", 
          onClick: () => spawnCommandLine(`xdg-open ~/.xsession-errors`),
        }
      ],
    }
  );
};

const notifyYouTubeDownloadStarted = (title: string) => {
  notify(`Downloading ${title} ...`, {
    buttons: [
      {
        text: "Cancel",
        onClick: () => cancelDownload(title),
      },
    ],
  });
};

const notifyYouTubeDownloadFinished = (props: {
  downloadPath: string;
  fileAlreadyExist?: boolean;
}) => {
  const { downloadPath, fileAlreadyExist = false } = props;

  notify(
    fileAlreadyExist
      ? "Downloaded Song not saved as a file with the same name already exists"
      : `Download finished. File saved to ${downloadPath}`,
    {
      isMarkup: true,
      transient: false,
      buttons: [
        {
          text: "Play",
          onClick: () => spawnCommandLine(`xdg-open '${downloadPath.replaceAll("'", "'\\''")}'`),
        },
      ],
    }
  );
};

let downloadProcesses: DownloadProcess[] = [];

const downloadingSongsChangedListener: ((
  downloadingSongs: DownloadProcess[]
) => void)[] = [];

export function downloadSongFromYouTube(title: string) {
  const downloadDir = configs.settingsObject.musicDownloadDir;
  const youtubeCli = configs.settingsObject.youtubeCli;

  const music_dir_absolut =
    downloadDir.charAt(0) === "~"
      ? downloadDir.replace("~", get_home_dir())
      : downloadDir;

  if (!title) return;

  const sameSongIsDownloading = downloadProcesses.find((process) => {
    return process.songTitle === title;
  });

  if (sameSongIsDownloading) return;

  const tmpDirPath = dir_make_tmp(null);

  const downloadProps: YouTubeDownloadServiceProps = {
    title,
    downloadDir: tmpDirPath,
    onError: (errorMessage, downloadCommand: string) => {
      notifyYouTubeDownloadFailed({
        youtubeCli,
        errorMessage: `The following error occured at youtube download attempt: ${errorMessage}. The used download Command was: ${downloadCommand}`,
      });
    },
    onFinished: () => {
      downloadProcesses = downloadProcesses.filter(
        (downloadingSong) => downloadingSong.songTitle !== title
      );
      downloadingSongsChangedListener.forEach((listener) =>
        listener(downloadProcesses)
      );
    },
    onSuccess: (downloadCommand) => {
      moveFileFromTmpDir({
        targetDirPath: music_dir_absolut,
        tmpDirPath,
        onFileMoved: (props) => {
          const { fileAlreadyExist, targetFilePath } = props;

          updateFileModifiedTime(targetFilePath);

          notifyYouTubeDownloadFinished({
            downloadPath: targetFilePath,
            fileAlreadyExist,
          });
        },
        onError: (errorMessage) => {
          notifyYouTubeDownloadFailed({
            youtubeCli,
            errorMessage: `Failed to copy download from tmp dir. The following error occurred: ${errorMessage}. The tmp dir Path is: ${tmpDirPath}. The download command is: ${downloadCommand}`,
          });
        },
      });
    },
  };

  const { cancel } =
    youtubeCli === "youtube-dl"
      ? downloadWithYouTubeDl(downloadProps)
      : downloadWithYtDlp(downloadProps);

  notifyYouTubeDownloadStarted(title);

  downloadProcesses.push({ songTitle: title, cancelDownload: cancel });
  downloadingSongsChangedListener.forEach((listener) =>
    listener(downloadProcesses)
  );
}

const moveFileFromTmpDir = (props: {
  tmpDirPath: string;
  targetDirPath: string;
  onFileMoved: (props: {
    targetFilePath: string;
    fileAlreadyExist: boolean;
  }) => void;
  onError: (error: string) => void;
}) => {
  const { tmpDirPath, targetDirPath, onFileMoved, onError } = props;

  try {
    const fileName = File.new_for_path(tmpDirPath)
      .enumerate_children(
        "standard::*",
        FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        null
      )
      .next_file(null)
      ?.get_name();

    if (!fileName) {
      throw new Error(`filename couldn't be determined.This seems to be a problem with the used Youtube Download Cli tool.`);
    }

    const tmpFile = File.new_for_path(`${tmpDirPath}/${fileName}`);
    if (tmpFile.get_path()?.endsWith(".webp")){
      throw new Error("Only the cover image has been downloaded. This seems to be a problem with the used Youtube Download Cli tool.")
    }

    if (!File.new_for_uri(targetDirPath).query_exists(null) && !File.new_for_path(targetDirPath).query_exists(null)) {
      throw new Error("The Download Directory specified in the settings doesn't exist. Please create it manually or change the settings.");
    }

    const targetFilePath = `${targetDirPath}/${fileName}`;
    const targetFile = File.parse_name(targetFilePath);


    if (targetFile.query_exists(null)) {
      onFileMoved({ targetFilePath, fileAlreadyExist: true });
      return;
    }

    tmpFile.move(
      File.parse_name(targetFilePath),
      FileCopyFlags.BACKUP,
      null,
      null
    );
    onFileMoved({ targetFilePath, fileAlreadyExist: false });
  } catch (error) {
    const errorMessage =
      error instanceof imports.gi.GLib.Error ? error.message : error;

    onError(errorMessage as string);
  }
};

export const getCurrentDownloadingSongs = () => {
  return downloadProcesses.map((downloadingSong) => downloadingSong.songTitle);
};

export const cancelDownload = (songTitle: string) => {
  const downloadProcess = downloadProcesses.find(
    (process) => process.songTitle === songTitle
  );

  if (!downloadProcess) {
    global.logWarning(
      `can't cancel download for song ${songTitle} as it seems that the song is currently not downloading`
    );
    return;
  }
  downloadProcess.cancelDownload();
};

/** for some reasons the downloaded files have by default a weird modified time stamp (this is neither the time the file has been created locally nor any metadata about the song), which makes it hard (impossible?) to sort the songs by last recently added.  */
const updateFileModifiedTime = (filePath: string) => {
  spawnCommandLine(
    `touch ${filePath
      .replaceAll("'", "\\'")
      .replaceAll(" ", "\\ ")
      .replaceAll('"', '\\"')}`
  );

  // TODO: this would be better but for some reasons it doesn't work:
  // const file = File.new_for_path(filePath);
  // const fileInfo = file.query_info(
  //   "standard::*",
  //   FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
  //   null
  // );
  // const now = DateTime.new_now_local();
  // fileInfo.set_modification_date_time(now);
};

export function addDownloadingSongsChangeListener(
  callback: (downloadingSongs: DownloadProcess[]) => void
) {
  downloadingSongsChangedListener.push(callback);
}
