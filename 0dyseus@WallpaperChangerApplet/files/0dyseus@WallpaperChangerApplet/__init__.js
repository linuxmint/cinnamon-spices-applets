const AppletUUID = "0dyseus@WallpaperChangerApplet";
const AppletMeta = imports.ui.appletManager.appletMeta[AppletUUID];
const AppletPath = AppletMeta.path;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GioSSS = Gio.SettingsSchemaSource;
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;
const Tooltips = imports.ui.tooltips;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cogl = imports.gi.Cogl;
const Pango = imports.gi.Pango;
const AppletManager = imports.ui.appletManager;
const Mainloop = imports.mainloop;

const CINNAMON_VERSION = GLib.getenv("CINNAMON_VERSION");
const SETTINGS_SCHEMA = "org.cinnamon.applets.0dyseus@WallpaperChangerApplet";

Gettext.bindtextdomain(AppletUUID, GLib.get_home_dir() + "/.local/share/locale");

function _(aStr) {
    let customTrans = Gettext.dgettext(AppletUUID, aStr);

    if (customTrans !== aStr && aStr !== "")
        return customTrans;

    return Gettext.gettext(aStr);
}

const WallChangerSettings = new Lang.Class({
    Name: "WallChangerSettings",

    _init: function() {
        let schema = SETTINGS_SCHEMA;

        let schemaDir = Gio.file_new_for_path(AppletPath + "/schemas");
        let schemaSource;

        if (schemaDir.query_exists(null)) {
            schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                GioSSS.get_default(),
                false);
        } else {
            schemaSource = GioSSS.get_default();
        }

        this.schemaObj = schemaSource.lookup(schema, false);

        if (!this.schemaObj)
            throw new Error(_("Schema %s could not be found for extension %s.")
                .format(schema, AppletUUID) + _("Please check your installation."));

        this.schema = new Gio.Settings({
            settings_schema: this.schemaObj
        });

        this._handlers = [];
    },

    get daemon_is_running() {
        return this.schema.get_boolean("daemon-is-running");
    },

    set daemon_is_running(value) {
        this.schema.set_boolean("daemon-is-running", Boolean(value));
    },

    get toggle_daemon() {
        return this.schema.get_boolean("toggle-daemon");
    },

    set toggle_daemon(value) {
        this.schema.set_boolean("toggle-daemon", Boolean(value));
    },

    get logging_enabled() {
        return this.schema.get_boolean("logging-enabled");
    },

    set logging_enabled(value) {
        this.schema.set_boolean("logging-enabled", Boolean(value));
    },

    get auto_rotate() {
        return this.schema.get_boolean("auto-rotate");
    },

    set auto_rotate(value) {
        this.schema.set_boolean("auto-rotate", Boolean(value));
    },

    get auto_start() {
        return this.schema.get_boolean("auto-start");
    },

    set auto_start(value) {
        this.schema.set_boolean("auto-start", Boolean(value));
    },

    get current_profile() {
        return this.schema.get_string("current-profile");
    },

    set current_profile(value) {
        this.schema.set_string("current-profile", value);
    },

    get custom_applet_label() {
        return this.schema.get_string("custom-applet-label");
    },

    set custom_applet_label(value) {
        this.schema.set_string("custom-applet-label", value);
    },

    get custom_applet_icon() {
        return this.schema.get_string("custom-applet-icon");
    },

    set custom_applet_icon(value) {
        this.schema.set_string("custom-applet-icon", value);
    },

    get icon_preview() {
        return this.schema.get_boolean("icon-preview");
    },

    set icon_preview(value) {
        this.schema.set_boolean("icon-preview", Boolean(value));
    },

    get interval() {
        return this.schema.get_int("interval");
    },

    set interval(value) {
        this.schema.set_int("interval", parseInt(value));
    },

    get notifications() {
        return this.schema.get_boolean("notifications");
    },

    set notifications(value) {
        this.schema.set_boolean("notifications", Boolean(value));
    },

    get wallpaper_preview_width() {
        return this.schema.get_int("wallpaper-preview-width");
    },

    set wallpaper_preview_width(value) {
        this.schema.set_int("wallpaper-preview-width", parseInt(value));
    },

    get invert_menu_items_order() {
        return this.schema.get_boolean("invert-menu-items-order");
    },

    set invert_menu_items_order(value) {
        this.schema.set_boolean("invert-menu-items-order", Boolean(value));
    },

    get profiles() {
        return this.schema.get_value("profiles").deep_unpack();
    },

    set profiles(value) {
        this.schema.set_value("profiles", new GLib.Variant("a{sa(sb)}", value));
    },

    get random() {
        return this.schema.get_boolean("random");
    },

    set random(value) {
        this.schema.set_boolean("random", Boolean(value));
    },

    get rotation() {
        return this.schema.get_string("rotation");
    },

    set rotation(value) {
        this.schema.set_string("rotation", value);
    },

    get next_wallpaper_shortcut() {
        return this.schema.get_strv("next-wallpaper-shortcut");
    },

    get prev_wallpaper_shortcut() {
        return this.schema.get_strv("prev-wallpaper-shortcut");
    },

    get toggle_menu_shortcut() {
        return this.schema.get_strv("toggle-menu-shortcut");
    },

    get remember_profile_state() {
        return this.schema.get_boolean("remember-profile-state");
    },

    set remember_profile_state(value) {
        this.schema.set_boolean("remember-profile-state", Boolean(value));
    },

    connect: function(signal, callback) {
        let handler_id = this.schema.connect(signal, callback);
        this._handlers.push(handler_id);
        return handler_id;
    },

    destroy: function() {
        // Remove the remaining signals...
        while (this._handlers.length) {
            this.disconnect(this._handlers[0]);
        }
    },

    disconnect: function(handler_id) {
        let index = this._handlers.indexOf(handler_id);
        this.schema.disconnect(handler_id);

        if (index > -1) {
            this._handlers.splice(index, 1);
        }
    }
});

