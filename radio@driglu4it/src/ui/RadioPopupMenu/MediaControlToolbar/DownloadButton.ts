import { CANCEL_ICON_NAME, COPY_ICON_NAME, DOWNLOAD_ICON_NAME } from "../../../consts";
import { createControlBtn } from "./ControlBtn";
import { addDownloadingSongsChangeListener, downloadingSongs, downloadSongFromYoutube } from "../../../services/youtubeDownload/YoutubeDownloadManager";
import { mpvHandler } from "../../../services/mpv/MpvHandler";


export function createDownloadButton() {

    const handleBtnClicked = () => {
        const currentTitle = mpvHandler.getCurrentTitle()
        if (!currentTitle) return

        const download = getDownloadOfTitle(currentTitle)
        download ? download.cancelDownload() : downloadSongFromYoutube()
    }


    const downloadButton = createControlBtn({
        onClick: handleBtnClicked
    })

    const setRefreshBtn = () => {

        const currentTitle = mpvHandler.getCurrentTitle()

        const currentTitleIsDownloading = !!getDownloadOfTitle(currentTitle)
        const iconName = currentTitleIsDownloading ? CANCEL_ICON_NAME : DOWNLOAD_ICON_NAME
        const tooltipTxt = currentTitleIsDownloading ? `Cancel downloading ${currentTitle}` : "Download current song from Youtube"

        downloadButton.icon.set_icon_name(iconName)
        downloadButton.tooltip.set_text(tooltipTxt)

    }

    const getDownloadOfTitle = (title: string | undefined) => {
        return downloadingSongs.find(downloadingSong => downloadingSong.title === title)
    }

    setRefreshBtn()

    addDownloadingSongsChangeListener(setRefreshBtn)
    mpvHandler.addTitleChangeHandler(setRefreshBtn)

    return downloadButton.actor
}