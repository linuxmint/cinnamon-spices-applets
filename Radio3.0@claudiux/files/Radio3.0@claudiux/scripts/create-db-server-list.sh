#!/bin/bash
UUID="Radio3.0@claudiux"
RCONFIGDIR="$HOME/.cinnamon/configs/$UUID"
DBSERVERJSON="$RCONFIGDIR/server-list.json"

# To avoid the risk of obtaining a truncated file because of a process
# that is sometimes too long, we create a temporary file that we rename
# once it is ready.
DBSERVERJSONTMP="${DBSERVERJSON}.temp"
mkdir -p $RCONFIGDIR && touch "${DBSERVERJSONTMP}" && rm -f "${DBSERVERJSONTMP}"

echo "[" > "${DBSERVERJSONTMP}"

servers=("api.radiodb.fr" $(echo -n $(host -t SRV _api._tcp.radio-browser.info | awk '{print $8}' | sed -e "s/\.$//")))

i=0
#echo ${#servers[*]} # Returns the number of servers.
for server in ${servers[*]}; do {
  i=$((i=i+1))
  echo "    {" >> "${DBSERVERJSONTMP}"
  echo "        \"server\": \"https://$server\"" >> "${DBSERVERJSONTMP}"
  if [ $i -lt ${#servers[*]} ]; then {
    echo "    }," >> "${DBSERVERJSONTMP}"
  }; else {
    echo "    }" >> "${DBSERVERJSONTMP}"
  }; fi
};done

echo -n "]" >> "${DBSERVERJSONTMP}"
touch "${DBSERVERJSONTMP}"

mv -f "${DBSERVERJSONTMP}" "${DBSERVERJSON}"
exit 0
