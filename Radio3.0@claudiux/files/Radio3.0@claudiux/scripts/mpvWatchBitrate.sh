#!/usr/bin/sh
SOCKET="${XDG_RUNTIME_DIR}/mpvradiosocket"

RESULT=$(echo '{ "command": ["get_property", "audio-bitrate"] }' | socat - $SOCKET | jq ".data")

echo -n $RESULT

exit 0
