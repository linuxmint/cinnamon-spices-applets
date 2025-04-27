const Applet = imports.ui.applet;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const UUID = "desaturate-all@hkoosha";
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

function MyApplet() {
    this._init.apply(this, arguments);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init(aMetadata, aOrientation, aPanelHeight, aInstanceId) {
        Applet.IconApplet.prototype._init.call(this, aOrientation, aPanelHeight, aInstanceId);

        if (Applet.hasOwnProperty("AllowedLayout")) {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        }

        this.effect = new Clutter.DesaturateEffect();
        this.set_applet_icon_symbolic_name("applications-graphics");

        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

        this.settings.bind("keybinding", "keybinding", this.on_keybinding_changed);
        this.settings.bind("saturation", "saturation", this.on_saturation_changed);
        this.settings.bind("resume-on-startup", "resumeOnStartup");
        this.settings.bind("state", "state");

        this.settings.connect( "changed::automatic",         Lang.bind(this, this.on_automatic_changed));
        this.settings.connect( "changed::start-timechooser", Lang.bind(this, this.on_time_changed));
        this.settings.connect( "changed::end-timechooser",   Lang.bind(this, this.on_time_changed));

        this.on_keybinding_changed();
        this.on_saturation_changed();
        if (!this.settings.getValue("automatic")) {
            if (this.resumeOnStartup && this.state)
                this._toggleEffect();
        } else {
           this._toggleEffect_based_on_time("init");
        }
    },

    _toggleEffect(enable = null) {
        let effectEnabled = Main.uiGroup.has_effects() && Main.uiGroup.get_effects().indexOf(this.effect) > -1;
        if (enable != true && effectEnabled) {
            Main.uiGroup.remove_effect(this.effect);
            this.settings.setValue("state", false);
        } else if (enable != false && !effectEnabled){
            Main.uiGroup.add_effect(this.effect);
            this.settings.setValue("state", true);
        }
    },

    _toggleEffect_based_on_time() {
        if (this.toggleDelay) {
            Mainloop.source_remove(this.toggleDelay);
            this.toggleDelay = null;
        }

        if (!this.settings.getValue("automatic"))
           return;

        const date = new Date();
        const enableAt = new Date();
        const disableAt = new Date();

        let enableTime = this.settings.getValue("start-timechooser");
        enableAt.setHours( enableTime.h );
        enableAt.setMinutes( enableTime.m );
        enableAt.setSeconds( 0 );

        let disableTime = this.settings.getValue("end-timechooser");
        disableAt.setHours( disableTime.h );
        disableAt.setMinutes( disableTime.m );
        disableAt.setSeconds( 0 );

        if (disableAt < enableAt)
           disableAt.setDate( disableAt.getDate() + 1 );

        let enable = (date < disableAt && date >= enableAt);
        this._toggleEffect( enable );

        let diffTime;
        if (enable) {
           diffTime = Math.abs(disableAt - date) / 1000;
           //log( `Disabling in ${diffTime} seconds` );
        } else {
           diffTime = Math.abs(enableAt - date) / 1000;
           //log( `Enabling in ${diffTime} seconds` );
        }
        this.toggleDelay = Mainloop.timeout_add_seconds(diffTime, () => {this.toggleDelay = null; this._toggleEffect_based_on_time();} );
    },

    on_automatic_changed(signal, key, oldValue, value) {
        if (oldValue != value) {
           this._toggleEffect_based_on_time();
        }
    },

    on_time_changed(signal, key, oldValue, value) {
       if (oldValue.h !== value.h || oldValue.m !== value.m) {
          this._toggleEffect_based_on_time();
       }
    },

    on_applet_clicked() {
        this._toggleEffect();
    },

    on_keybinding_changed() {
        Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this._toggleEffect));
    },

    on_saturation_changed() {
        if (!this.satDelay) {
           this.effect.set_factor((100-this.saturation)/100);
        } else {
           Mainloop.source_remove(this.satDelay);
        }
        this.satDelay = Mainloop.timeout_add(200, () => this.satDelay = null );
    }
};

function main(aMetadata, aOrientation, aPanelHeight, aInstanceId) {
    return new MyApplet(aMetadata, aOrientation, aPanelHeight, aInstanceId);
}
