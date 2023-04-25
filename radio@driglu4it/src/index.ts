import { initConfig } from './services/Config';
import { initMpvHandler } from './services/mpv/MpvHandler';
import { initPolyfills } from './polyfill';
import { getRadioAppletContainer } from './ui/RadioApplet/RadioAppletContainer';
import { APPLET_CACHE_DIR_PATH } from './consts';
const { new_for_path } = imports.gi.Gio.File
declare global {
    // added during build (see webpack.config.js)
    interface Meta {
        instanceId: number
        orientation: imports.gi.St.Side // TODO: needed??
        panel: imports.ui.panel.Panel
        locationLabel: imports.ui.appletManager.LocationLabel
    }
}
 
const onAppletMovedCallbacks: Array<() => void> = []

const createCacheDir = () => {
    const dir = new_for_path(APPLET_CACHE_DIR_PATH);
    if (!dir.query_exists(null)) dir.make_directory_with_parents(null)
}


export const addOnAppletMovedCallback = (cb: () => void) => {
    onAppletMovedCallbacks.push(cb)
}

// The function defintion must use the word "function" (not const!) as otherwilse the error: "radioApplet.main is not a constructor" is thrown
export function main(): imports.ui.applet.Applet {

    createCacheDir();

    // order must be retained!
    initPolyfills()
    initConfig()
    initMpvHandler()

    return getRadioAppletContainer({ onAppletMovedCallbacks });

}
