import { initConfig } from './services/Config';
import { initMpvHandler } from './services/mpv/MpvHandler';
import { initPolyfills } from './polyfill';
import {  getRadioAppletContainer } from './ui/RadioApplet/RadioAppletContainer';

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

export const addOnAppletMovedCallback = (cb: () => void) => {
    onAppletMovedCallbacks.push(cb)
}

// The function defintion must use the word "function" (not const!) as otherwilse the error: "radioApplet.main is not a constructor" is thrown
export function main(): imports.ui.applet.Applet {

    // order must be retained!
    initPolyfills()
    initConfig()
    initMpvHandler()

    return getRadioAppletContainer({ onAppletMovedCallbacks });

}
