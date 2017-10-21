const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const ExtensionSystem = imports.ui.extensionSystem;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const uuid = "extensions@dalcde";

// l10n/translation support
Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(uuid, str);
}

function translate_extension(uuid, str) {
  return Gettext.dgettext(uuid, str);
}

const ExtensionState = ExtensionSystem.ExtensionState;

function ExtensionSwitch(uuid){
    this._init(uuid);
}

ExtensionSwitch.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(uuid){
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, "", true);

        this.uuid = uuid;
        this.meta = ExtensionSystem.extensionMeta[uuid];

        if (this.meta.state == ExtensionState.DISABLED)
            this.setToggleState(false);

        this.label.set_text(translate_extension(this.meta.uuid, this.meta.name));
        this.connect('toggled', Lang.bind(this, this._onSwitchToggled));
    },

    _onSwitchToggled: function(item){
        let enabledExtensions = global.settings.get_strv("enabled-extensions");
        if (item.state == true){
            ExtensionSystem.enableExtension(this.uuid);
            enabledExtensions.push(this.uuid);
        } else {
            ExtensionSystem.disableExtension(this.uuid);
            enabledExtensions.splice(enabledExtensions.indexOf(this.uuid), 1);
        }
        global.log(enabledExtensions);
        global.settings.set_strv("enabled-extensions", enabledExtensions);
    }

}

function MyApplet(orientation){
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation){
        Applet.IconApplet.prototype._init.call(this, orientation);

        this.orientation = orientation;
        this.set_applet_tooltip(_("Extensions Manager"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.appletMenu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.appletMenu);

        this.set_applet_icon_symbolic_name("starred");
        this._loadExtensions();
        global.settings.connect("changed::extensions-enabled", Lang.bind(this, this._loadExtensions));
    },

    on_applet_clicked: function(){
        this.appletMenu.toggle();
    },

    _loadExtensions: function(){
        this.menuManager.removeMenu(this.appletMenu);
        this.appletMenu.destroy();
        this.appletMenu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.appletMenu);
        for (var i in ExtensionSystem.extensionMeta){
            let extensionSwitch = new ExtensionSwitch(i);
            this.appletMenu.addMenuItem(extensionSwitch);
        }
        this.appletMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.appletMenu.addAction(_("Restart Cinnamon"), function(Event){
            global.reexec_self();
        });
    }
};

function main(metadata, orientation){
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
