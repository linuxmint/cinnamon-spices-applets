#!/bin/bash

UUID="VPN-Sentinel@claudiux"
DOMAINS_FILE="$HOME/.cinnamon/configs/$UUID/domains2bypass.txt"
RESET_FILE="$HOME/.cinnamon/configs/$UUID/reset-bypass.sh"

[ -f ${DOMAINS_FILE} ] || exit 1

[ -x ${RESET_FILE} ] && ${RESET_FILE} && rm -f ${RESET_FILE}

domains=$(cat ${DOMAINS_FILE})

gatewayIP=$(echo -n $(ip route | grep default | awk '{print $3}'))
interface=$(echo -n $(nmcli -t -g TYPE,DEVICE,NAME connection show | grep -E "ethernet|wireless" | awk -F":" '{print $3}' | tr "\n" "|" | awk -F"|" '{print $1}'))

echo '#!/bin/bash' > ${RESET_FILE}

for d in $domains; do {
    #for anip in $(host -c IN $d | awk '{print $4}' | tr "\n" " "); do {
    for anip in $(dig +short $d | tr "\n" " "); do {
        if [ "$anip" != "alias" ] && [ "$anip" != "out" ]; then
           #echo $anip
           #ip route add $anip via $IP_ROUTEUR table specialvpn
           echo "nmcli connection mod \"$interface\" -ipv4.routes \"$anip $gatewayIP\"" >> ${RESET_FILE}
           nmcli connection mod "$interface" +ipv4.routes "$anip $gatewayIP"
        fi
    }; done
}; done

nmcli connection down "$interface"
sleep 5
nmcli connection up "$interface"

echo 'exit 0' >> ${RESET_FILE}
chmod +x ${RESET_FILE}

exit 0
