const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const UUID = "mouse-keys-shortcut@GabrielCamara3526";
const APPLET_PATH = imports.ui.appletManager.appletMeta[UUID].path;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const HOME_DIR = GLib.get_home_dir();

function _(str, uuid=UUID) {
  if (str == null) return "";
  Gettext.bindtextdomain(uuid, HOME_DIR + "/.local/share/locale");
  let _str = Gettext.dgettext(uuid, str);
  if (_str !== str)
    return _str;
  // If the text was not found locally then try with system-wide translations:
  return Gettext.gettext(str);
}

class MyApplet extends Applet.IconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.set_applet_tooltip(_("Control the pointer using the keypad"));

    this.settings = new Settings.AppletSettings(
      this,
      metadata.uuid,
      instance_id
    );

    this.settings.bindProperty(
      Settings.BindingDirection.IN,
      "enableNotifications",
      "enableNotifications",
      null,
      null
    );
    this.settings.bindProperty(
      Settings.BindingDirection.IN,
      "enableOSD",
      "enableOSD",
      null,
      null
    );
    this.settings.bindProperty(
      Settings.BindingDirection.IN,
      "keyOpen",
      "keybinding",
      this.on_keybinding_changed.bind(this),
      null
    );
    this.settings.bindProperty(
      Settings.BindingDirection.BIDIRECTIONAL,
      "initial-delay",
      "initialDelay",
      this.on_delay_changed.bind(this),
      null
    );
    this.settings.bindProperty(
      Settings.BindingDirection.BIDIRECTIONAL,
      "acceleration-time",
      "accelerationTime",
      this.on_acceleration_changed.bind(this),
      null
    );
    this.settings.bindProperty(
      Settings.BindingDirection.BIDIRECTIONAL,
      "maximum-speed",
      "maxSpeed",
      this.on_speed_changed.bind(this),
      null
    );
    this.actor.connect(
      "key-press-event",
      this._onSourceKeyPress.bind(this)
    )
    this.on_keybinding_changed()
    this.keyboardSettings = new Gio.Settings({ schema: 'org.cinnamon.desktop.a11y.keyboard' })
    let userInitDelay = this.keyboardSettings.get_int('mousekeys-init-delay')
    let userAccelTime = this.keyboardSettings.get_int('mousekeys-accel-time');
    let userMaxSpeed = this.keyboardSettings.get_int('mousekeys-max-speed');

    this.settings.setValue("initial-delay", userInitDelay)
    this.settings.setValue("acceleration-time", userAccelTime)
    this.settings.setValue("maximum-speed", userMaxSpeed)

    this.keyboardSettings.connect('changed::mousekeys-init-delay', () => {
      let newInitDelay = this.keyboardSettings.get_int('mousekeys-init-delay')
      this.settings.setValue("initial-delay", newInitDelay)
    })
    this.keyboardSettings.connect('changed::mousekeys-accel-time', () => {
      let newAccelTime = this.keyboardSettings.get_int('mousekeys-accel-time')
      this.settings.setValue("acceleration-time", newAccelTime)
    })
    this.keyboardSettings.connect('changed::mousekeys-max-speed', () => {
      let newMaxSpeed = this.keyboardSettings.get_int('mousekeys-max-speed')
      this.settings.setValue("maximum-speed", newMaxSpeed)
    })

    this.themeSettings = new Gio.Settings({ schema: 'org.cinnamon.theme'});
    this.themeSettings.connect('changed::name', () => {
      this.updateIcon()})
    this.keyboardSettings.connect('changed::mousekeys-enable', () => {
      this.updateIcon()})
    this.updateIcon();
  }
  _onSourceKeyPress(actor, event) {
    let symbol = event.get_key_symbol();
    if (symbol === Clutter.KEY_space || symbol === Clutter.KEY_Return) {
      this.menu.toggle();
      return true;
    } else if (symbol === Clutter.KEY_Escape && this.menu?.isOpen) {
      this.menu.close();
      return true;
    } else if (symbol === Clutter.KEY_Down) {
      if (!this.menu?.isOpen) this.menu.toggle();
      this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
      return true;
    }
    return false;
  }

  on_keybinding_changed() {
    Main.keybindingManager.addHotKey(
      "toggle-keypad-mouse-shortcut",
      this.keybinding,
      this.on_hotkey_triggered.bind(this)
    );
  }
  on_hotkey_triggered() {
    if (this.settings.getValue("enableShortcut")) {
      this.on_applet_clicked();
    }
  }

  on_applet_clicked() {
    let icon;
    let settings = new Gio.Settings({ schema: 'org.cinnamon.desktop.a11y.keyboard' });
    let mouseKeysEnable = settings.get_boolean('mousekeys-enable');
    if (!mouseKeysEnable) {
      settings.set_boolean('mousekeys-enable', true);
      if (this.enableNotifications)
        Main.notify(_("Mouse Keys: ON", UUID), _("Control the pointer using the keypad", UUID));
      if (this.enableOSD) {
        icon = Gio.Icon.new_for_string("light-icon");
        Main.osdWindowManager.show(-1, icon, _("Mouse Keys: ON", UUID), null);
      }
    }
    else {
      settings.set_boolean('mousekeys-enable', false)
      if (this.enableNotifications)
        Main.notify(_("Mouse Keys: OFF", UUID), _("Control the pointer using the mouse", UUID));
      if (this.enableOSD) {
        icon = Gio.Icon.new_for_string("dark-icon");
        Main.osdWindowManager.show(-1, icon, _("Mouse Keys: OFF", UUID), null);
      }
    }
      this.updateIcon()
    }

  on_delay_changed(){
    this.keyboardSettings.set_int('mousekeys-init-delay', this.initialDelay)
  }
  on_acceleration_changed() {
    this.keyboardSettings.set_int('mousekeys-accel-time', this.accelerationTime)
  }
  on_speed_changed(){
    this.keyboardSettings.set_int('mousekeys-max-speed', this.maxSpeed)
  }

  updateIcon() {
    let iconFile
    let settings = new Gio.Settings({ schema: 'org.cinnamon.desktop.a11y.keyboard' });
    let enabled = settings.get_boolean('mousekeys-enable');
    let themeSettings = new Gio.Settings({ schema: 'org.cinnamon.theme'});
    let activeTheme = themeSettings.get_string('name');
    let isDark = activeTheme.toLowerCase().includes('dark');
    if (enabled) {
      iconFile = isDark ? 'light-icon.svg' : 'dark-icon.svg';
    } else {
      iconFile = isDark ? 'dark-icon.svg' : 'light-icon.svg'
    }
    let iconPath = `${APPLET_PATH}/icons/${iconFile}`;
    this.set_applet_icon_symbolic_path(iconPath);
  }
}
function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(metadata, orientation, panel_height, instance_id);
}
