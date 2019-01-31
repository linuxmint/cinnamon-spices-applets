#!/bin/sh
USRFONTSDIR="$HOME/.local/share/fonts"
APPLETFONTSDIR="$HOME/.local/share/cinnamon/applets/SpicesUpdate@claudiux/fonts/Symbola"

INSTALLED=$(fc-list Symbola --format="%{family[0]}\n" | sort | uniq)

if [ -z $INSTALLED ]
then
  mkdir -p "${USRFONTSDIR}"
  cp "${APPLETFONTSDIR}/Symbola_Hinted.ttf" "${USRFONTSDIR}"
  fc-cache -f
fi

exit 0
