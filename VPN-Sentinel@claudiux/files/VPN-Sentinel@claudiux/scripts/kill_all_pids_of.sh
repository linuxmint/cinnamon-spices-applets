#!/bin/bash
PROGRAM=$(echo -n $(basename $1))
PROGRAM=${PROGRAM:0:15}
#sleep 1
THISPID="$$"

killall -q -s INT $PROGRAM
sleep 1

PIDS=$(for i in $(pgrep -d " " -i $PROGRAM);do echo -n "$i "; echo -n "$(pgrep -d " " -P $i) ";done | sed -r -e "s/\s+/ /g" | sort -n -r | uniq)
#echo "$PROGRAM: $PIDS"

for pid in $PIDS; do {
  starting=$(date +%s)
  while [[ -d "/proc/$pid" ]]; do {
    kill -s TERM $pid
    if (( ( $(date +%s) - starting ) < 7 )) # 7s max
    then
      sleep 2
    else
      kill -s KILL $pid
      break
    fi
  }; done
  [[ -d "/proc/$pid" ]] && echo "$PROGRAM: Unable to kill process $pid." && exit 1
}; done

kill -s KILL $THISPID
exit 0
