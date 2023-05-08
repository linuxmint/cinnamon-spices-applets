#!/bin/bash
[ $# -eq 1 ] || exit 1

PID=$1
IN=/proc/${PID}/fd/1
OUT=${XDG_RUNTIME_DIR}/radio3_progress_$PID
touch $OUT

if [[ ! -r $IN ]]; then {
  #~ echo "$IN doesn't exist!"
  exit 2
};fi

#~ echo "$IN exists and is readable.";
while read -r line
do {
  if [[ "$line" == "[download]"* ]]; then {
    progress=$(echo $line | awk -F ' ' '{print $2} " " {print $8}')
    echo -n ${progress}  > ${OUT}
    #~ echo -n $(echo $line | awk -F ' ' '{print $2} " " {print $8}') > ${OUT}
  }; fi
};done < $IN

exit 0
