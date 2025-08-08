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
      "keyOpen",         
      "keybinding",      
      this.on_keybinding_changed.bind(this),
      null
    );

    this.actor.connect(
      "key-press-event",
      this._onSourceKeyPress.bind(this)
    );

    this.on_keybinding_changed();
    this.keyboardSettings = new Gio.Settings({ schema: 'org.cinnamon.desktop.a11y.keyboard' });
    this.keyboardSettings.connect('changed::mousekeys-enable', () => {
      this.updateIcon()})
    this.themeSettings = new Gio.Settings({ schema: 'org.cinnamon.theme'});
    this.themeSettings.connect('changed::name', () => {
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
    this.on_applet_clicked(); 
  }

  on_applet_clicked() {
    let settings = new Gio.Settings({ schema: 'org.cinnamon.desktop.a11y.keyboard' });
    let mouseKeysEnable = settings.get_boolean('mousekeys-enable');
    if (!mouseKeysEnable) {
      settings.set_boolean('mousekeys-enable', true)
      Main.notify("Mouse Keys: ON", "Control the pointer using the keypad");
    } 
    else {
      settings.set_boolean('mousekeys-enable', false)
      Main.notify("Mouse Keys: OFF", "Control the pointer using the keypad")
    }
      this.updateIcon()
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