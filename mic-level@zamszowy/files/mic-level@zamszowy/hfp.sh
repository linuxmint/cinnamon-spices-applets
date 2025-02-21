#!/bin/bash

set -eu

present=true
for profile in $(pw-dump | jq --raw-output '.[].info.props | ."api.bluez5.profile" | select (.!=null)'); do
    if [[ $profile != "headset-head-unit" ]]; then
        present=false
        break
    fi
done

$present && echo "present" || echo "absent"
