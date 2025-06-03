const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
//~ const GWeather = imports.gi.GWeather;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
//~ const CinnamonDesktop = imports.gi.CinnamonDesktop;
//~ const RROutput = CinnamonDesktop.RROutput;

//~ const Interfaces = imports.misc.interfaces;
//~ const Lang = imports.lang;
//~ const Tooltips = imports.ui.tooltips;

//~ const BrightnessBusName = "org.cinnamon.SettingsDaemon.Power.Screen";

const UUID = "NightLightSwitch@claudiux";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
  return Gettext.dgettext(UUID, text);
}


//~ class BrightnessSlider extends PopupMenu.PopupSliderMenuItem {
    //~ constructor(applet, label, icon, busName, minimum_value) {
        //~ super(0);
        //~ this.actor.hide();

        //~ this._applet = applet;
        //~ this._seeking = false;
        //~ this._minimum_value = minimum_value;
        //~ this._step = .05;

        //~ this.connect("drag-begin", Lang.bind(this, function () {
            //~ this._seeking = true;
        //~ }));
        //~ this.connect("drag-end", Lang.bind(this, function () {
            //~ this._seeking = false;
        //~ }));

        //~ this.icon = new St.Icon({ icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
        //~ this.removeActor(this._slider);
        //~ this.addActor(this.icon, { span: 0 });
        //~ this.addActor(this._slider, { span: -1, expand: true });

        //~ this.label = label;
        //~ this.tooltipText = label;
        //~ this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        //~ Interfaces.getDBusProxyAsync(busName, Lang.bind(this, function (proxy, error) {
            //~ this._proxy = proxy;
            //~ this._proxy.GetPercentageRemote(Lang.bind(this, this._dbusAcquired));
        //~ }));
    //~ }

    //~ _dbusAcquired(b, error) {
        //~ if (error) {
          //~ global.log("_dbusAcquired - error:"+error);
          //~ return;
        //~ }

        //~ try {
            //~ this._proxy.GetStepRemote((step, error) => {
                //~ if (error != null) {
                    //~ if (error.code != CSD_BACKLIGHT_NOT_SUPPORTED_CODE) {
                        //~ global.logError(`Could not get backlight step for ${busName}: ${error.message}`);
                        //~ return;
                    //~ } else {
                        //~ this._step = .05;
                    //~ }
                //~ }
                //~ this._step = (step / 100);
            //~ });
        //~ } catch (e) {
            //~ this._step = .05;
        //~ }

        //~ this._updateBrightnessLabel(b);
        //~ this.setValue(b / 100);
        //~ this.connect("value-changed", Lang.bind(this, this._sliderChanged));

        //~ this.actor.show();

        //~ //get notified
        //~ this._proxy.connectSignal('Changed', Lang.bind(this, this._getBrightness));
        //~ this._applet.menu.connect("open-state-changed", Lang.bind(this, this._getBrightnessForcedUpdate));
    //~ }

    //~ _sliderChanged(slider, value) {
        //~ if (value < this._minimum_value) {
            //~ value = this._minimum_value;
        //~ }

        //~ let i = this._minimum_value;
        //~ let v = value;
        //~ let step = this._step;

        //~ while (i < 1.0) {
            //~ if (v > (i + step)) {
                //~ i = i + step;
                //~ continue;
            //~ }

            //~ if (((i + step) - v) < (v - i)) {
                //~ v = i + step;
            //~ } else {
                //~ v = i;
            //~ }

            //~ break;
        //~ }

        //~ this.setValue(v);

        //~ // A non-zero minimum brightness can cause our stepped value
        //~ // to exceed 100, making the slider jitter (because c-s-d rejects
        //~ // the value)
        //~ this._setBrightness(Math.min(100, Math.round(v * 100)));
    //~ }

    //~ _getBrightness() {
        //~ //This func is called when dbus signal is received.
        //~ //Only update items value when slider is not used
        //~ if (!this._seeking)
            //~ this._getBrightnessForcedUpdate();
    //~ }

    //~ _getBrightnessForcedUpdate() {
        //~ this._proxy.GetPercentageRemote(Lang.bind(this, function (b) {
            //~ this._updateBrightnessLabel(b);
            //~ this.setValue(b / 100);
        //~ }));
    //~ }

    //~ _setBrightness(value) {
        //~ this._proxy.SetPercentageRemote(value, Lang.bind(this, function (b) {
            //~ this._updateBrightnessLabel(b);
        //~ }));
    //~ }

    //~ _updateBrightnessLabel(value) {
        //~ this.tooltipText = this.label;
        //~ if (value)
            //~ this.tooltipText += ": " + value + "%";

        //~ this.tooltip.set_text(this.tooltipText);
        //~ if (this._dragging)
            //~ this.tooltip.show();
    //~ }

    //~ /* Overriding PopupSliderMenuItem so we can modify the scroll step */
    //~ _onScrollEvent(actor, event) {
        //~ let direction = event.get_scroll_direction();

        //~ if (direction == Clutter.ScrollDirection.DOWN) {
            //~ this._proxy.StepDownRemote(function () { });
        //~ }
        //~ else if (direction == Clutter.ScrollDirection.UP) {
            //~ this._proxy.StepUpRemote(function () { });
        //~ }

        //~ this._slider.queue_repaint();
    //~ }
