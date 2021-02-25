FILENAME="youtube-dl_2021.02.04.1-1_all.deb"
DOWNLOAD_LINK=http://ftp.de.debian.org/debian/pool/main/y/youtube-dl/${FILENAME}

TEMP_DIR=$(mktemp -d)
FILEPATH=${TEMP_DIR}/${FILENAME}

wget -O ${FILEPATH} ${DOWNLOAD_LINK}
xdg-open ${FILEPATH}
