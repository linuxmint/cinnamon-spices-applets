//!/usr/bin/cjs
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const display_config_well_known_name = "org.cinnamon.Muffin.DisplayConfig"
const display_config_object_path = "/org/cinnamon/Muffin/DisplayConfig"

// xml structure from: 
// https://sources.debian.org/src/muffin/5.6.4-1/src/org.cinnamon.Muffin.DisplayConfig.xml/
// or the command:
// gdbus introspect --session --dest org.cinnamon.Muffin.DisplayConfig --object-path /org/cinnamon/Muffin/DisplayConfig
const DisplayConfigInterface = '\
<node> \
    <interface name="org.cinnamon.Muffin.DisplayConfig"> \
        <method name="GetResources"> \
          <arg name="serial" direction="out" type="u" /> \
          <arg name="crtcs" direction="out" type="a(uxiiiiiuaua{sv})" /> \
          <arg name="outputs" direction="out" type="a(uxiausauaua{sv})" /> \
          <arg name="modes" direction="out" type="a(uxuudu)" /> \
          <arg name="max_screen_width" direction="out" type="i" /> \
          <arg name="max_screen_height" direction="out" type="i" /> \
        </method> \
        <method name="ApplyConfiguration"> \
          <arg name="serial" direction="in" type="u" /> \
          <arg name="persistent" direction="in" type="b" /> \
          <arg name="crtcs" direction="in" type="a(uiiiuaua{sv})" /> \
          <arg name="outputs" direction="in" type="a(ua{sv})" /> \
        </method> \
         <method name="ChangeBacklight"> \
          <arg name="serial" direction="in" type="u" /> \
          <arg name="output" direction="in" type="u" /> \
          <arg name="value" direction="in" type="i" /> \
          <arg name="new_value" direction="out" type="i" /> \
        </method> \
        <method name="GetCrtcGamma"> \
          <arg name="serial" direction="in" type="u" /> \
          <arg name="crtc" direction="in" type="u" /> \
          <arg name="red" direction="out" type="aq" /> \
          <arg name="green" direction="out" type="aq" /> \
          <arg name="blue" direction="out" type="aq" /> \
        </method> \
        <method name="SetCrtcGamma"> \
          <arg name="serial" direction="in" type="u" /> \
          <arg name="crtc" direction="in" type="u" /> \
          <arg name="red" direction="in" type="aq" /> \
          <arg name="green" direction="in" type="aq" /> \
          <arg name="blue" direction="in" type="aq" /> \
        </method> \
        <method name="GetCurrentState"> \
          <arg name="serial" direction="out" type="u" /> \
          <arg name="monitors" direction="out" type="a((ssss)a(siiddada{sv})a{sv})" /> \
          <arg name="logical_monitors" direction="out" type="a(iiduba(ssss)a{sv})" /> \
          <arg name="properties" direction="out" type="a{sv}" /> \
        </method> \
        <method name="ApplyMonitorsConfig"> \
          <arg name="serial" direction="in" type="u" /> \
          <arg name="method" direction="in" type="u" /> \
          <arg name="logical_monitors" direction="in" type="a(iiduba(ssa{sv}))" /> \
          <arg name="properties" direction="in" type="a{sv}" /> \
        </method> \
        <property name="PowerSaveMode" type="i" access="readwrite" /> \
        <signal name="MonitorsChanged" /> \
    </interface> \
</node>';

var DisplayConfigProxy = Gio.DBusProxy.makeProxyWrapper(DisplayConfigInterface);
function DisplayConfig(initCallback, cancellable) {
    return new DisplayConfigProxy(Gio.DBus.session, display_config_well_known_name, display_config_object_path, initCallback, cancellable);
}

function getRealScale() {
    var _displayProxy = null;
    var display_config_interface = DisplayConfig((obj, err) => {
        _displayProxy = obj; 
    }, null);
    let [serial, physical_monitors, logical_monitors, properties] = display_config_interface.GetCurrentState();
    for (let log_mon of logical_monitors) {
        let [x, y, scale, transform, primary, linked_monitors_info, props] = log_mon;
        for (let phys_mon of physical_monitors) {
            let [monitor_info, monitor_modes, monitor_properties] = phys_mon;
            let [monitor_connector, monitor_vendor, monitor_product, monitor_serial] = monitor_info;
            if (linked_monitor_connector == monitor_connector) {
                for (let monitor_mode of monitor_modes) {
                    let [mode_id, mode_width, mode_height, mode_refresh, mode_preferred_scale, mode_supported_scales, mode_properties] = monitor_mode;
                    if (mode_properties.get("is-current", False)) {
                        return scale;
                    }
                }
            }
        }
    }
}

module.exports = {
    getRealScale
}
