#!/bin/bash

SCRIPT_PATH="$( cd "$(dirname "$0")" ; pwd -P )"
SOURCE_URL=https://picsum.photos/2560/1440
LOCAL_FILENAME=background

wget -q -O "$SCRIPT_PATH/$LOCAL_FILENAME" $SOURCE_URL
gsettings set org.cinnamon.desktop.background picture-uri "file://$SCRIPT_PATH/$LOCAL_FILENAME"
