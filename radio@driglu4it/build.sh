#!/bin/bash

# REQUIREMENTS:
# - typescript installed

# constants
# DIR of script
CINNAMON_VERSION=4.6
APPLET_NAME=radio@driglu4it # TODO: can be calculated automatically

CURRENT_DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
LOCAL_TESTING_DIR=$HOME/.local/share/cinnamon/applets/${APPLET_NAME}/${CINNAMON_VERSION}
BUILD_DIR=${CURRENT_DIR}/files/${APPLET_NAME}/${CINNAMON_VERSION}

# delete all js files from the Build dir. This ensures that the directory 
# doesn't contain useless files created in the past from now deleted typescript files
# TODO: remove empty dirs
find ${BUILD_DIR} -name "*.js" -type f -delete

# run typescript
echo Building ${CINNAMON_VERSION} ... 
tsc -p tsconfig.json
# when typescript succeeded. Must be directly behind the command
if [ $? -eq 0 ]; then 

  rm -r ${LOCAL_TESTING_DIR}
  cp -r ${BUILD_DIR} ${LOCAL_TESTING_DIR}

  # Restart cinnamon to adopt the changes
  xdotool key ctrl+alt+0xff1b
fi
