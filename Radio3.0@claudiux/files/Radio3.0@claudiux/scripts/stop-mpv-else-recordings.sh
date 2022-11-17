#!/bin/bash
MPV_PROCESS=$(ps x | grep mpvWatchTitle | grep scripts | echo -n `awk '{print $1}'`)

if [ "x${MPV_PROCESS}" != "x" ]; then {
  kill $MPV_PROCESS
}; fi

exit 0
