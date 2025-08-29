#!/usr/bin/env bash
ret=""
while IFS=' ' read -r cpu user nice system idle iowait irq softirq steal guest guest_nice rest
do
    [[ "$cpu" =~ ^cpu ]] || break
    Idle=$((idle + iowait))
    NonIdle=$((user + nice + system + irq + softirq + steal))
    Total=$((Idle + NonIdle))
    CPU_Total_Idle="$Total,$Idle"
    #~ test "$ret" && ret="$ret $CPU_Total_Idle" || ret="$CPU_Total_Idle"
    ret="$ret $CPU_Total_Idle"
done < /proc/stat
echo -n "$ret"
exit 0
