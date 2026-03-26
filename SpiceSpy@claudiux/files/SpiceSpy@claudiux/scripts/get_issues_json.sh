#!/usr/bin/env bash
#
# Doc:
#   https://stackoverflow.com/questions/33374778/how-can-i-get-the-number-of-github-issues-using-the-github-api
#   https://docs.github.com/fr/rest/activity/events?apiVersion=2022-11-28
#   https://docs.github.com/fr/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2022-11-28#example-creating-a-pagination-method

DEST_DIR="$HOME/.config/cinnamon/spices/SpiceSpy@claudiux/issues"
[[ -d ${DEST_DIR} ]] || mkdir -p ${DEST_DIR}

for TYPE in applets desklets extensions themes actions; do {
        DEST_FILE="${DEST_DIR}/issues-${TYPE}.json"
        TMP_FILE="${DEST_DIR}/issues-${TYPE}_TMP.json"
        PAGE="https://api.github.com/repos/linuxmint/cinnamon-spices-${TYPE}/issues?state=open&per_page=1000"

        [[ -f  ${TMP_FILE} ]] && rm -f ${TMP_FILE}

        wget --no-cache -q -O "${TMP_FILE}" "${PAGE}"
        sleep 10
        #~ for i in 1 2 3; do {
                #~ TMP_FILE_I="${DEST_DIR}/issues-${TYPE}_TMP_${i}.json"
                #~ PAGE="https://api.github.com/repos/linuxmint/cinnamon-spices-${TYPE}/issues?state=open&per_page=100&page=${i}"
                #~ wget --no-cache -q -O "${TMP_FILE_I}" "${PAGE}"
                #~ sleep 6
        #~ }; done
        #~ cd ${DEST_DIR}
        #~ cat issues-${TYPE}_TMP_1.json issues-${TYPE}_TMP_2.json issues-${TYPE}_TMP_3.json issues-${TYPE}_TMP_4.json issues-${TYPE}_TMP_5.json issues-${TYPE}_TMP_6.json issues-${TYPE}_TMP_7.json issues-${TYPE}_TMP_8.json issues-${TYPE}_TMP_9.json > ${TMP_FILE}
        #~ cat issues-${TYPE}_TMP_1.json issues-${TYPE}_TMP_2.json issues-${TYPE}_TMP_3.json > ${TMP_FILE}
        #~ sleep 2

        [[ -f  ${DEST_FILE} ]] && rm -f ${DEST_FILE}

        [[ -f ${TMP_FILE} ]] && mv -f ${TMP_FILE} ${DEST_FILE}
        sleep 2
}; done

exit 0
