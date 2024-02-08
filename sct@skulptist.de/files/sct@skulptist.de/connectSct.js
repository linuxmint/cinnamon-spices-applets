const Util = imports.misc.util // to spawn commands
const {_} = require("./translation.js")

function setColorTemperature (val) {
    Util.spawnCommandLineAsyncIO("sct "+val, (stdout, stderr, exitCode)=> { 
        if (stderr) {
            notifyMissingSctInstallation()
            global.log("setColorTemperature sends an error")
        }
    })    
}

function notifyMissingSctInstallation() {
    const title = _("sct not found")
    const body = _("Please install sct to set the color temperature with this applet.")
    Util.spawnCommandLine(`notify-send "${title}" "${body}"`)
}

module.exports = {setColorTemperature}