const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "profile-switcher@pixunil";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

//bind function with exception catching
function bind(func, context){
    var additionalArgs = [];
    for(let i = 2, l = arguments.length; i < l; ++i)
        additionalArgs.push(arguments[i]);

    function callback(){
        try {
            let args = additionalArgs.slice(0);
            args.push.apply(args, arguments);

            return func.apply(context, args);
        } catch(e){
            global.logError(e);
            return null;
        }
    }

    return callback;
}

//recursively unpacks variants
function unpack(value){
    if(value instanceof GLib.Variant)
        value = value.unpack();
    if(value instanceof Object){
        for(let i in value)
            value[i] = unpack(value[i]);
    }
    return value;
}

function IconMenuItem(){
    this._init.apply(this, arguments);
}

IconMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, params){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.icon = new St.Icon({style_class: "popup-menu-icon", icon_name: icon, icon_type: St.IconType.SYMBOLIC});
        this.label = new St.Label({text: text});

        this.addActor(this.icon);
        this.addActor(this.label);
    },

    setColumnWidths: function(){
        this._columnWidths = null;
    },

    getColumnWidths: function(){
        return [];
    }
};

function ProfileMenuItem(){
    this._init.apply(this, arguments);
}

ProfileMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(manager, profileName){
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, profileName, true);

        this.profileName = profileName;

        this.connect("activate", bind(manager.changeProfile, manager));

        let addItem = new IconMenuItem(_("Add Profile"), "list-add");
        addItem.connect("activate", bind(manager.addProfile, manager, this));
        this.menu.addMenuItem(addItem);

        let removeItem = new IconMenuItem(_("Remove Profile"), "list-remove");
        removeItem.activate = bind(manager.removeProfile, manager, this);
        this.menu.addMenuItem(removeItem);

        removeItem = new IconMenuItem(_("Rename Profile"), "text-editor");
        removeItem.connect("activate", bind(manager.renameProfile, manager, this));
        this.menu.addMenuItem(removeItem);
    },

    _onButtonReleaseEvent: function(actor, event){
        if(event.get_button() === 1)
            this.activate();
        if(event.get_button() === 3)
            this.menu.toggle();
        return true;
    },

    activate: function(event, keepMenu){
        this.emit("activate", event, keepMenu);
    }
};

function EntryDialog(){
    this._init.apply(this, arguments);
}

EntryDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(text, callback){
        ModalDialog.ModalDialog.prototype._init.call(this);
        this.entry = new St.Entry({
            name: "menu-search-entry",
            hint_text: text,
            track_hover: true,
            can_focus: true
        });
        this.contentLayout.add(this.entry);
        global.stage.set_key_focus(this.entry);

        this.setButtons([{
            label: _("OK"),
            action: bind(function(){
                let text = this.entry.get_text();
                this.destroy();
                callback(text);
            }, this)
        }]);
    }
};

function ProfileManager(){
    this._init.apply(this, arguments);
}

