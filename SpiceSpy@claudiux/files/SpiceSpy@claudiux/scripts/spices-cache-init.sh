#!/usr/bin/env bash
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
cd $SCRIPTPATH/..
UUID="$(basename $PWD)"
cd $SCRIPTPATH

for type in action applet desklet extension theme; do {
        [[ -d ${HOME}/.cache/cinnamon/spices/${type} ]] || {
                mkdir -p ${HOME}/.cache/cinnamon/spices/${type}
                sleep 0.5
        }
        [[ -f ${HOME}/.cache/cinnamon/spices/${type}/index.json ]] || {
                echo "{}" > ${HOME}/.cache/cinnamon/spices/${type}/index.json
                sleep 0.5
        }
}; done

#~ ${HOME}/.local/share/cinnamon/applets/${UUID}/scripts/spices-cache-updater.py --update-all
${HOME}/.local/share/cinnamon/applets/${UUID}/scripts/spices-cache-updater.py

exit 0
