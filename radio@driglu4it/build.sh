#!/bin/bash
# REQUIREMENTS:
# - typescript installed

# constants
# DIR of script
CINNAMON_VERSION=4.6
APPLET_NAME=radio@driglu4it # TODO: can be calculated automatically

CURRENT_DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
LOCAL_TESTING_DIR=$HOME/.local/share/cinnamon/applets/${APPLET_NAME}
BUILD_DIR=${CURRENT_DIR}/files/${APPLET_NAME}


#  TODO: delete all js files

# run typescript
cd $CURRENT_DIR/src/${CINNAMON_VERSION}
echo Building ${CINNAMON_VERSION} ... 
tsc -p tsconfig.json
 #when typescript succeeded. Must be directly behind the command
if [ $? -eq 0 ]; then 

  rm -r ${LOCAL_TESTING_DIR}
  cp -r ${BUILD_DIR} ${LOCAL_TESTING_DIR}

  # Restart cinnamon
  xdotool key ctrl+alt+0xff1b
fi

