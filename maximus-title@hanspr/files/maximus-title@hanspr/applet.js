const Applet = imports.ui.applet
const SignalManager = imports.misc.signalManager
const Settings = imports.ui.settings;

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight, instanceId)
            this.metadata = metadata
            this.uuid = metadata.uuid
            this.orientation = orientation
            this.panelHeight = panelHeight
            this.instanceId = instanceId
            this.appletPath = metadata.path
            this.regex = null
            this.cssFocus = "background-color:#5dabf9;border-radius:5px;"
            this.bindSettings()
            this.connectSignals()
            this.lastTitle = ""
            this._regexChanged()
            setTimeout(() => {
                this.initialized = true
            }, 500)
        } catch (e) {
            global.logError(e)
        }
    }

    bindSettings() {
        this.settings = new Settings.AppletSettings(this, this.uuid, this.instanceId)

        this.settings.bind("title-regex", "titleRegex", this._regexChanged)
        this.settings.bind("title-len", "titleLength", this._lengthChange)
    }

    connectSignals() {
        this.signalManager = new SignalManager.SignalManager(null)
        this.signalManager.connect(global.display, 'notify::focus-window', () => {
            let w = global.display.focus_window
            if (w) {
                this.signalManager.connect(w, 'notify::title', () => {
                    this._onTitleChange(w.lastTitle, w.get_monitor())
                })
                this._onTitleChange(w.lastTitle, w.get_monitor())
            } else {
                this._onTitleChange(undefined, 0)
            }
        }, this)
        this.signalManager.connect(global.screen, 'window-monitor-changed', () => {
            let w = global.display.focus_window
            if (w) {
                this._onMonitorChange(w.lastTitle, w.get_monitor())
            }
        }, this)
    }

    _onMonitorChange(title, monitorIndex) {
        if (monitorIndex != this.panel.monitorIndex) {
            let title = ""
            const windows = global.get_window_actors();
            for (let i = 0; i < windows.length; i++) {
                if (this.panel.monitorIndex != windows[i].metaWindow.get_monitor() || windows[i].metaWindow.get_window_type() > 1) {
                    continue
                }
                //console.log("pass :", i)
                //console.log("title:", windows[i].metaWindow.title)
                //console.log("type :", windows[i].metaWindow.get_window_type())
                title = windows[i].metaWindow.title
            }
            this._onTitleChange(title, this.panel.monitorIndex)
            this.actor.set_style("background-color:")
            return
        }
        this._onTitleChange(title, monitorIndex)
    }

    _onTitleChange(title, monitorIndex) {
        if (monitorIndex != this.panel.monitorIndex) {
            this.actor.set_style("background-color:")
            return
        }
        if (title == undefined) {
            try {
                title = global.display.focus_window.get_title()
            } catch (e) {
                return
            }
        }
        if (this.lastTitle == title) {
            this.actor.set_style(this.cssFocus)
            return
        }
        this.lastTitle = title
        if (this.regex != null) {
            title = title.replace(this.regex, "")
        }
        title = title.substring(0, this.titleLength) + " "
        this.set_applet_label(title)
        this.actor.set_style(this.cssFocus)
    }

    _lengthChange() {
        this._onTitleChange(this.lastTitle + " ")
    }

    _regexChanged() {
        if (this.titleRegex != "") {
            try {
                this.regex = new RegExp(this.titleRegex)
            } catch (e) {
                console.log("Regex error:", e)
                this.regex = null
            }
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId)
}
