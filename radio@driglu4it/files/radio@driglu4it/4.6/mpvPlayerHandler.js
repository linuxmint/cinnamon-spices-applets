const Util = imports.misc.util;

class MpvPlayerHandler {

    constructor({ mprisPluginPath, initialChannelUrl, onRadioStopped, initialVolume, maxVolume }) {
        this.mprisPluginPath = mprisPluginPath
        this.channelUrl = initialChannelUrl
        this.onRadioStopped = onRadioStopped
        // the inital volume is applied when no radio stream is running
        this.initialVolume = initialVolume
        this.maxVolume = maxVolume
    }

    // returns the initial volume when no radio stream is running and else the volume of the current running radio stream 
    // The volume currently isn't saved as an attribut as the volume can be changed by MPRIS controller and we currently don't get informed when this happens. This will be implemented in future.  
    getVolume() {
        return new Promise((resolve, reject) => {
            Util.spawnCommandLineAsyncIO(`playerctl --player=mpv volume`, (volume, stderr) => {
                // for mpv the volume is between 0 and 100 and for playerctl between 0 and 1
                if (stderr.trim() == "No players found") {
                    resolve(this.initialVolume)
                }
                else {
                    resolve(Number(volume) * 100)
                }
            })
        })
    }


    // Stops all running media outputs (which can be controlled via MPRIS) - not only potentially running radio streams
    async startChangeRadioChannel(channelUrl) {
        this.channelUrl = channelUrl
        const volume = Math.min(await this.getVolume(), this.maxVolume)
        let mpvStdout = null

        Util.spawnCommandLineAsyncIO(`playerctl -a stop`, () => {
            Util.spawnCommandLineAsyncIO(`mpv --script=${this.mprisPluginPath} \
            ${channelUrl} --volume=${volume} & wait; echo 'stop'`, (stdout, stderr) => {
                mpvStdout = stdout
                // this callback function is either called when the stream has been closed or the radio channel has changed. It is not sufficient to just call a function when the stop button is clicked as the radio stream can also be closed with MPRIS control
                setTimeout(async () => {
                    const newChannelUrl = await MpvPlayerHandler.getRunningRadioUrl()
                    if (!newChannelUrl) {
                        this.onRadioStopped()
                        this.channelUrl = null
                    }
                }, 100);
            })
        })

        // stdout is only not null after 2 second when an error occured 
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                mpvStdout ? reject(mpvStdout) : resolve()
            }, 2000)
        })

    }

    // returns true when volume could be changed and false if not. This is the case when the increased volume would be higher than 
    async increaseDecreaseVolume(amount) {
        const currentVolume = await this.getVolume()
        let volumeChangeable
        let newVolume = currentVolume + amount

        if (newVolume > this.maxVolume) {
            volumeChangeable = false
            // the volume can be above the max volume when the max volume has changed in the settings
            Util.spawnCommandLine(`playerctl --player=mpv volume ${this.maxVolume} `)
        } else {
            Util.spawnCommandLine(`playerctl --player=mpv volume ${newVolume / 100} `)
            volumeChangeable = true
        }

        return volumeChangeable
    }

    stopRadio() {
        Util.spawnCommandLine("playerctl --player=mpv stop");
    }


    /** 
      *  
      *  Be aware that when the radio channel has changed, there is a short period during 
      *  which the radio is actually playing but the playerctl request returns no radio 
      *  anyway.  
      *
      */
    static getRunningRadioUrl() {
        return new Promise((resolve, reject) => {

            Util.spawnCommandLineAsyncIO("playerctl --player=mpv metadata --format '{{ xesam:url }}'", (stdout, stderr) => {
                if (stderr.trim() == "No players found") {
                    resolve(false)
                } else {
                    resolve(stdout.trim())
                }
            })
        })
    }

}

