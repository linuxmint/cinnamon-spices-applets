const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;

// l10n/translation support
const UUID = "power-profiles@rcalixte";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// DBus
const BUS_NAME = "net.hadess.PowerProfiles";
const BUS_PATH = "/net/hadess/PowerProfiles";

const POWER_PROFILES = {
  "power-saver": _("Power Saver"),
  "balanced": _("Balanced"),
  "performance": _("Performance")
};

const PowerProfilesInterface = `<node>
  <interface name="net.hadess.PowerProfiles">
    <property name="ActiveProfile" type="s" access="readwrite" />
    <property name="PerformanceDegraded" type="s" access="read" />
    <property name="Profiles" type="aa{sv}" access="read" />
    <property name="ActiveProfileHolds" type="aa{sv}" access="read" />
  </interface>
</node>`;

const PowerProfilesProxy = Gio.DBusProxy.makeProxyWrapper(PowerProfilesInterface);

function PowerProfilesApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

PowerProfilesApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function (metadata, orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this._profilesProxy = null;
    this._proxyId = 0;

    try {
      this._profilesProxy = new PowerProfilesProxy(Gio.DBus.system, BUS_NAME, BUS_PATH);
    } catch (error) {
      global.log(`${UUID}: ` + _("Please make sure the power-profiles-daemon package is installed and the service is running."));
      global.logError(`${UUID}: ` + _("exception:") + ` ${error.toString()}`);
      return;
    }

    if (!this._profilesProxy.ActiveProfile) {
      global.logError(`${UUID}: ` + _("Please make sure the power-profiles-daemon package is installed and the service is running."));
      return;
    }

    this.activeProfile = this._profilesProxy.ActiveProfile;
    this.performanceDegraded = this._profilesProxy.PerformanceDegraded;
    this.profiles = this._profilesProxy.Profiles;
    this.activeProfileHolds = this._profilesProxy.ActiveProfileHolds;
    this.iconMap = new Map();
    this.iconMap.set(this.profiles[0].Profile.unpack(), metadata.path + "/../icons/profile-0-symbolic.svg");
    this.iconMap.set(this.profiles.slice(-1)[0].Profile.unpack(), metadata.path + "/../icons/profile-100-symbolic.svg");
    if (this.iconMap.size != this.profiles.length)
      this.iconMap.set(this.profiles[1].Profile.unpack(), metadata.path + "/../icons/profile-50-symbolic.svg");

    this._proxyId = this._profilesProxy.connect("g-properties-changed", (proxy, changed, invalidated) => {
      for (let [changedProperty, changedValue] of Object.entries(changed.deepUnpack())) {
        switch (changedProperty) {
          case "ActiveProfile":
            this.activeProfile = changedValue.deepUnpack();
            break;
          case "PerformanceDegraded":
            this.performanceDegraded = changedValue.deepUnpack();
            break;
          case "Profiles":
            this.performanceDegraded = changedValue.deepUnpack();
            break;
          case "ActiveProfileHolds":
            this.activeProfileHolds = changedValue.deepUnpack();
        }
        this._update();
      }
    });

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.contentSection = new PopupMenu.PopupMenuSection();

    this._updateApplet();
    this.set_show_label_in_vertical_panels(false);

    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bind("previousProfileKey", "previousProfileKey", this._setKeybinding);
    this.settings.bind("nextProfileKey", "nextProfileKey", this._setKeybinding);
    this.settings.bind("cycleProfiles", "cycleProfiles");
    this.settings.bind("showOSD", "showOSD");
    this._setKeybinding();
  },

  _update() {
    this.menu.removeAll();
    this._updateApplet();
  },

  _updateApplet() {
    this.set_applet_icon_path(this.iconMap.get(this.activeProfile));
    this.set_applet_label("");
    this.set_applet_tooltip(_("Current Profile:") + ` ${POWER_PROFILES[this.activeProfile]}`);

    this.menu.addMenuItem(this.contentSection);

    if (this.performanceDegraded) {
      let perfText = _("Performance Degraded:") + ` ${this.performanceDegraded}`;
      let perfItem = new PopupMenu.PopupIconMenuItem(perfText, "dialog-warning-symbolic",
        St.IconType.SYMBOLIC, { reactive: false });
      this.menu.addMenuItem(perfItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    if (this.activeProfileHolds.length > 0) {
      let holdAppId = this.activeProfileHolds[0].ApplicationId.unpack();
      let holdReason = this.activeProfileHolds[0].Reason.unpack();
      let activeText = _("Active Profile Holds:");
      let activeItem = new PopupMenu.PopupMenuItem(activeText, { reactive: false });
      this.menu.addMenuItem(activeItem);

      let reasonText = `${holdAppId}\n${holdReason}`;
      let reasonItem = new PopupMenu.PopupIconMenuItem(reasonText, "dialog-information-symbolic",
        St.IconType.SYMBOLIC, { reactive: false });
      this.menu.addMenuItem(reasonItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    for (let profileNum = 0; profileNum < this.profiles.length; profileNum++) {
      let profileName = this.profiles[profileNum].Profile.unpack();
      let activeItem;
      if (profileName == this.activeProfile) {
        activeItem = true;
        this.profileIndex = profileNum;
      } else {
        activeItem = false;
      }

      let item = new PopupMenu.PopupMenuItem(POWER_PROFILES[profileName], { reactive: !activeItem });
      item.setShowDot(activeItem);
      if (!activeItem)
        item.connect("activate", Lang.bind(this, function () {
          this._changeProfile(profileName);
        }));

      this.menu.addMenuItem(item);
    }
  },

  _changeProfile(newProfile) {
    this._profilesProxy.ActiveProfile = newProfile;
    this.activeProfile = this._profilesProxy.ActiveProfile;
  },

  _setKeybinding() {
    Main.keybindingManager.addHotKey("power-profiles-previous-" + this.instance_id,
      this.previousProfileKey,
      Lang.bind(this, this._previousProfile));
    Main.keybindingManager.addHotKey("power-profiles-next-" + this.instance_id,
      this.nextProfileKey,
      Lang.bind(this, this._nextProfile));
  },

  _switchToProfileByIndex(newIndex) {
    let nextProfile = this.profiles[newIndex].Profile.unpack();
    if (newIndex != this.profileIndex)
      this._changeProfile(nextProfile);

    if (this.showOSD)
      Main.osdWindowManager.show(-1,
        Gio.Icon.new_for_string(this.iconMap.get(this.activeProfile)));
  },

  _previousProfile() {
    let nextIndex = this.profileIndex - 1 < 0 ?
      (this.cycleProfiles ? this.profiles.length - 1 : this.profileIndex) :
      this.profileIndex - 1;
    this._switchToProfileByIndex(nextIndex);
  },

  _nextProfile() {
    let nextIndex = this.profileIndex + 1 >= this.profiles.length ?
      (this.cycleProfiles ? 0 : this.profileIndex) :
      this.profileIndex + 1;
    this._switchToProfileByIndex(nextIndex);
  },

  on_applet_removed_from_panel() {
    Main.keybindingManager.removeHotKey("power-profiles-previous-" + this.instance_id);
    Main.keybindingManager.removeHotKey("power-profiles-next-" + this.instance_id);

    if (!this._profilesProxy)
      return;

    if (this._proxyId)
      this._profilesProxy.disconnect(this._proxyId);
  },

  on_applet_clicked(event) {
    this.menu.toggle();
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new PowerProfilesApplet(metadata, orientation, panel_height, instance_id);
}
