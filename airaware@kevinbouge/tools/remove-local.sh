#!/usr/bin/env bash
set -euo pipefail

APPLET_UUID="airaware@kevinbouge"
DATA_HOME="${XDG_DATA_HOME:-"$HOME/.local/share"}"
CACHE_HOME="${XDG_CACHE_HOME:-"$HOME/.cache"}"
DESTINATION="${DATA_HOME}/cinnamon/applets/${APPLET_UUID}"
CACHE_DIR="${CACHE_HOME}/${APPLET_UUID}"
REMOVE_CACHE=false

usage() {
    printf 'Usage: %s [--cache]\n' "$(basename -- "$0")"
    printf '  --cache  Also remove cached AirAware coordinates, place names, and responses.\n'
}

for arg in "$@"; do
    case "$arg" in
        --cache|--all)
            REMOVE_CACHE=true
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            exit 2
            ;;
    esac
done

if [ -d "$DESTINATION" ]; then
    rm -rf -- "$DESTINATION"
    printf 'Removed installed applet from %s\n' "$DESTINATION"
else
    printf 'No installed applet found at %s\n' "$DESTINATION"
fi

if [ "$REMOVE_CACHE" = true ]; then
    if [ -d "$CACHE_DIR" ]; then
        rm -rf -- "$CACHE_DIR"
        printf 'Removed cache from %s\n' "$CACHE_DIR"
    else
        printf 'No cache found at %s\n' "$CACHE_DIR"
    fi
fi

printf 'Restart Cinnamon to fully unload any running AirAware instance.\n'
