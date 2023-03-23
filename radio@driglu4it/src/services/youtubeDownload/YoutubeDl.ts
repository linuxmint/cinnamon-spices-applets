import {
  YouTubeDownloadServiceProps,
  YouTubeDownloadServiceReturnType,
} from "./YoutubeDownloadManager";
const { spawnCommandLineAsyncIO } = imports.misc.util;

export function downloadWithYouTubeDl(
  props: YouTubeDownloadServiceProps
): YouTubeDownloadServiceReturnType {
  const { downloadDir, title, onFinished, onSuccess, onError } = props;

  let hasBeenCancelled = false;

  // ytsearch option found here https://askubuntu.com/a/731511/1013434 (not given in the youtube-dl docs ...)
  const downloadCommand = `youtube-dl --output "${downloadDir}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replaceAll(
    '"',
    '\\"'
  )}" --add-metadata --embed-thumbnail`;

  const process = spawnCommandLineAsyncIO(downloadCommand, (stdout, stderr) => {
    onFinished();

    if (hasBeenCancelled) {
      hasBeenCancelled = false;
      return;
    }

    if (stdout) {
      onSuccess();
      return;
    }

    if (stderr) {
      onError(stderr, downloadCommand);
      return;
    }
  });

  function cancel() {
    hasBeenCancelled = true;
    // it seems to be no problem to call this even after the process has already finished
    process.force_exit();
  }

  return { cancel };
}
