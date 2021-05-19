"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenToDbus = void 0;
const consts_1 = require("consts");
const { getDBus, getDBusProxyWithOwner } = imports.misc.interfaces;
function listenToDbus(args) {
    const { onMpvRegistered, onMpvStopped } = args;
    const dbus = getDBus();
    dbus.connectSignal('NameOwnerChanged', (...args) => {
        const name = args[2][0];
        const oldOwner = args[2][1];
        const newOwner = args[2][2];
        if (name !== consts_1.MPV_MPRIS_BUS_NAME)
            return;
        if (newOwner) {
            onMpvRegistered();
            pauseAllOtherMediaPlayer();
        }
        oldOwner && onMpvStopped();
    });
    async function pauseAllOtherMediaPlayer() {
        const allMprisPlayerBusNames = await getAllMrisPlayerBusNames();
        allMprisPlayerBusNames.forEach(async (busName) => {
            if (busName === consts_1.MPV_MPRIS_BUS_NAME)
                return;
            const mediaServerPlayer = await getDBusProxyWithOwner(consts_1.MEDIA_PLAYER_2_PLAYER_NAME, busName);
            mediaServerPlayer.PauseRemote();
        });
    }
    function getAllMrisPlayerBusNames() {
        const name_regex = /^org\.mpris\.MediaPlayer2\./;
        return new Promise((resolve, reject) => {
            dbus.ListNamesRemote(names => {
                const busNames = names[0].filter(busName => name_regex.test(busName));
                const busNamesArr = Object.values(busNames);
                resolve(busNamesArr);
            });
        });
    }
    const checkMpvRunning = async function () {
        return (await getAllMrisPlayerBusNames()).includes(consts_1.MPV_MPRIS_BUS_NAME);
    };
    return {
        checkMpvRunning
    };
}
exports.listenToDbus = listenToDbus;
