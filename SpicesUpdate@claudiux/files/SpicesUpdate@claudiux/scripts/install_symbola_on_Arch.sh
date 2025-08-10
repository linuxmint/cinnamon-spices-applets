#!/usr/bin/env bash
USRFONTSDIR="$HOME/.local/share/fonts"
APPLETFONTSDIR="$HOME/.local/share/cinnamon/applets/SpicesUpdate@claudiux/fonts/Symbola"
URLDOWNLOAD="https://raw.githubusercontent.com/claudiux/fonts/master/Symbola/Symbola.tar.gz"

INSTALLED=$(fc-list Symbola --format="%{family[0]}\n" | sort | uniq)

if [ -z $INSTALLED ]
then
  mkdir -p "${USRFONTSDIR}"
  cd "${APPLETFONTSDIR}"
  curl -s -o Symbola.tar.gz ${URLDOWNLOAD} && {
    tar xzf Symbola.tar.gz
    cp "Symbola.otf" "${USRFONTSDIR}"
    [[ -f /etc/gentoo-release ]] || {
      fc-cache -f
    }
    rm -f Symbola.tar.gz
  }
fi

if [ -f /etc/gentoo-release ]
then
  fc-cache -f
fi

exit 0
