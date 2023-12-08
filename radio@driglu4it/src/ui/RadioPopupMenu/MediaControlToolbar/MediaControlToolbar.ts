import { createPlayPauseButton } from "./PlayPauseButton";
import { createCopyButton } from './CopyButton'
import { createStopBtn } from "./StopButton";
import { createDownloadButton } from "./DownloadButton";

const { BoxLayout } = imports.gi.St
const { ActorAlign } = imports.gi.Clutter

export const createMediaControlToolbar = () => {

    const toolbar = new BoxLayout({
        style_class: "radio-applet-media-control-toolbar", // todo is the style class needed??
        x_align: ActorAlign.CENTER
    });

    const playPauseBtn = createPlayPauseButton();
    const copyBtn = createCopyButton();
    const stopBtn = createStopBtn();
    const downloadBtn = createDownloadButton();

    [playPauseBtn, downloadBtn, copyBtn, stopBtn].forEach(btn =>
        toolbar.add_child(btn)
    )

    return toolbar
}
