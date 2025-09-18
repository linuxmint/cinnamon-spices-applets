#!/usr/bin/env bash
UUID="SpiceSpy@claudiux"
for type in action applet desklet extension theme; do {
        [[ -d ${HOME}/.cache/cinnamon/spices/${type} ]] || {
                mkdir -p ${HOME}/.cache/cinnamon/spices/${type}
        }
        [[ -f ${HOME}/.cache/cinnamon/spices/${type}/index.json ]] || {
                echo "{}" > ${HOME}/.cache/cinnamon/spices/${type}/index.json
        }
}; done

sleep 1

#~ ${HOME}/.local/share/cinnamon/applets/${UUID}/scripts/spices-cache-updater.py --update-all
${HOME}/.local/share/cinnamon/applets/${UUID}/scripts/spices-cache-updater.py

exit 0