ProfileManager.prototype = {
    _init: function(applet){
        this.applet = applet;
        this.settings = applet.settings;

        this.gsettings = {};
        let availableSchemas = Gio.Settings.list_schemas();
        for(let i = 0, l = availableSchemas.length; i < l; ++i){
            let schema = availableSchemas[i];
            if(schema.match("cinnamon"))
                this.gsettings[schema] = new Gio.Settings({schema: schema});
        }
    },

    addProfile: function(){
        let dialog = new EntryDialog(_("Profile name"), bind(function(name){
            if(name !== "" && !this.settings.profiles[name]){
                let activeProfile = this.settings.profiles[this.settings.activeProfile];
                //clone profile object
                this.settings.profiles[name] = JSON.parse(JSON.stringify(activeProfile));
                this.settings.activeProfile = name;

                this.applet.buildProfilesSection();
            }
        }, this));
        dialog.open();
    },

    removeProfile: function(item){
        let profileName = item.profileName;
        delete this.settings.profiles[profileName];
        this.settings.profiles.save();
        if(profileName === this.settings.activeProfile){
            for(let profile in this.settings.profiles){
                if(profile !== "save"){
                    this.changeProfile(profile);
                    break;
                }
            }
        }

        item.destroy();
    },

    renameProfile: function(item){
        let dialog = new EntryDialog(_("Profile name"), bind(function(newName){
            if(newName !== "" && !this.settings.profiles[newName]){
                let oldName = item.profileName;

                this.settings.profiles[newName] = this.settings.profiles[oldName];
                delete this.settings.profiles[oldName];
                if(this.settings.activeProfile === oldName)
                    this.settings.activeProfile = newName;

                item.label.text = newName;
            }
        }, this));
        dialog.open();
    },

    changeProfile: function(item){
        let profileName = item.profileName;
        let profile = this.settings.profiles[profileName];
        this.settings.activeProfile = profileName;

        for(let schema in profile){
            let settings = this.gsettings[schema];
            for(let key in profile[schema]){
                let type = this.getVariantType(settings, key);
                settings.set_value(key, new GLib.Variant(type, profile[schema][key]));
            }
        }
        this.applet.updateProfilesSection();
    },

    getVariantType: function(settings, key){
        let range = settings.get_range(key);
        let type = range.get_child_value(0).unpack();
        let v = range.get_child_value(1);

        if(type === "type"){
            //v is boxed empty array, type of its elements is the allowed value type
            return v.get_child_value(0).get_type_string().slice(1);
        } else if(type === "enum"){
            //v is an array with the allowed values
            return v.get_child_value(0).get_child_value(0).get_type_string();
        } else if(type === "flags"){
            //v is an array with the allowed values
            return v.get_child_value(0).get_type_string();
        } else if(type === "range"){
            //type_str is a tuple giving the range
            return v.get_child_value(0).get_type_string()[1];
        }
    },

    onGSettingsChanged: function(settings, key){
        let profile = this.settings.profiles[this.settings.activeProfile];
        let schema = settings.schema;

        if(!profile[schema])
            profile[schema] = {};

        if(profile[schema][key] === undefined){
            let defaultValue = unpack(settings.get_default_value(key));
            for(let profile in this.settings.profiles){
                if(profile === this.settings.activeProfile)
                    continue;

                profile = this.settings.profiles[profile];

                if(!profile[schema])
                    profile[schema] = {};

                profile[schema][key] = defaultValue;
            }
        }

        let value = unpack(settings.get_value(key));
        profile[schema][key] = value;

        this.settings.profiles.save();
    },

    changeTrackState: function(active){
        for(let schema in this.gsettings){
            let settings = this.gsettings[schema];

            if(settings.changedId){
                settings.disconnect(settings.changedId);
                delete settings.changedId;
            }

            if(active)
                settings.changedId = settings.connect("changed", bind(this.onGSettingsChanged, this));
        }
    },

    finalize: function(){
        for(let schema in this.gsettings){
            let settings = this.gsettings[schema];

            if(settings.changedId){
                settings.disconnect(settings.changedId);
                delete settings.changedId;
            }
        }
    }
};

function ProfileSwitcherApplet(){
    this._init.apply(this, arguments);
}

ProfileSwitcherApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId){
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this.set_applet_icon_symbolic_name("avatar-default");

        this.settings = {};
        this.settingProvider = new Settings.AppletSettings(this.settings, "profile-switcher@pixunil", instanceId);

        this.manager = new ProfileManager(this);

        this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "active-profile", "activeProfile", bind(this.updateProfilesSection, this));
        this.settingProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "profiles", "profiles", bind(this.buildProfilesSection, this));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.profilesSection = new PopupMenu.PopupMenuSection;
        this.menu.addMenuItem(this.profilesSection);

        this.buildProfilesSection();

        this.trackChanges = new PopupMenu.PopupSwitchMenuItem(_("Track changes"), false);
        this._applet_context_menu.addMenuItem(this.trackChanges);
        this.trackChanges.connect("toggled", bind(this.onTrackStateChanged, this));

        let addProfile = new IconMenuItem(_("Add profile"), "list-add");
        this._applet_context_menu.addMenuItem(addProfile);
        addProfile.connect("activate", bind(this.manager.addProfile, this.manager));
    },

    buildProfilesSection: function(){
        let items = this.profilesSection._getMenuItems();
        let oldProfiles = {};
        for(let i = 0, l = items.length; i < l; ++i)
            oldProfiles[items[i].profileName] = items[i];

        for(let profile in this.settings.profiles){
            if(oldProfiles[profile]){
                delete oldProfiles[profile];
            } else if(profile !== "save"){
                let item = new ProfileMenuItem(this.manager, profile);
                this.profilesSection.addMenuItem(item);
            }
        }

        for(let profile in oldProfiles)
            oldProfiles[profile].destroy();

        this.updateProfilesSection();
    },

    updateProfilesSection: function(){
        let items = this.profilesSection._getMenuItems();
        for(let i = 0, l = items.length; i < l; ++i)
            items[i].setShowDot(items[i].profileName === this.settings.activeProfile);

        this.set_applet_tooltip(_("%s Profile").format(this.settings.activeProfile));
    },

    onTrackStateChanged: function(item){
        this.manager.changeTrackState(!!item.state);
    },

    on_applet_clicked: function(){
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function(){
        if(this.gsettingsChangedId)
            this.gsettings.disconnect(this.gsettingsChangedId);
        this.settingProvider.finalize();
        this.manager.finalize();
    }
};

function main(metadata, orientation, panelHeight, instanceId){
    return new ProfileSwitcherApplet(orientation, panelHeight, instanceId);
}
