#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Source:
# https://askubuntu.com/questions/878556/get-battery-status-to-update-more-often-or-on-ac-power-wake

import dbus
import os
import sys
import time

def run_dbus_method(bus_type, obj, path, interface, method, arg):
    if bus_type == "session":
        bus = dbus.SessionBus()
    elif bus_type == "system":
        bus = dbus.SystemBus()
    else:
        return None

    proxy = bus.get_object(obj, path)
    dbus_method = proxy.get_dbus_method(method, interface)

    return dbus_method(arg) if arg else dbus_method()

def find_battery_path():
    call = [ 'system', 'org.freedesktop.UPower', 
             '/org/freedesktop/UPower', 'org.freedesktop.UPower',
             'EnumerateDevices', None ]
    devices = run_dbus_method(*call)
    for i in devices:
        if 'BAT' in i: return str(i)

def main():
    bat_path = find_battery_path()
    call = [ 'system', 'org.freedesktop.UPower',
             bat_path, 'org.freedesktop.UPower.Device',
             'Refresh', None ]

    run_dbus_method(*call)
    # Call upower, parse the output and write the energy rate without context to a file
    # The energy rate uses a "," as decimal separator for certain locales which needs to be replaced for parsing.
    os.system("upower -i $(upower -e | grep BAT) | grep energy-rate | grep -Eo '[0-9]+([,|.][0-9]+)?' | sed 's/,/./' > .energyrate")
    os.system("upower -i $(upower -e | grep BAT) | grep state | rev | cut -d ' ' -f 1 | rev > .batterystate")

if __name__ == '__main__': main()