const Settings = new WallChangerSettings();

const DAEMON_NAME = "org.cinnamon.Applets.WallpaperChangerApplet.Daemon";
const DAEMON_PATH = "/org/cinnamon/Applets/WallpaperChangerApplet/Daemon";

const WallChangerDaemonInterface = '<node>\
    <interface name="%s">\
        <method name="LoadProfile">\
            <arg direction="in" name="profile" type="s" />\
        </method>\
        <method name="Next">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Prev">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Quit"></method>\
        <signal name="changed">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
        <signal name="error">\
            <arg direction="out" name="message" type="s" />\
        </signal>\
        <signal name="preview">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
        <property type="as" name="history" access="read" />\
        <property type="as" name="queue" access="read" />\
    </interface>\
</node>'.format(DAEMON_NAME);

const WallChangerDaemonProxy = Gio.DBusProxy.makeProxyWrapper(WallChangerDaemonInterface);

const DBusInterface = '<node>\
  <interface name="org.freedesktop.DBus">\
    <method name="ListNames">\
      <arg direction="out" type="as"/>\
    </method>\
    <signal name="NameOwnerChanged">\
      <arg type="s"/>\
      <arg type="s"/>\
      <arg type="s"/>\
    </signal>\
  </interface>\
</node>';

const DBusProxy = Gio.DBusProxy.makeProxyWrapper(DBusInterface);

function WallChangerDaemon() {
    this._init.apply(this, arguments);
}

