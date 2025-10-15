const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const SCROLL_DELAY = 350; // ms

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

    this.metadata = metadata;
    this._profilesProxy = null;
    this._proxyId = 0;

    try {
      this._profilesProxy = new PowerProfilesProxy(Gio.DBus.system, BUS_NAME, BUS_PATH);
    } catch (error) {
      global.log(`${UUID}: ` + _("Please make sure the power-profiles-daemon package is installed and the service is running."));
      global.logError(`${UUID}: ` + _("exception:") + ` ${error.toString()}`);
      self._check_powerprofilesctl();
      return;
    }

    if (!this._profilesProxy.ActiveProfile) {
      global.logError(`${UUID}: ` + _("Please make sure the power-profiles-daemon package is installed and the service is running."));
      self._check_powerprofilesctl();
      return;
    }

    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bind("previousProfileKey", "previousProfileKey", this._setKeybinding);
    this.settings.bind("nextProfileKey", "nextProfileKey", this._setKeybinding);
    this.settings.bind("cycleProfiles", "cycleProfiles");
    this.settings.bind("showOSD", "showOSD");
    this.settings.bind("iconStyle", "iconStyle", this._onIconStyleChanged);
    this.settings.bind("scrollBehavior", "scrollBehavior");

    this.ActiveProfile = this._profilesProxy.ActiveProfile;
    this.PerformanceDegraded = this._profilesProxy.PerformanceDegraded;
    this.Profiles = this._profilesProxy.Profiles;
    this.ActiveProfileHolds = this._profilesProxy.ActiveProfileHolds;

    this._setIconMap();

    this._proxyId = this._profilesProxy.connect("g-properties-changed", (proxy, changed, invalidated) => {
      for (let [changedProperty, changedValue] of Object.entries(changed.deepUnpack())) {
        if (["ActiveProfile", "ActiveProfileHolds", "PerformanceDegraded", "Profiles"].includes(changedProperty))
            this[changedProperty] = changedValue.deepUnpack();
        this._update();
      }
    });

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.contentSection = new PopupMenu.PopupMenuSection();

    this._lastScrollDirection = null;
    this._lastScrollTime = 0;

    this._scrollEventId = this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

    this._updateApplet();
    this.set_show_label_in_vertical_panels(false);
    this._setKeybinding();
  },

  _check_powerprofilesctl() {
    if (!GLib.find_program_in_path("powerprofilesctl")) {
      let source = new MessageTray.Source(this.metadata.name);
      let params = { icon: new St.Icon({ icon_name: "dialog-error-symbolic", icon_size: 48 }) };
      let notification = new MessageTray.Notification(source, _("Power Profiles Applet Error"),
        _("The system package 'power-profiles-daemon' is not installed.\n\nPlease install it and reload the applet."), params);

      notification.addButton("open-readme", _("Open README"));
      notification.addButton("open-website", _("Open Website"));
      notification.connect("action-invoked", (self, action) => {
        let launcher = new Gio.SubprocessLauncher({
          flags: (Gio.SubprocessFlags.STDIN_PIPE |
              Gio.SubprocessFlags.STDOUT_PIPE |
              Gio.SubprocessFlags.STDERR_PIPE)
        });

        if (action == "open-readme") {
          launcher.spawnv(["open", `${metadata.path}/../README.md`]);
        } else if (action == "open-website") {
          launcher.spawnv(["open",
            "https://github.com/linuxmint/cinnamon-spices-applets/tree/master/power-profiles@rcalixte#dependencies"]);
        }
      });

      Main.messageTray.add(source);
      source.notify(notification);
      return;
    }
  },

  _update() {
    this.menu.removeAll();
    this._updateApplet();
  },

  _updateApplet() {
    this.set_applet_icon_path(this.iconMap.get(this.ActiveProfile));
    this.set_applet_label("");
    this.set_applet_tooltip(_("Current Profile:") + ` ${POWER_PROFILES[this.ActiveProfile]}`);

    this.menu.addMenuItem(this.contentSection);

    if (this.PerformanceDegraded) {
      let perfText = _("Performance Degraded:") + ` ${this.PerformanceDegraded}`;
      let perfItem = new PopupMenu.PopupIconMenuItem(perfText, "dialog-warning-symbolic",
        St.IconType.SYMBOLIC, { reactive: false });
      this.menu.addMenuItem(perfItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    if (this.ActiveProfileHolds.length > 0) {
      let holdAppId = this.ActiveProfileHolds[0].ApplicationId.unpack();
      let holdReason = this.ActiveProfileHolds[0].Reason.unpack();
      let activeText = _("Active Profile Holds:");
      let activeItem = new PopupMenu.PopupMenuItem(activeText, { reactive: false });
      this.menu.addMenuItem(activeItem);

      let reasonText = `${holdAppId}\n${holdReason}`;
      let reasonItem = new PopupMenu.PopupIconMenuItem(reasonText, "dialog-information-symbolic",
        St.IconType.SYMBOLIC, { reactive: false });
      this.menu.addMenuItem(reasonItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    for (let profileNum = 0; profileNum < this.Profiles.length; profileNum++) {
      let profileName = this.Profiles[profileNum].Profile.unpack();
      let activeItem;
      if (profileName == this.ActiveProfile) {
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
    this.ActiveProfile = this._profilesProxy.ActiveProfile;
  },

  _setKeybinding() {
    this._unsetKeybinding();
    Main.keybindingManager.addHotKey("power-profiles-previous-" + this.instance_id,
      this.previousProfileKey,
      () => this._previousProfile(this.showOSD));
    Main.keybindingManager.addHotKey("power-profiles-next-" + this.instance_id,
      this.nextProfileKey,
      () => this._nextProfile(this.showOSD));
  },

  _unsetKeybinding() {
    Main.keybindingManager.removeHotKey("power-profiles-previous-" + this.instance_id);
    Main.keybindingManager.removeHotKey("power-profiles-next-" + this.instance_id);
  },

  _switchToProfileByIndex(newIndex, showOSD) {
    let nextProfile = this.Profiles[newIndex].Profile.unpack();
    if (newIndex != this.profileIndex)
      this._changeProfile(nextProfile);

    if (showOSD)
      Main.osdWindowManager.show(-1,
        Gio.Icon.new_for_string(this.iconMap.get(this.ActiveProfile)));
  },

  _previousProfile(showOSD) {
    let nextIndex = this.profileIndex - 1 < 0 ?
      (this.cycleProfiles ? this.Profiles.length - 1 : this.profileIndex) :
      this.profileIndex - 1;
    this._switchToProfileByIndex(nextIndex, showOSD);
  },

  _nextProfile(showOSD) {
    let nextIndex = this.profileIndex + 1 >= this.Profiles.length ?
      (this.cycleProfiles ? 0 : this.profileIndex) :
      this.profileIndex + 1;
    this._switchToProfileByIndex(nextIndex, showOSD);
  },

  on_applet_removed_from_panel() {
    this._unsetKeybinding();

    if (this._scrollEventId) {
      this.actor.disconnect(this._scrollEventId);
      this._scrollEventId = 0;
    }

    if (!this._profilesProxy)
      return;

    if (this._proxyId)
      this._profilesProxy.disconnect(this._proxyId);
  },

  on_applet_clicked(event) {
    this.menu.toggle();
  },

  _onIconStyleChanged() {
    this._setIconMap();
    this._updateApplet();
  },

  _setIconMap() {
    this.iconMap = new Map();
    this.iconMap.set(this.Profiles[0].Profile.unpack(), this.metadata.path + `/../icons/${this.iconStyle}/profile-0-symbolic.svg`);
    this.iconMap.set(this.Profiles.slice(-1)[0].Profile.unpack(), this.metadata.path + `/../icons/${this.iconStyle}/profile-100-symbolic.svg`);
    if (this.iconMap.size != this.Profiles.length)
      this.iconMap.set(this.Profiles[1].Profile.unpack(), this.metadata.path + `/../icons/${this.iconStyle}/profile-50-symbolic.svg`);
  },

  _onScrollEvent(actor, event) {
      if (this.scrollBehavior == "nothing") {
          return GLib.SOURCE_CONTINUE;
      }

      const direction = event.get_scroll_direction();

      if (direction == Clutter.ScrollDirection.SMOOTH) {
          return GLib.SOURCE_CONTINUE;
      }

      const time = event.get_time();

      if (time > (this._lastScrollTime + SCROLL_DELAY) ||
          direction !== this._lastScrollDirection) {

          if (!((direction == Clutter.ScrollDirection.UP) ^ (this.scrollBehavior == "normal")))
              this._previousProfile(false);
          else
              this._nextProfile(false);

          this._lastScrollDirection = direction;
          this._lastScrollTime = time;
      }

      return GLib.SOURCE_CONTINUE;
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new PowerProfilesApplet(metadata, orientation, panel_height, instance_id);
}
