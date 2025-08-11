#!/usr/bin/env bash
result=$(dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.CanShutdown | grep boolean | awk '{print $2}')

[[ "$result" == "true" ]] && exit 0;

exit 1
