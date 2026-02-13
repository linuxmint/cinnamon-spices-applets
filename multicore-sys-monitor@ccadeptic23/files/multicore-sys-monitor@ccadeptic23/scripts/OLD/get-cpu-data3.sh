#!/usr/bin/env bash

#~ sleepDurationSeconds=$1
sleepDurationSeconds=1

declare -A prevstat

while IFS=' ' read -r cpu rest
do
    [[ "$cpu" =~ ^cpu ]] && prevstat["$cpu"]="$rest"
done < /proc/stat

sleep $sleepDurationSeconds

ret=""

while IFS=' ' read -r cpu user nice system idle iowait irq softirq steal guest guest_nice rest
do
    [[ "$cpu" =~ ^cpu ]] || break

    IFS=' ' read -r prevuser prevnice prevsystem previdle previowait previrq prevsoftirq prevsteal prevguest prevguest_nice rest <<< ${prevstat["$cpu"]}

    PrevIdle=$((previdle + previowait))
    Idle=$((idle + iowait))

    PrevNonIdle=$((prevuser + prevnice + prevsystem + previrq + prevsoftirq + prevsteal))
    NonIdle=$((user + nice + system + irq + softirq + steal))

    PrevTotal=$((PrevIdle + PrevNonIdle))
    Total=$((Idle + NonIdle))

    totald=$((Total - PrevTotal))
    idled=$((Idle - PrevIdle))

    CPU_Percentage=$((100 * ($totald - $idled) / $totald))

    #~ [[ "$cpu" = "cpu" ]] && {
        #~ echo "total "$CPU_Percentage
    #~ } || {
        #~ echo $cpu" "$CPU_Percentage
    #~ }
    test "$ret" && ret="$ret $CPU_Percentage" || ret="$CPU_Percentage"
    #~ echo $cpu" "$CPU_Percentage
done < /proc/stat

echo -n "$ret"
exit 0
