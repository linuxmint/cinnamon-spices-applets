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
            this.bindSettings()
            this.connectSignals()
            this.cssFocus = "background-color:;border-radius:5px;padding-right:10px;padding-left:5px;"
            this._regexChanged()
            this._bgChanged()
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
        this.settings.bind("title-len", "titleLength", this._lengthChanged)
        this.settings.bind("title-bg", "titleBg", this._bgChanged)
    }

    connectSignals() {
        this.signalManager = new SignalManager.SignalManager(null)
        this.signalManager.connect(global.display, 'notify::focus-window', () => {
            let w = global.display.focus_window
            if (w) {
                this.signalManager.connect(w, 'notify::title', () => {
                    this._onTitleChange()
                })
            }
            this._onTitleChange()
        }, this)
        this.signalManager.connect(global.screen, 'window-monitor-changed', () => {
            let w = global.display.focus_window
            if (w) {
                this._onMonitorChange(w.get_monitor())
            }
        }, this)
    }

    _onMonitorChange(monitorIndex) {
        if (monitorIndex != this.panel.monitorIndex) {
            let title = this._getTopWindowFromMonitor(this.panel.monitorIndex)
            this._setTitle(title, "")
            return
        }
        this._onTitleChange()
    }

    _getTopWindowFromMonitor(monitorIndex) {
        const panelMonitorIndex = this.panel.monitorIndex
        const windows = global.get_window_actors();
        for (let i = windows.length - 1; i > 0; i--) {
            if (panelMonitorIndex != windows[i].metaWindow.get_monitor() || windows[i].metaWindow.get_window_type() > 10) {
                continue
            }
            //console.log("pass :", i)
            //console.log("title:", windows[i].metaWindow.title)
            //console.log("type :", windows[i].metaWindow.get_window_type())
            return windows[i].metaWindow.title
        }
        return ""
    }

    _onTitleChange() {
        let w
        try {
            w = global.display.focus_window
        } catch (e) {
            return
        }
        if (w.get_monitor() != this.panel.monitorIndex) {
            let title = this._getTopWindowFromMonitor(w.get_monitor())
            this._setTitle(title, "")
            return
        }
        this._setTitle(w.get_title(), this.cssFocus)
    }

    _setTitle(title, css) {
        if (this.regex != null) {
            title = title.replace(this.regex, "")
        }
        title = title.substring(0, this.titleLength)
        this.set_applet_label(title)
        this.actor.set_style(css)
    }

    _lengthChanged() {
        this._onTitleChange()
    }

    _bgChanged() {
        this.cssFocus = "background-color:" + this.titleBg + ";border-radius:5px;padding-right:10px;padding-left:5px;"
        this._onTitleChange()
    }

    _regexChanged() {
        if (this.titleRegex == "") {
            this.regex = null
        } else {
            try {
                this.regex = new RegExp(this.titleRegex)
            } catch (e) {
                console.log("Maximus-title: user Regex error:", e)
                this.regex = null
            }
        }
        this._onTitleChange()
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId)
}
