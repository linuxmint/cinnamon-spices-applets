const fs = require('fs')

import { emitPropsChanges } from './interfaces'


export function spawnCommandLine(command) {
    const commandArr = command.split(' ')

    if (commandArr[0] !== 'mpv') throw new Error("First word must be mpv");

    const volumeStr = commandArr.find(str => str.startsWith("--volume="));
    const scriptStr = commandArr.find(str => str.startsWith("--script="));
    const url = commandArr.find(str => str.startsWith("http"))

    const optionValueMap = new Map();

    [volumeStr, scriptStr].forEach(str => {
        const optionValue = str.split('=');
        optionValueMap.set(optionValue[0], optionValue[1])
    })

    const volume = parseInt(optionValueMap.get('--volume'))

    checkVolume(volume)
    checkScript(optionValueMap.get('--script'))

    simulateRadioStart(url, volume)
}


function checkScript(scriptPath: string) {
    if (!fs.existsSync(scriptPath)) throw new Error("Script path doesn't exist");

}

function checkVolume(volume: number) {
    if (!volume) throw new Error("volume not given");
    if (volume < 0) throw new Error('volume below 0')
    if (volume < 1) console.log(`volume very low. Did you use fraction instead of percent?`)
    if (volume > 100) throw new Error("volume above recommended maximum");
}

function simulateRadioStart(url: string, volume: number) {

    const props = {
        Volume: volume / 100,
        Metadata: {
            "mpris:trackid": "/-0",
            "xesam:title": "stream.mp3",
            "xesam:url": url
        },
        PlaybackStatus: "Playing"
    }

    emitPropsChanges(props)
}

export function spawnCommandLineAsyncIO() {
    global.log(`spwan Command Line Async executed`)
}