WallChangerDaemon.prototype = {

    _init: function() {
        this._bus_handlers = [];
        this._settings = Settings;
        this._settings.daemon_is_running = false;
        this._path = AppletPath;
        this.bus = new WallChangerDaemonProxy(Gio.DBus.session, DAEMON_NAME, DAEMON_PATH);
        this._bus = new DBusProxy(Gio.DBus.session,
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus");
        this._owner_changed_id = this._bus.connectSignal("NameOwnerChanged",
            Lang.bind(this, function(emitter, signalName, params) {
                if (params[0] == DAEMON_NAME) {
                    if (params[1] !== "" && params[2] === "") {
                        this._off();
                    }
                    if (params[1] === "" && params[2] !== "") {
                        this._on();
                    }
                }
            }));

        let result = this._bus.ListNamesSync();
        result = String(result).split(",");

        for (let item in result) {
            if (result[item] == DAEMON_NAME) {
                this._on();
                break;
            }
        }
    },

    connectSignal: function(signal, callback) {
        let handler_id = this.bus.connectSignal(signal, callback);
        this._bus_handlers.push(handler_id);
        debug("Added dbus handler %s".format(handler_id));
        return handler_id;
    },

    destroy: function() {
        while (this._bus_handlers.length) {
            this.disconnectSignal(this._bus_handlers[0]);
        }

        this._bus.disconnectSignal(this._owner_changed_id);
    },

    disconnectSignal: function(handler_id) {
        let index = this._bus_handlers.indexOf(handler_id);

        debug("Removing dbus handler %s".format(handler_id));
        this.bus.disconnectSignal(handler_id);

        if (index > -1) {
            this._bus_handlers.splice(index, 1);
        }
    },

    toggle: function() {
        if (this.is_running) {
            this.stop();
        } else {
            this.start();
        }
    },

    stop: function() {
        if (this.is_running) {
            debug("Stopping daemon");
            this.bus.QuitSync();
        }
    },

    start: function() {
        debug("Starting daemon");
        GLib.spawn_async(
            this._path, [this._path + "/wall-changer-daemon.py"],
            null,
            GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null
        );
    },

    _off: function() {
        this._settings.daemon_is_running = false;
        debug("emit(\"toggled\", false)");
        this.emit("toggled", false);
    },

    _on: function() {
        debug("The wall-changer daemon is running");
        this._settings.daemon_is_running = true;
        debug("emit(\"toggled\", true)");
        this.emit("toggled", true);
    },

    get is_running() {
        return this._settings.daemon_is_running;
    }
};

Signals.addSignalMethods(WallChangerDaemon.prototype);

function WallChangerButton() {
    this._init.apply(this, arguments);
}

WallChangerButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this._settings = Settings;
        this.connections = [];

        this.actor.set_style_class_name("menu-application-button");
        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            icon_size: 20
        });
        this.addActor(this.icon);

        let conn = this.actor.connect("leave-event", Lang.bind(this, this._leaveEvent));
        this.connections.push([this.actor, conn]);

        conn = this.actor.connect("enter-event", Lang.bind(this, this._enterEvent));
        this.connections.push([this.actor, conn]);

        conn = this.connect("activate", Lang.bind(this, callback));
        this.connections.push([this, conn]);

        this.tooltip = new MyTooltip(this.actor, "");
    },

    _leaveEvent: function() {
        this.actor.set_style_class_name("menu-application-button");
    },

    _enterEvent: function() {
        this.actor.set_style_class_name("menu-application-button-selected");
    },

    destroy: function() {
        for (let i = this.connections.length - 1; i >= 0; i--) {
            try {
                debug("Removing button clicked handler %s".format(this.connections[i][1]));
                this.connections[i][0].disconnect(this.connections[i][1]);
            } catch (aErr) {
                continue;
            }
        }

        this.connections.length = 0;

        this.icon.destroy();
        this.actor.destroy();
        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    },

    set_icon: function(icon) {
        this.icon.icon_name = icon + "-symbolic";
    },

    _getTooltip: function(tt) {
        switch (tt) {
            case "random":
                return _("Wallpapers will be changed in random order");
            case "ordered":
                return _("Wallpapers will be changed in alphabetical order");
            case "interval":
                return _("Wallpaper rotation every %s seconds").format(this._settings.interval);
            case "disabled":
                return _("Automatic rotation disabled");
            case "hourly":
                return _("Wallpaper rotation at the beginning of every hour");
        }
        return tt;
    },

    set_tooltip: function(state) {
        this.tooltip._tooltip.set_text(this._getTooltip(state));
    }
};

function WallChangerPreview() {
    this._init.apply(this, arguments);
}

