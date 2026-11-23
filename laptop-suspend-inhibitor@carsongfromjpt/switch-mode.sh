#!/bin/bash

if [[ "$(gsettings get org.cinnamon.settings-daemon.plugins.power lid-close-battery-action)" == "'suspend'" ]]
then
    action="blank"
else
    action="suspend"
fi
gsettings set org.cinnamon.settings-daemon.plugins.power lid-close-ac-action "$action"
gsettings set org.cinnamon.settings-daemon.plugins.power lid-close-battery-action "$action"

