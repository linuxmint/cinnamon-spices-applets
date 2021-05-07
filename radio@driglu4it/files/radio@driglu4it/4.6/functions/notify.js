"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySend = void 0;
const { spawnCommandLine } = imports.misc.util;
function notifySend(notifactionMsg) {
    const iconPath = `${__meta.path}/icons/radioapplet-fullcolor.png`;
    spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notifactionMsg + '" -i ' + iconPath);
}
exports.notifySend = notifySend;
