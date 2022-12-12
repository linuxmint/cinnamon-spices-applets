import {
  YouTubeDownloadServiceProps,
  YouTubeDownloadServiceReturnType,
} from "./YoutubeDownloadManager";
const { spawnCommandLineAsyncIO } = imports.misc.util;

// TODO: there are some redudances with downloadWithYouTubeDl.
export function downloadWithYtDlp(
  props: YouTubeDownloadServiceProps
): YouTubeDownloadServiceReturnType {
  const { downloadDir, title, onFinished, onSuccess, onError } = props;

  let hasBeenCancelled = false;

  const downloadCommand = `yt-dlp --output "${downloadDir}/%(title)s.%(ext)s" --extract-audio --audio-format mp3 ytsearch1:"${title.replaceAll(
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
    process.force_exit();
  }

  return { cancel };
}
