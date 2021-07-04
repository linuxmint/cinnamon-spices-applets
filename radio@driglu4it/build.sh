#!/bin/bash

CURRENT_DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
APPLET_NAME=$(basename $CURRENT_DIR)

FILES_DIR=${CURRENT_DIR}/files/${APPLET_NAME}
LOCAL_TESTING_DIR=$HOME/.local/share/cinnamon/applets/${APPLET_NAME}

npx webpack
# when webpack succeeded. Must be directly behind the command
if [ $? -eq 0 ]; then 

    rm -r ${LOCAL_TESTING_DIR} 
    cp -r ${FILES_DIR} ${LOCAL_TESTING_DIR}

    # # Restart cinnamon to adopt the changes
    xdotool key ctrl+alt+0xff1b
fi