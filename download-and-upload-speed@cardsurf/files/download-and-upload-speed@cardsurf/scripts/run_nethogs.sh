#!/bin/bash

# Read applet settings
filepath="$HOME/.cinnamon/configs/download-and-upload-speed@cardsurf/download-and-upload-speed@cardsurf.json"
settings=$(cat $filepath)

# Get name of current network interface
setting=$(echo $settings | gawk '{match($0, "\"network_interface\":.*", matches); print matches[0]}') # Get substring that starts with "network_interface":
pair=$(echo $setting | gawk '{match($0, "\"value\":.*", matches); print matches[0]}')                 # Get substring that starts with "value":
name=$(echo $pair | gawk '{split($0, substrings, "\""); print substrings[4]}' )                       # Get 2nd substring surrounded by "

# Run NetHogs
sudo nethogs $name
