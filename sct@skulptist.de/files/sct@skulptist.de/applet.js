const Applet = imports.ui.applet
const Settings = imports.ui.settings  // Needed for settings API
const GLib = imports.gi.GLib // for the home dir

const uuid = "sct@skulptist.de"
const homeDir = GLib.get_home_dir()
const appletPath = homeDir+ "/.local/share/cinnamon/applets/"+uuid
const iconPath = appletPath + "/icons/appletIcon-symbolic.svg"

// the _ seems to be the common name for the translation function
const {initTranslation, _} = require("./translation.js")
initTranslation({uuid, homeDir})

// handles the commandline and errors of the sct calls
const {setColorTemperature} = require("./connectSct.js")


function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id)
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    iconName: undefined, // iconName will get populated by the bindProperty
    iconChanged: "false",

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id)
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id)

        this.settings.bind("maxSteps", "maxSteps")
        for (let i=1; i<=this.maxSteps; i++) {
            this.settings.bind("colorStep"+i, "colorStep"+i)
        }
        this.settings.bind("currentStep", "currentStep")
        this.settings.bind("iconChanged", "iconChanged")
        this.settings.bind("iconName", "iconName", this.handleIconChange)

        this.setIcon()
    },

    setIcon () {
        if (this.iconChanged === true) {
            this.set_applet_icon_symbolic_name(this.iconName)
        } else {
            this.set_applet_icon_symbolic_path(iconPath)
        }
    },

    handleIconChange: function() {
        this.iconChanged = true
        this.setIcon()
    },

    handleResetIconName: function() {
        this.iconChanged = false
        this.setIcon()
    },

    on_applet_clicked: function() {

        let steps = this.getSteps()
        let nextStep = this.getNextStep(steps.length)
        let val = steps[nextStep]

        setColorTemperature(val)
        this.set_applet_tooltip(_("sct is now at") + " " + val + "K")
    },

    // The color step configuration can be changed between clicks on the applet.
    // The getter function makes it up to date all the time. There is less code
    // so thats not a performance issue.
    getSteps: function() {
        let steps = []
        for (let i=1; i<=this.maxSteps; i++) {
            if (this["colorStep"+i]) {
                steps.push(this["colorStep"+i])
            }
        }
        return steps
    },

    getNextStep: function (stepsLength) {
        if (this.currentStep >= (stepsLength -1)) {
            this.currentStep = 0
        } else {
            this.currentStep = this.currentStep + 1
        }
        return this.currentStep
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id)
}