const { spawnCommandLine } = imports.misc.util;


export function notifySend(notifactionMsg: string) {
    const iconPath = `${__meta.path}/icons/radioapplet-fullcolor.png`;
    spawnCommandLine('notify-send --hint=int:transient:1 --expire-time=10000 "' + notifactionMsg + '" -i ' + iconPath);
}