//~ }

const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const ICONS_DIR = APPLET_DIR + "/icons";
const Gtk = imports.gi.Gtk;
Gtk.IconTheme.get_default().append_search_path(ICONS_DIR);

class NightLightSwitch extends Applet.IconApplet {
  constructor(metadata, orientation, panelHeight, instance_id) {
    super(orientation, panelHeight, instance_id);

    this.gsettings = Gio.Settings.new("org.cinnamon.settings-daemon.plugins.color");
    this.nightLightEnabled = this.gsettings.get_boolean("night-light-enabled");
    this.connectColorID = this.gsettings.connect("changed", () => this.set_icon());
    this.set_icon();
    let [lat, lon] = this.gsettings.get_value("night-light-last-coordinates").unpack(); // type (dd)
    lat = lat.unpack(); // type (d)
    lon = lon.unpack(); // type (d)
    //~ global.log("lat: "+lat+" - lon: "+lon);

    //~ if (Math.round(lat) == 91 || Math.round(lon) == 181) {
      //~ this.sunrise = 6;
      //~ this.sunset = 12;
    //~ } else {
      //~ this.weather = GWeather.Info.new(GWeather.Location.new_detached("local", null, lat, lon));
      //~ let sunrise = this.weather.get_sunrise().trim().split(":");
      //~ let sunset = this.weather.get_sunset().trim().split(":");
      //~ //global.log("sunrise: " + sunrise);
      //~ //global.log("sunset: " + sunset);
      //~ this.sunrise = parseInt(sunrise[0][0])*10+parseInt(sunrise[0][1])+(parseInt(sunrise[0][3])*10+parseInt(sunrise[0][4]))/60;
      //~ this.sunset = parseInt(sunset[0][0])*10+parseInt(sunset[0][1])+(parseInt(sunset[0][3])*10+parseInt(sunset[0][4]))/60;
    //~ }
    //~ this.sunrise = Math.round(this.sunrise * 4)/4;
    //~ this.sunset = Math.round(this.sunset * 4)/4;
    //~ //global.log("sunrise: " + this.sunrise + " - sunset: " + this.sunset);

    let items = this._applet_context_menu._getMenuItems();
    if (this.context_menu_item_configure == null) {
      this.context_menu_item_configure = new PopupMenu.PopupIconMenuItem(_("Configure..."),
        "system-run",
        St.IconType.SYMBOLIC);
      this.context_menu_item_configure.connect('activate',
        () => { Util.spawnCommandLineAsync("cinnamon-settings nightlight"); }
      );
    }
    if (items.indexOf(this.context_menu_item_configure) == -1) {
      this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
    }

    //~ if (this.context_menu_item_brightness == null) {
      //~ this.context_menu_item_brightness = new BrightnessSlider(this, _("Brightness"), "display-brightness", BrightnessBusName, 0);
    //~ }
    //~ if (items.indexOf(this.context_menu_item_brightness) == -1) {
      //~ this._applet_context_menu.addMenuItem(this.context_menu_item_brightness);
    //~ }
  }

  on_applet_clicked() {
    this.gsettings.set_boolean("night-light-enabled", !this.nightLightEnabled);
    this.set_icon();
  }

  set_icon() {
    this.nightLightEnabled = this.gsettings.get_boolean("night-light-enabled");
    if (this.nightLightEnabled) {
      this.set_applet_icon_symbolic_name("nightlight-symbolic");
      this.set_applet_tooltip(_("Night Light Enabled - Click to Disable"));
    } else {
      this.set_applet_icon_symbolic_name("nightlight-disabled-symbolic");
      this.set_applet_tooltip(_("Night Light Disabled - Click to Enable"));
    }
  }

  on_applet_added_to_panel() {
      //~ global.log("get_backlight(): "+CinnamonDesktop.RROutput.get_backlight());
      //~ global.log("get_id(): "+CinnamonDesktop.RROutput.get_id());
  }

  on_applet_removed_from_panel() {
    this.gsettings.disconnect(this.connectColorID);
  }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new NightLightSwitch(metadata, orientation, panel_height, instance_id);
}
