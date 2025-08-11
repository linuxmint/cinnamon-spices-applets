#!/usr/bin/env bash

#~ sleepDurationSeconds=$1
sleepDurationSeconds=1

previousDate=$(date +%s%N | cut -b1-13)
previousStats=$(cat /proc/stat)

sleep $sleepDurationSeconds

currentDate=$(date +%s%N | cut -b1-13)

ret=""
retCPU=""

while IFS=' ' read -r cpu user nice system idle iowait irq softirq steal guest guest_nice rest
do {
    #~ [[ "$cpu" =~ ^cpu ]] || continue
    [[ "$cpu" =~ ^cpu ]] || break

    IFS=' ' read -r prevcpu prevuser prevnice prevsystem previdle previowait previrq prevsoftirq prevsteal prevguest prevguest_nice rest < <(echo "$previousStats" | grep "^$cpu ")

    PrevIdle=$((previdle + previowait))
    Idle=$((idle + iowait))

    PrevNonIdle=$((prevuser + prevnice + prevsystem + previrq + prevsoftirq + prevsteal))
    NonIdle=$((user + nice + system + irq + softirq + steal))

    PrevTotal=$((PrevIdle + PrevNonIdle))
    Total=$((Idle + NonIdle))

    totald=$((Total - PrevTotal))
    idled=$((Idle - PrevIdle))

    CPU_Percentage=$((100 * ($totald - $idled) / $totald))

    test "$retCPU" && retCPU="$retCPU $CPU_Percentage" || retCPU="$CPU_Percentage"
}; done < /proc/stat
ret=$ret" CPU:"$retCPU

echo -n "$ret"
exit 0
