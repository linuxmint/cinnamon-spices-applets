import { addOnAppletMovedCallback } from "../..";
import { configs } from "../../services/Config";
import { mpvHandler } from "../../services/mpv/MpvHandler";
import {
  addDownloadingSongsChangeListener,
  getCurrentDownloadingSongs,
} from "../../services/youtubeDownload/YoutubeDownloadManager";

const { PanelItemTooltip } = imports.ui.tooltips;
const { markup_escape_text } = imports.gi.GLib;

interface Arguments {
  appletContainer: imports.ui.applet.Applet;
}

export function createRadioAppletTooltip(args: Arguments) {
  const { appletContainer } = args;

  const tooltip = new PanelItemTooltip(
    appletContainer,
    undefined,
    __meta.orientation,
  );

  tooltip["_tooltip"].set_style("text-align: left;");

  const getTooltipLines = (): Array<String> => {
    if (mpvHandler.getPlaybackStatus() === "Stopped") {
      const lines = ["Radio++"];
      const lastUrl = configs.settingsObject.lastUrl;

      if (lastUrl) {
        lines.push("");
        lines.push("<b>Hint</b>: Middle click to play last station");
      }

      return lines;
    }

    const lines = [
      `<b>Volume</b>`,
      `${mpvHandler.getVolume()?.toString()} %`,
      "",
      "<b>Songtitle</b>",
      `${markup_escape_text(mpvHandler.getCurrentTitle() || "", -1)}`,
      "",
      "<b>Station</b>",
      `${markup_escape_text(mpvHandler.getCurrentChannelName() || "", -1)} `,
    ];

    const currentDownloadingSongs = getCurrentDownloadingSongs();
    if (currentDownloadingSongs.length !== 0) {
      [
        "",
        "<b>Songs downloading:</b>",
        ...currentDownloadingSongs.map((downloadingSong) =>
          markup_escape_text(downloadingSong, -1),
        ),
      ].forEach((line) => lines.push(line));
    }

    return lines;
  };

  const setRefreshTooltip = () => {
    // @ts-ignore
    tooltip.orientation = __meta.orientation;

    const lines = getTooltipLines();
    const markupTxt = lines.join(`\n`);
    tooltip.set_markup(markupTxt);
  };

  [
    mpvHandler.addVolumeChangeHandler,
    mpvHandler.addPlaybackStatusChangeHandler,
    mpvHandler.addTitleChangeHandler,
    mpvHandler.addChannelChangeHandler,
    addDownloadingSongsChangeListener,
    addOnAppletMovedCallback,
  ].forEach((cb) => cb(setRefreshTooltip));

  setRefreshTooltip();

  return tooltip;
}
