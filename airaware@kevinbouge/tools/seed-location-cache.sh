#!/usr/bin/env bash
set -euo pipefail

APPLET_UUID="airaware@kevinbouge"
CACHE_HOME="${XDG_CACHE_HOME:-"$HOME/.cache"}"
CACHE_DIR="${CACHE_HOME}/${APPLET_UUID}"
CACHE_FILE="${CACHE_DIR}/coordinates.json"

usage() {
    printf 'Usage: %s LATITUDE LONGITUDE [ACCURACY_METERS]\n' "$(basename -- "$0")"
    printf 'Example: %s 50.0755 14.4378 10000\n' "$(basename -- "$0")"
}

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
    usage >&2
    exit 2
fi

LATITUDE="$1"
LONGITUDE="$2"
ACCURACY="${3:-10000}"

set +e
awk -v latitude="$LATITUDE" -v longitude="$LONGITUDE" -v accuracy="$ACCURACY" '
    function is_number(value) {
        return value ~ /^-?[0-9]+([.][0-9]+)?$/
    }
    BEGIN {
        if (!is_number(latitude) || latitude < -90 || latitude > 90)
            exit 1
        if (!is_number(longitude) || longitude < -180 || longitude > 180)
            exit 2
        if (!is_number(accuracy) || accuracy < 0)
            exit 3
    }
'
VALIDATION_STATUS="$?"
set -e

case "$VALIDATION_STATUS" in
    1)
        printf 'Invalid latitude: %s\n' "$LATITUDE" >&2
        exit 2
        ;;
    2)
        printf 'Invalid longitude: %s\n' "$LONGITUDE" >&2
        exit 2
        ;;
    3)
        printf 'Invalid accuracy: %s\n' "$ACCURACY" >&2
        exit 2
        ;;
esac

mkdir -p -- "$CACHE_DIR"
SAVED_AT="$(date +%s%3N)"

printf '{\n' > "$CACHE_FILE"
printf '  "version": 1,\n' >> "$CACHE_FILE"
printf '  "savedAt": %s,\n' "$SAVED_AT" >> "$CACHE_FILE"
printf '  "data": {\n' >> "$CACHE_FILE"
printf '    "latitude": %s,\n' "$LATITUDE" >> "$CACHE_FILE"
printf '    "longitude": %s,\n' "$LONGITUDE" >> "$CACHE_FILE"
printf '    "accuracy": %s\n' "$ACCURACY" >> "$CACHE_FILE"
printf '  }\n' >> "$CACHE_FILE"
printf '}\n' >> "$CACHE_FILE"

printf 'Seeded AirAware coordinate cache at %s\n' "$CACHE_FILE"
printf 'Refresh AirAware from the popup or restart Cinnamon.\n'
