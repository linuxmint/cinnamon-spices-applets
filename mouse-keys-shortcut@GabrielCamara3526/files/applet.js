const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

class MyApplet extends Applet.IconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.set_applet_icon_symbolic_name("input-mouse-symbolic");
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
    Util.spawnCommandLine(
      "sh -c 'if gsettings get org.cinnamon.desktop.a11y.keyboard mousekeys-enable | grep -q false; then " +
      "gsettings set org.cinnamon.desktop.a11y.keyboard mousekeys-enable true; " +
      "notify-send -u normal -i preferences-desktop-accessibility-symbolic \"Mouse Keys: ON\" \"Control the pointer using the keypad\"; " +
      "else " +
      "gsettings set org.cinnamon.desktop.a11y.keyboard mousekeys-enable false; " +
      "notify-send -u normal -i preferences-desktop-accessibility-symbolic \"Mouse Keys: OFF\" \"Control the pointer using the keypad\"; " +
      "fi'"
    );
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(metadata, orientation, panel_height, instance_id);
}