WallChangerPreview.prototype = {

    _init: function(width, daemon) {
        this.actor = new St.Bin({
            x_align: St.Align.MIDDLE
        });

        this.actor.set_width(width);

        this._path = null;
        this._texture = null;
        this.daemon = daemon;
        this._width = width;
        this._next_file_id = this.daemon.connectSignal("preview",
            Lang.bind(this, function(proxy, signalName, parameters) {
                let path = parameters[0];
                this.set_wallpaper(path);
            }));

        if (this.daemon.bus.queue && this.daemon.bus.queue.length > 0) {
            this.set_wallpaper(this.daemon.bus.queue[0], false);
        }
    },

    destroy: function() {
        this.daemon.disconnectSignal(this._next_file_id);

        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }
    },

    _createImageTexture: function(aPath) {
        Gio.file_new_for_path(aPath).read_async(GLib.PRIORITY_DEFAULT, null,
            Lang.bind(this,
                function(obj, res) {
                    try {
                        let stream = obj.read_finish(res);
                        this._textureFromStream(stream, aPath);
                    } catch (aErr) {
                        global.logError(aPath + "\n" + aErr);
                    }
                }));
    },

    _textureFromStream: function(aStream, aPath) {
        GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(aStream, this._width, -1, true, null,
            Lang.bind(this, function(obj, res) {
                try {
                    let pixBuf = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
                    let image = new Clutter.Image();
                    let scale = pixBuf.get_width() / this._width;
                    let height = pixBuf.get_height() / scale;

                    image.set_data(
                        pixBuf.get_pixels(),
                        (pixBuf.get_has_alpha() ?
                            Cogl.PixelFormat.RGBA_8888 :
                            Cogl.PixelFormat.RGB_888),
                        this._width,
                        height,
                        pixBuf.get_rowstride()
                    );

                    if (this._texture)
                        this._texture.destroy();

                    this._texture = new Clutter.Actor({
                        width: this._width,
                        height: height
                    });

                    this._texture.set_content(image);

                    this.actor.add_actor(this._texture);

                    aStream.close_async(GLib.PRIORITY_DEFAULT,
                        null,
                        function(object, res) {
                            try {
                                object.close_finish(res);
                            } catch (e) {
                                global.logError("Unable to close the stream " + e.toString());
                            }
                        });
                } catch (aErr) {
                    global.logError(aPath + "\n" + aErr);
                }
            }));
    },

    set_wallpaper: function(aPath) {
        try {
            this._path = GLib.uri_unescape_string(aPath, null);
            this._path = this._path.replace("file://", "");
            debug("Setting preview to %s".format(this._path));

            this._createImageTexture(this._path);

        } catch (aErr) {
            debug("ERROR: Failed to set preview of %s".format(this._path));
            global.logError(aErr);

            if (this._texture) {
                this._texture.destroy();
                this._texture = null;
            }

            if (this._path.substr(-4) !== ".xml")
                return;
        }
    },

    get path() {
        return this._path;
    }
};

function WallChangerStateButton() {
    this._init.apply(this, arguments);
}

WallChangerStateButton.prototype = {
    __proto__: WallChangerButton.prototype,

    _init: function(states, callback) {
        if (states.length < 2) {
            RangeError(_("You must provide at least two states for the button"));
        }

        this._callback = callback;
        this._states = states;
        this._state = 0;
        WallChangerButton.prototype._init.call(this, this._states[0].icon,
            Lang.bind(this, this._clicked));
    },

    set_state: function(state) {
        this.set_tooltip(state);

        if (state == this._states[this._state].name)
            return;

        for (let i = 0; i < this._states.length; i++) {
            if (this._states[i].name == state) {
                this.set_icon(this._states[i].icon);
                this._state = i;
                break;
            }
        }
    },

    _clicked: function() {
        let state = this._state;

        if (++state >= this._states.length)
            state = 0;

        state = this._states[state].name;
        this.set_state(state);
        this._callback(state);
    }
};

function WallChangerControls() {
    this._init.apply(this, arguments);
}

