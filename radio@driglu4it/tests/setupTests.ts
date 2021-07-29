import * as Atk from './global/gi/Atk'
import * as Cinnamon from './global/gi/Cinnamon'
import * as Cvc from './global/gi/Cvc'
import * as Clutter from './global/gi/Clutter'
import * as Gio from './global/gi/Gio'
import * as GLib from './global/gi/GLib'
import * as Pango from './global/gi/Pango'
import * as St from './global/gi/St'

import * as interfaces from './global/misc/interfaces'
import * as params from './global/misc/params'
import * as signalManager from './global/misc/signalManager'
import * as util from './global/misc/util'

import * as applet from './global/ui/applet'
import * as panel from './global/ui/panel'
import * as popupMenu from './global/ui/popupMenu'
import * as tooltips from './global/ui/tooltips'

const md5 = require('md5')

// TODO: optimally it should be thrown an error if it is called console.log as this is not implemented in gjs. Setting console to null is not an option as console is used to mock global.log

// @ts-ignore 
global.logError = function (error: string) {
    console.error(error);
};

(global as any).log = function (msg: string) {
    console.log(msg)
};

(global as any).__meta = {
    uuid: "radio@driglu4it"
};

(global as any).get_md5_for_string = function (text: string) {
    return md5(text)
};


(global as any).imports = {
    gi: {
        Atk,
        Cinnamon,
        Cvc,
        Clutter,
        Gio,
        GLib,
        Pango,
        St,
    },
    misc: {
        interfaces,
        params,
        signalManager,
        util,
    },
    ui: {
        applet,
        panel,
        popupMenu,
        tooltips
    }
};
