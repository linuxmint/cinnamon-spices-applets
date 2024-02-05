const Applet = imports.ui.applet
const Util = imports.misc.util // to spawn commands
const Settings = imports.ui.settings  // Needed for settings API
const GLib = imports.gi.GLib // for the home dir
const Gettext = imports.gettext; // for the translations

const uuid = "sct@skulptist.de"

const homeDir = GLib.get_home_dir()
const appletPath = homeDir+ "/.local/share/cinnamon/applets/"+uuid
const iconPath = appletPath + "/icons/iconThermometer2.svg"

// translations are bound to the uuid and the keys
Gettext.bindtextdomain(uuid, homeDir + "/.local/share/locale");

// the _ seems to be the common name for the translation function
function _(str) {
    return Gettext.dgettext(uuid, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id)
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    
    // iconName will get populated by the bindProperty
    iconChanged: "false",
    
    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id)
        
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id)
        
        // the steps are an array, the currentStep is the current position in that array
        this.settings.bindProperty(Settings.BindingDirection.OUT, "currentStep", "currentStep")
        
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep1", "colorStep1")
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep2", "colorStep2")
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep3", "colorStep3")
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep4", "colorStep4")
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep5", "colorStep5")
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep6", "colorStep6")
        this.settings.bindProperty(Settings.BindingDirection.IN, "colorStep7", "colorStep7")
        let steps = this.getSteps()
        this.setColorTemperature(steps[this.currentStep])    
        
        this.settings.bindProperty(Settings.BindingDirection.OUT, "iconChanged", "iconChanged")
        this.settings.bindProperty(Settings.BindingDirection.IN, "iconName", "iconName", this.handleIconChange)
        
        this.setIcon()
    },
    
    setIcon () {
        if (this.iconChanged == "true") {
            this.set_applet_icon_symbolic_name(this.iconName)
        } else {
            this.set_applet_icon_symbolic_path(iconPath)  
        }
    },

    handleIconChange: function() {
        this.iconChanged = "true"
        this.setIcon()
    },
    
    handleResetIconName: function() {
        this.iconChanged = "false"
        this.setIcon()
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
    
    on_applet_clicked: function() {
        
        let steps = this.getSteps()
        if (this.currentStep == undefined) {
            this.currentStep = 0
        }
        
        if (this.currentStep >= (steps.length -1)) {
            this.currentStep = 0
        } else {
            this.currentStep = this.currentStep + 1
        }
        
        this.setColorTemperature(steps[this.currentStep])    
    },
    
    setColorTemperature: function (val) {    
    
        Util.spawnCommandLineAsyncIO("sct "+val, (stdout, stderr, exitCode)=> { 
        
            if (stderr) {
                this.notifyMissingSctInstallation()
                global.log("setColorTemperature sends an error")
            }
        })
        this.set_applet_tooltip(_("sct is now at")+ " " + val + "K")
    },
    
    notifyMissingSctInstallation: function() {
        const title = _("sct not found")
        const body = _("Please install sct to set the color temperature with this applet.")
        Util.spawnCommandLine(`notify-send "${title}" "${body}" -i ${this.iconName}`)
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id)
}
