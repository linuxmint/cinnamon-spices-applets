import { createAppletIcon } from "../../lib/AppletIcon";
import { addDownloadingSongsChangeListener } from "../../services/youtubeDownload/YoutubeDownloadManager";

export function createYouTubeDownloadIcon() {

    const icon = createAppletIcon({
        icon_name: 'edit-download', 
        visible: false
    })

    addDownloadingSongsChangeListener((downloadingSongs) => {
        downloadingSongs.length !== 0 ? icon.visible = true : icon.visible = false
    })

    return icon
}