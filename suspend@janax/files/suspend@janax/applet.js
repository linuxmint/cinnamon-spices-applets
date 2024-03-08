const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const SignalManager = imports.misc.signalManager;

const UUID = "suspend@janax";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
   return Gettext.dgettext(UUID, str);
}

class SuspendApplet extends Applet.Applet {

   constructor(orientation, panelHeight, instanceId) {
      super(orientation, panelHeight, instanceId);
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
      this.signalManager = new SignalManager.SignalManager(null);
      this.settings = new Settings.AppletSettings(this, UUID, instanceId);

      // Icon Box to contain the icon and the count down label
      let iconSize = this.getPanelIconSize( (this.settings.getValue("fullcolor-icon")) ? St.IconType.FULLCOLOR : St.IconType.SYMBOLIC);
      this._iconBox = new St.Group({natural_width: iconSize, natural_height: iconSize, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});

      // Create the icon and it's container
      this.actor.add_actor(this._iconBox);
      this._iconBin = new St.Bin();
      this._iconBin._delegate = this;
      this._iconBox.add_actor(this._iconBin);
      this._updateIcon();

      // Create the count down number label and it's containers
      this._labelNumberBox = new St.BoxLayout();
      this._labelNumberBin = new St.Bin({important: true, style_class: "grouped-window-list-badge", x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE});
      this._labelNumber = new St.Label({style_class: "grouped-window-list-number-label"});
      this._iconBox.add_actor(this._labelNumberBox);
      this._labelNumberBox.add_actor(this._labelNumberBin);
      this._labelNumberBin.add_actor(this._labelNumber);

      this._labelNumberBox.hide();
      this.set_applet_tooltip(_("Suspend"));
      this.signalManager.connect(this.settings, "changed::fullcolor-icon", this._updateIcon, this);
   }

   _updateIcon() {
      if( this._icon ){
         this._icon.destroy();
      }
      if( this.settings.getValue("fullcolor-icon") ){
         let iconSize = this.getPanelIconSize(St.IconType.FULLCOLOR);
         this._icon = new St.Icon({ icon_name: "gnome-session-suspend",
                                    icon_type: St.IconType.FULLCOLOR,
                                    reactive: true, track_hover: true,
                                    style_class: 'applet-icon',
                                    icon_size: iconSize});
      }else{
         let iconSize = this.getPanelIconSize(St.IconType.SYMBOLIC);
         this._icon = new St.Icon({ icon_name: "weather-clear-night",
                                    icon_type: St.IconType.SYMBOLIC,
                                    reactive: true, track_hover: true,
                                    style_class: 'applet-icon'});
      }
      this._iconBin.set_child(this._icon);
      this.on_panel_icon_size_changed()
   }

   on_panel_icon_size_changed() {
      let iconSize = this.getPanelIconSize(this.settings.getValue("fullcolor-icon") ? St.IconType.FULLCOLOR : St.IconType.SYMBOLIC);
      this._iconBox.set_size(iconSize, iconSize);
      this._icon.set_icon_size(iconSize);
   }

   on_applet_clicked(event) {
      let useCountDown = this.settings.getValue("count-down");
      let immediate = (event.has_control_modifier() && useCountDown && this.settings.getValue("ctrl-override-countdown"));
      if( this._countDown ) {
         Mainloop.source_remove(this._countDown);
         this._labelNumberBox.hide();
         this._countDown = null;
      } else if( !immediate ){
         if( !this.settings.getValue("suspend-on-double-click") || event.get_click_count() === 2 ) {
            if( useCountDown ) {
               this.countDownTime = this.settings.getValue("count-down-duration");
               this._labelNumber.set_text( this.countDownTime.toString() );
               this._labelNumberBox.show();
               let [width, height] = this._labelNumber.get_size();
               let size = Math.max(width, height);
               this._labelNumberBin.width = size;
               this._labelNumberBin.height = size;
               this._countDown = Mainloop.timeout_add(1000, Lang.bind(this, this._countDownUpdate));
            } else {
               GLib.spawn_command_line_async('systemctl suspend -i');
            }
         }
      }
      if( immediate ){
         GLib.spawn_command_line_async('systemctl suspend -i');
      }
   }

   _countDownUpdate(){
      if( this.countDownTime > 1 ){
         this.countDownTime--;
         this._labelNumber.set_text( this.countDownTime.toString() );
         this._countDown = Mainloop.timeout_add(1000, Lang.bind(this, this._countDownUpdate));
      } else {
         this._labelNumberBox.hide();
         this._countDown = null;
         GLib.spawn_command_line_async('systemctl suspend -i');
      }
   }

   on_config_power_pressed() {
      GLib.spawn_command_line_async('cinnamon-settings power');
   }
}

function main(metadata, orientation, panelHeight, instanceId) {
   return new SuspendApplet(orientation, panelHeight, instanceId);
}
