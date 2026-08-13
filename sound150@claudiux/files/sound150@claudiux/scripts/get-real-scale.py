#!/usr/bin/env python3
# -*- coding:Utf-8 -*-

# Author : Claude CLERC <claude.clerc@gmail.com>
import sys
import dbus
bus = dbus.SessionBus()

display_config_well_known_name = "org.cinnamon.Muffin.DisplayConfig"
display_config_object_path = "/org/cinnamon/Muffin/DisplayConfig"

display_config_proxy = bus.get_object(display_config_well_known_name, display_config_object_path)
display_config_interface = dbus.Interface(display_config_proxy, dbus_interface=display_config_well_known_name)

serial, physical_monitors, logical_monitors, properties = display_config_interface.GetCurrentState()


for x, y, scale, transform, primary, linked_monitors_info, props in logical_monitors:
    # ~ physical_monitors_config = []
    for linked_monitor_connector, linked_monitor_vendor, linked_monitor_product, linked_monitor_serial in linked_monitors_info:
        for monitor_info, monitor_modes, monitor_properties in physical_monitors:
            monitor_connector, monitor_vendor, monitor_product, monitor_serial = monitor_info
            if linked_monitor_connector == monitor_connector:
                for mode_id, mode_width, mode_height, mode_refresh, mode_preferred_scale, mode_supported_scales, mode_properties in monitor_modes:
                    if mode_properties.get("is-current", False): # ( mode_properties provides is-current, is-preferred, is-interlaced, and more)
                        # ~ physical_monitors_config.append(dbus.Struct([monitor_connector, mode_id, {}]))
                        # ~ print(monitor_properties.get("display-name"))
                        print(scale, end="")