WallChangerControls.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(dbus) {
        this._dbus = dbus;
        this._settings = new WallChangerSettings();
        PopupMenu.PopupMenuSection.prototype._init.call(this, {
            focusOnHover: false,
            reactive: false
        });

        this._next = new WallChangerButton("media-skip-forward", Lang.bind(this, this.next));
        this._next.set_tooltip(_("Next Wallpaper"));

        this._prev = new WallChangerButton("media-skip-backward", Lang.bind(this, this.prev));
        this._prev.set_tooltip(_("Previous Wallpaper"));

        this._random = new WallChangerStateButton([{
            icon: "media-playlist-shuffle",
            name: "random"
        }, {
            icon: "media-playlist-repeat",
            name: "ordered"
        }], Lang.bind(this, this._toggle_random));
        this._random.set_state((this._settings.random) ? "random" : "ordered");

        this._rotation = new WallChangerStateButton([{
            icon: "media-playback-stop",
            name: "interval"
        }, {
            icon: "media-playback-start",
            name: "disabled"
        }, {
            icon: "appointment-new",
            name: "hourly"
        }], Lang.bind(this, this._toggle_rotation));
        this._rotation.set_state(this._settings.rotation);

        this.controlsBox = new Clutter.Box();
        let layout = new Clutter.BinLayout({
            x_align: Clutter.BinAlignment.FILL,
            y_align: Clutter.BinAlignment.END
        });
        this.controlsBox.set_layout_manager(layout);

        let controlsContainer = new St.Bin({
            style: "spacing: 20px;",
            x_align: St.Align.MIDDLE
        });
        let mainBox = new PopupMenu.PopupMenuSection();
        this.addMenuItem(mainBox);

        mainBox.addActor(this.controlsBox, {
            align: St.Align.MIDDLE,
            span: -1
        });
        let controls = new St.BoxLayout({
            style: "spacing: 20px;"
        });
        controls.add_actor(this._prev.actor);
        controls.add_actor(this._random.actor);
        controls.add_actor(this._rotation.actor);
        controls.add_actor(this._next.actor);
        controlsContainer.set_child(controls);

        this.controlsBox.add_actor(controlsContainer);
    },

    destroy: function() {
        this._next.destroy();
        this._prev.destroy();
        this._random.destroy();
        this._rotation.destroy();
        PopupMenu.PopupMenuSection.prototype.destroy.call(this);
    },

    next: function() {
        debug("Next");
        this._dbus.NextSync();
    },

    prev: function() {
        debug("Prev");
        this._dbus.PrevRemote(function(result) {
            if (result[0].length === 0) {
                Main.notifyError(_(AppletMeta.name), _("Unable to go back any further, no history available"));
            }
        });
    },

    _toggle_random: function(state) {
        debug("Setting order to %s".format(state));
        this._settings.random = (state == "random");
    },

    _toggle_rotation: function(state) {
        debug("Setting rotation to %s".format(state));
        this._settings.rotation = state;
    }
};

function WallChangerDaemonControl() {
    this._init.apply(this, arguments);
}

WallChangerDaemonControl.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(daemon) {
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, _("Daemon Status"));
        this.daemon = daemon;
        this.setToggleState(this.daemon.is_running);
        this._handler = this.connect("toggled", Lang.bind(this, function() {
            this.daemon.toggle();
        }));
        this._daemon_handler = this.daemon.connect("toggled", Lang.bind(this, function(obj, state) {
            this.setToggleState(state);
        }));

        this.tooltip = new MyTooltip(this.actor, _("Toggle and display the daemon status."));
    },

    destroy: function() {
        // not sure why, but removing this handler causes the extension to crash on unload... meh
        try {
            debug("Removing daemon switch handler %s".format(this._handler));
            this.disconnect(this._handler);
        } catch (aErr) {}

        debug("Removing daemon toggled handler %s".format(this._daemon_handler));
        this.daemon.disconnect(this._daemon_handler);
        PopupMenu.PopupSwitchMenuItem.prototype.destroy.call(this);
    }
};

function WallChangerOpenCurrent() {
    this._init.apply(this, arguments);
}

WallChangerOpenCurrent.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    _init: function() {
        this._background = new Gio.Settings({
            "schema": "org.cinnamon.desktop.background"
        });
        PopupMenu.PopupMenuItem.prototype._init.call(this, _("Open Current Wallpaper"));
        this._activate_id = this.connect("activate", Lang.bind(this, this._activate));
    },

    destroy: function() {
        debug("Removing current activate handler %s".format(this._activate_id));
        this.disconnect(this._activate_id);
        PopupMenu.PopupMenuItem.prototype.destroy.call(this);
    },

    _activate: function() {
        debug("Opening current wallpaper %s".format(this._background.get_string("picture-uri")));
        Util.spawn_async(["xdg-open", this._background.get_string("picture-uri")], null);
    }
};

function WallChangerPreviewMenuItem() {
    this._init.apply(this, arguments);
}

WallChangerPreviewMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(daemon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            reactive: true,
            hover: false
        });

        this._settings = Settings;

        this._box = new St.BoxLayout({
            vertical: true
        });

        this.addActor(this._box, {
            align: St.Align.MIDDLE,
            span: -1
        });

        this.tooltip = new MyTooltip(this.actor, _("Open Next Wallpaper"));

        this._preview = new WallChangerPreview(this._settings.wallpaper_preview_width, daemon);
        this._box.add(this._preview.actor);

        this._activate_id = this.connect("activate", Lang.bind(this, this._clicked));
    },

    destroy: function() {
        debug("Removing preview activate handler %s".format(this._activate_id));
        this.disconnect(this._activate_id);

        this._preview.destroy();
        this._box.destroy();
        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    },

    _clicked: function() {
        if (this._preview.path) {
            debug("Opening file %s".format(this._preview.path));
            Util.spawn_async(["xdg-open", this._preview.path], null);
        } else {
            debug("ERROR: no preview currently set");
        }
    }
};

function WallChangerProfile() {
    this._init.apply(this, arguments);
}

WallChangerProfile.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(sensitive = true) {
        this._settings = Settings;
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this,
            _("Profile: %s").format(this._settings.current_profile));

        this._populate_profiles();
        this._settings.connect("changed::current-profile", Lang.bind(this, this.setLabel));
        this._settings.connect("changed::profiles", Lang.bind(this, this._populate_profiles));
        this.menu.connect("open-state-changed", Lang.bind(this, this._subMenuOpenStateChanged));
        this.setSensitive(sensitive);
    },

    setLabel: function() {
        this.label.text = _("Profile: %s").format(this._settings.current_profile);
    },

    _populate_profiles: function() {
        this.menu.removeAll();
        for (let index in this._settings.profiles) {
            debug("Adding menu: %s".format(index));
            let item = new PopupMenu.PopupMenuItem(index);
            item.connect("activate", Lang.bind(item, function() { // jshint ignore:line
                let settings = new WallChangerSettings();
                settings.current_profile = this.label.text;
                settings.destroy();
            }));
            this.menu.addMenuItem(item);
        }
    },

    _subMenuOpenStateChanged: function(aMenu, aOpen) {
        if (aOpen) {
            let children = aMenu._getTopMenu()._getMenuItems();
            let i = 0,
                iLen = children.length;
            for (; i < iLen; i++) {
                let item = children[i];

                if (item instanceof PopupMenu.PopupSubMenuMenuItem ||
                    item instanceof WallChangerProfile) {
                    if (aMenu !== item.menu) {
                        item.menu.close(true);
                    }
                }
            }
        }
    }
};

function WallChangerSwitch() {
    this._init.apply(this, arguments);
}

WallChangerSwitch.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(label, tooltip, key) {
        this._key = key;
        this._settings = Settings;
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, label);

        this.setToggleState(this._settings.schema.get_boolean(this._key));
        this._handler_changed = this._settings.connect("changed::" + this._key,
            Lang.bind(this, this._changed));
        this._handler_toggled = this.connect("toggled", Lang.bind(this, this._toggled));

        this.tooltip = new MyTooltip(this.actor, tooltip);
    },

    destroy: function() {
        if (this._handler_changed) {
            debug("Removing changed::%s handler %s".format(this._key, this._handler_changed));
            this._settings.disconnect(this._handler_changed);
        }

        debug("Removing switch toggled handler %s".format(this._handler_toggled));
        this.disconnect(this._handler_toggled);
    },

    _changed: function() {
        this.setToggleState(this._settings.schema.get_boolean(this._key));
    },

    _toggled: function() {
        debug("Setting %s to %s".format(this._key, this.state));
        this._settings.schema.set_boolean(this._key, this.state);
    }
};

function MyTooltip() {
    this._init.apply(this, arguments);
}

MyTooltip.prototype = {
    __proto__: Tooltips.Tooltip.prototype,

    _init: function(aActor, aText) {
        Tooltips.Tooltip.prototype._init.call(this, aActor, aText);

        this._tooltip.set_style("text-align: left;width:auto;max-width: 450px;");
        this._tooltip.get_clutter_text().set_line_wrap(true);
        this._tooltip.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._tooltip.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE; // Just in case

        aActor.connect("destroy", Lang.bind(this, function() {
            this.destroy();
        }));
    },

    destroy: function() {
        Tooltips.Tooltip.prototype.destroy.call(this);
    }
};

