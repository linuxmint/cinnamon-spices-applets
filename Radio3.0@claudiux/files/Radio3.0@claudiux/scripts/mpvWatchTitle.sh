#!/usr/bin/sh
SOCKET="${XDG_RUNTIME_DIR}/mpvradiosocket"

RESULT=$(echo '{ "command": ["get_property", "media-title"] }' | socat - $SOCKET | jq ".data")

echo -n $RESULT

exit 0
