import { CANCEL_ICON_NAME, COPY_ICON_NAME, DOWNLOAD_ICON_NAME } from "../../../consts";
import { createControlBtn } from "./ControlBtn";
import { addDownloadingSongsChangeListener, cancelDownload, downloadSongFromYouTube, getCurrentDownloadingSongs } from "../../../services/youtubeDownload/YoutubeDownloadManager";
import { mpvHandler } from "../../../services/mpv/MpvHandler";


export function createDownloadButton() {

    const getState = () => {
        const currentTitle = mpvHandler.getCurrentTitle()
        const currentTitleIsDownloading = getCurrentDownloadingSongs().some(downloadingSong => downloadingSong === currentTitle)

        return { currentTitle, currentTitleIsDownloading }
    }

    const handleBtnClicked = () => {

        const { currentTitleIsDownloading, currentTitle } = getState()

        if (!currentTitle) return // this should actually never happe

        currentTitleIsDownloading ? cancelDownload(currentTitle) : downloadSongFromYouTube(currentTitle)

    }


    const downloadButton = createControlBtn({
        onClick: handleBtnClicked
    })

    const setRefreshBtn = () => {

        const { currentTitle, currentTitleIsDownloading } = getState()
        const iconName = currentTitleIsDownloading ? CANCEL_ICON_NAME : DOWNLOAD_ICON_NAME
        const tooltipTxt = currentTitleIsDownloading ? `Cancel downloading ${currentTitle}` : "Download current song from YouTube"

        downloadButton.icon.set_icon_name(iconName)
        downloadButton.tooltip.set_text(tooltipTxt)

    }


    setRefreshBtn()

    addDownloadingSongsChangeListener(setRefreshBtn)
    mpvHandler.addTitleChangeHandler(setRefreshBtn)

    return downloadButton.actor
}