const Applet = imports.ui.applet;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

const UUID = "desaturate-all@hkoosha";

function _(str) {
    return Gettext.dgettext(UUID, str);
}

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

        this.desktop_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });
        this.set_applet_tooltip("time"); // initial value so that the show/hide events will occur
        this._applet_tooltip._tooltip.connect( "show", Lang.bind(this, this.on_tooltip_shown));

        this.on_keybinding_changed();
        this.on_saturation_changed();
        if (!this.settings.getValue("automatic")) {
            if (this.resumeOnStartup && this.state)
                this._toggleEffect();
        } else {
           this._toggleEffect_based_on_time("init");
        }
    },

    on_tooltip_shown() {
       let ttText;
       let effectEnabled = Main.uiGroup.has_effects() && Main.uiGroup.get_effects().indexOf(this.effect) > -1;
       if (effectEnabled) {
          ttText = _("Click to disable effect");
       } else {
          ttText = _("Click to desaturate the desktop")
       }
       if (this.settings.getValue("automatic")) {
          let toggleTime = this._get_toggle_time();
          let hours = Math.floor(toggleTime.seconds / 60 / 60);
          if (hours === 0 ) {
             let min = Math.floor((toggleTime.seconds / 60) + 1);
             if (toggleTime.enable) {
                ttText += "\n" + _("Will automatically desaturate in" );
             } else {
                ttText += "\n" + _("Will automatically disable in");
             }
             ttText += ` ${min} ` + _("minutes");
          } else {
             if (toggleTime.enable) {
                ttText += "\n" + _("Will automatically desaturate at") + " ";
             } else {
                ttText += "\n" + _("Will automatically disable at") + " ";
             }
             let use_24h = this.desktop_settings.get_boolean("clock-use-24h");
             let ttTimeFormat = new Intl.DateTimeFormat(undefined, {hour: "numeric", minute: "2-digit", hour12: !use_24h});

             ttText += ttTimeFormat.format(toggleTime.time);
          }
       }
       this.set_applet_tooltip( ttText );
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

    _get_toggle_time() {
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
        let diffTime;
        let time;
        if (enable) {
           diffTime = Math.abs(disableAt - date) / 1000;
           time = disableAt;
           //log( `Disabling in ${diffTime} seconds` );
        } else {
           diffTime = Math.abs(enableAt - date) / 1000;
           time = enableAt;
           //log( `Enabling in ${diffTime} seconds` );
        }
        return {enable: !enable, seconds: diffTime, time: time};
    },

    _toggleEffect_based_on_time() {
        if (this.toggleDelay) {
            Mainloop.source_remove(this.toggleDelay);
            this.toggleDelay = null;
        }

        if (!this.settings.getValue("automatic"))
           return;

        let toggleTime = this._get_toggle_time();
        this._toggleEffect( !toggleTime.enable );
        let diffTime = toggleTime.seconds;
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
