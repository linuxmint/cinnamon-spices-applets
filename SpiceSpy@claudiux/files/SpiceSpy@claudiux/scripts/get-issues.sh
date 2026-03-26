#!/usr/bin/env bash
SPTYPE=$1
SPUUID=$2
PAGE="https://github.com/linuxmint/cinnamon-spices-${SPTYPE}/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+${SPUUID}";
TMP_FILE=$(mktemp -q /$XDG_RUNTIME_DIR/SpiceSpy.XXXXXX)
if [ $? -ne 0 ]; then
    echo "0"
    exit 1
fi
wget --no-cache -q -O $TMP_FILE $PAGE
sleep 0.5
ret=$(cat $TMP_FILE | grep -E -e "[0-9]+ Open" -m1 | awk '{print$1}')
rm -f $TMP_FILE
echo $ret
exit 0