function debug(message) {
    if (Settings.logging_enabled) {
        let caller = getCaller();
        let output = "[" + AppletUUID + "/" + caller.split("/").pop() + "] " + message;
        global.log(output);
    }
}

/* Implemented the two functions below using tweaked code from:
 * http://stackoverflow.com/a/13227808
 */

function getCaller() {
    let stack = getStack();

    // Remove superfluous function calls on stack
    stack.shift(); // getCaller --> getStack
    stack.shift(); // debug --> getCaller

    // Return caller's caller
    return stack[0];
}

function getStack() {
    // Save original Error.prepareStackTrace
    let origPrepareStackTrace = Error.prepareStackTrace;

    // Override with function that just returns `stack`
    Error.prepareStackTrace = function(_, stack) {
        return stack;
    };

    // Create a new `Error`, which automatically gets `stack`
    let err = new Error();

    // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
    let stack = err.stack.split("\n");

    // Restore original `Error.prepareStackTrace`
    Error.prepareStackTrace = origPrepareStackTrace;

    // Remove superfluous function call on stack
    stack.shift(); // getStack --> Error

    return stack;
}

/**
 * Compares two software version numbers (e.g. "1.7.1" or "1.2b").
 *
 * This function was born in http://stackoverflow.com/a/6832721.
 *
 * @param {string} v1 The first version to be compared.
 * @param {string} v2 The second version to be compared.
 * @param {object} [options] Optional flags that affect comparison behavior:
 * <ul>
 *     <li>
 *         <tt>lexicographical: true</tt> compares each part of the version strings lexicographically instead of
 *         naturally; this allows suffixes such as "b" or "dev" but will cause "1.10" to be considered smaller than
 *         "1.2".
 *     </li>
 *     <li>
 *         <tt>zeroExtend: true</tt> changes the result if one version string has less parts than the other. In
 *         this case the shorter string will be padded with "zero" parts instead of being considered smaller.
 *     </li>
 * </ul>
 * @returns {number|NaN}
 * <ul>
 *    <li>0 if the versions are equal</li>
 *    <li>a negative integer iff v1 < v2</li>
 *    <li>a positive integer iff v1 > v2</li>
 *    <li>NaN if either version string is in the wrong format</li>
 * </ul>
 *
 * @copyright by Jon Papaioannou (["john", "papaioannou"].join(".") + "@gmail.com")
 * @license This function is in the public domain. Do what you want with it, no strings attached.
 */
function versionCompare(v1, v2, options) {
    let lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (let i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        } else if (v1parts[i] > v2parts[i]) {
            return 1;
        } else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}

// I had to replicate the _removeAppletFromPanel from AppletManager because in the
// Cinnamon Tweaks extension I highjack this function to add a confirmation dialog.
function _removeAppletFromPanel(aUUID, aApplet_id) {
    let enabledApplets = AppletManager.enabledAppletDefinitions.raw;
    for (let i = 0; i < enabledApplets.length; i++) {
        let appletDefinition = AppletManager.getAppletDefinition(enabledApplets[i]);

        if (appletDefinition) {
            if (aUUID == appletDefinition.uuid && aApplet_id == appletDefinition.applet_id) {
                let newEnabledApplets = enabledApplets.slice(0);
                newEnabledApplets.splice(i, 1);
                global.settings.set_strv("enabled-applets", newEnabledApplets);
                break;
            }
        }
    }
}

function informAndDisable(aInstance_id) {
    try {
        let msg = [
            _("Applet activation aborted!!!"),
            _("Your Cinnamon version may not be compatible!!!"),
            _("Minimum Cinnamon version allowed: 3.0")
        ];
        global.logError(_(AppletMeta.name) + "\n" + msg.join("\n"));
        Main.criticalNotify(_(AppletMeta.name), msg.join("\n"));
    } finally {
        let removal = Mainloop.timeout_add(
            3000,
            function() {
                try {
                    _removeAppletFromPanel(AppletUUID, aInstance_id);
                } finally {
                    Mainloop.source_remove(removal);
                }
            }
        );
    }
}

/*
exported CINNAMON_VERSION,
         WallChangerStateButton,
         WallChangerControls,
         WallChangerDaemonControl,
         WallChangerOpenCurrent,
         WallChangerProfile,
         WallChangerPreviewMenuItem,
         WallChangerSwitch,
         versionCompare,
         informAndDisable
 */
