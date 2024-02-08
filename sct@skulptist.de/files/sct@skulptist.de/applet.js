const Applet = imports.ui.applet
const Settings = imports.ui.settings  // Needed for settings API
const GLib = imports.gi.GLib // for the home dir

const uuid = "sct@skulptist.de"
const homeDir = GLib.get_home_dir()
const appletPath = homeDir+ "/.local/share/cinnamon/applets/"+uuid
const iconPath = appletPath + "/icons/appletIcon.svg"

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
    
    instanceId: undefined, 
    iconName: undefined, // iconName will get populated by the bindProperty
    iconChanged: "false",
    
    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id)
        this.instanceId = instance_id
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id)
                
        this.settings.bind("colorStep1", "colorStep1")
        this.settings.bind("colorStep2", "colorStep2")
        this.settings.bind("colorStep3", "colorStep3")
        this.settings.bind("colorStep4", "colorStep4")
        this.settings.bind("colorStep5", "colorStep5")
        this.settings.bind("colorStep6", "colorStep6")
        this.settings.bind("colorStep7", "colorStep7")
        
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
        if (this.colorStep1) {
            steps.push(parseInt(this.colorStep1))
        }
        if (this.colorStep2) {
            steps.push(parseInt(this.colorStep2))
        }
        if (this.colorStep3) {
            steps.push(parseInt(this.colorStep3))
        }
        if (this.colorStep4) {
            steps.push(parseInt(this.colorStep4))
        }
        if (this.colorStep5) {
            steps.push(parseInt(this.colorStep5))
        }
        if (this.colorStep6) {
            steps.push(parseInt(this.colorStep6))
        }
        if (this.colorStep7) {
            steps.push(parseInt(this.colorStep7))
        }
        return steps
    },

    getNextStep: function (stepsLength) {
        let currentStep = this.settings?.getValue("currentStep") || 0
        if (currentStep >= (stepsLength -1)) {
            currentStep = 0
        } else {
            currentStep = currentStep + 1
        }
        this.settings.setValue("currentStep", currentStep)
        return currentStep
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id)
}