#!/usr/bin/python3
import sys
import dbus
bus = dbus.SessionBus()

display_config_well_known_name = "org.cinnamon.Muffin.DisplayConfig"
display_config_object_path = "/org/cinnamon/Muffin/DisplayConfig"

display_config_proxy = bus.get_object(display_config_well_known_name, display_config_object_path)
display_config_interface = dbus.Interface(display_config_proxy, dbus_interface=display_config_well_known_name)

serial, physical_monitors, logical_monitors, properties = display_config_interface.GetCurrentState()

new_scale = 2.0;

if len(sys.argv) > 1:
    new_scale = float(sys.argv[1])
else:
    for x, y, scale, transform, primary, linked_monitors_info, props in logical_monitors:
        if primary == 1:
            new_scale = 2.0 if (scale == 1.0) else 1.0 # toggle scaling for all screens between 1.0 and 2.0 of the primary monitor
            break;

updated_logical_monitors=[]
for x, y, scale, transform, primary, linked_monitors_info, props in logical_monitors:
    physical_monitors_config = []
    for linked_monitor_connector, linked_monitor_vendor, linked_monitor_product, linked_monitor_serial in linked_monitors_info:
        for monitor_info, monitor_modes, monitor_properties in physical_monitors:
            monitor_connector, monitor_vendor, monitor_product, monitor_serial = monitor_info
            if linked_monitor_connector == monitor_connector:
                for mode_id, mode_width, mode_height, mode_refresh, mode_preferred_scale, mode_supported_scales, mode_properties in monitor_modes:
                    if mode_properties.get("is-current", False): # ( mode_properties provides is-current, is-preferred, is-interlaced, and more)
                        physical_monitors_config.append(dbus.Struct([monitor_connector, mode_id, {}]))
                        if new_scale not in mode_supported_scales:
                            print("Error: " + monitor_properties.get("display-name") + " doesn't support that scaling value! (" + str(scale) + ")")
                        else:
                            print("Setting scaling of: " + monitor_properties.get("display-name") + " to " + str(new_scale) + "!")
    updated_logical_monitor_struct = dbus.Struct([dbus.Int32(x), dbus.Int32(y), dbus.Double(new_scale), dbus.UInt32(transform), dbus.Boolean(primary), physical_monitors_config])
    updated_logical_monitors.append(updated_logical_monitor_struct)

properties_to_apply = { "layout_mode": properties.get("layout-mode")}
method = 1 # 2 means show a prompt before applying settings; 1 means instantly apply settings without prompt
display_config_interface.ApplyMonitorsConfig(dbus.UInt32(serial), dbus.UInt32(method), updated_logical_monitors, properties_to_apply)
