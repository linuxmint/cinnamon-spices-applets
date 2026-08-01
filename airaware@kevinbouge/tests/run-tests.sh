#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
APPLET_DIR="${ROOT_DIR}/files/airaware@kevinbouge"

cd "$APPLET_DIR"

jq empty metadata.json settings-schema.json
jq -e '
    (.uuid | type == "string" and length > 0) and
    (.name | type == "string" and length > 0) and
    (.description | type == "string" and length > 0) and
    (.version | type == "string" and length > 0) and
    (.author | type == "string" and length > 0) and
    (.["max-instances"] | type == "number") and
    ((has("website") | not) or (.website | type == "string" and length > 0))
' metadata.json >/dev/null
if ! msgfmt --check --output-file=/tmp/airaware-template.mo po/airaware@kevinbouge.pot 2>/tmp/airaware-msgfmt.log; then
    cat /tmp/airaware-msgfmt.log >&2
    exit 1
fi

gjs "${ROOT_DIR}/tests/riskCalculator.test.js"
gjs "${ROOT_DIR}/tests/personalAllergyProfile.test.js"
gjs "${ROOT_DIR}/tests/personalizedRiskCalculator.test.js"
gjs "${ROOT_DIR}/tests/formatter.test.js"
gjs "${ROOT_DIR}/tests/openMeteoProvider.test.js"
gjs "${ROOT_DIR}/tests/openMeteoWeatherProvider.test.js"
gjs "${ROOT_DIR}/tests/openStreetMapVegetationProvider.test.js"
gjs "${ROOT_DIR}/tests/moldPotentialCalculator.test.js"
gjs "${ROOT_DIR}/tests/environmentAssembler.test.js"
gjs "${ROOT_DIR}/tests/reverseGeocoder.test.js"
gjs "${ROOT_DIR}/tests/cache.test.js"
gjs "${ROOT_DIR}/tests/locationService.test.js"
gjs "${ROOT_DIR}/tests/notificationPolicy.test.js"

printf '%s\n' 'AirAware test suite passed'
