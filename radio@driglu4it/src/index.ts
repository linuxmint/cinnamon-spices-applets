import { initConfig } from './services/Config';
import { initMpvHandler } from './services/mpv/MpvHandler';
import { initPolyfills } from './polyfill';
import { createRadioAppletContainer } from './ui/RadioApplet/RadioAppletContainer';

export function main(): imports.ui.applet.Applet {

    // order must be retained!
    initPolyfills()
    initConfig()
    initMpvHandler()

    return createRadioAppletContainer()

}



