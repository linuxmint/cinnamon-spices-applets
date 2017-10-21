#!/bin/sh
if pgrep "vlc" > /dev/null

then

killall -9 vlc &
killall rtmpdump &
sleep 2

rtmpdump -r "rtmp://31.13.217.76/rtplive" -W "http://www.thevoice.bg/js/thevoice_videostreem.swf" -p "http://www.thevoice.bg/" -y "thevoice_live.stream" -b "0" | vlc --meta-title "The Voice" - &

notify-send -t 5000 -i "multimedia-video-player" "The Voice " "The Voice ще стартира след скунди.\n\n Приятно гледане!" &

else 

rtmpdump -r "rtmp://31.13.217.76/rtplive" -W "http://www.thevoice.bg/js/thevoice_videostreem.swf" -p "http://www.thevoice.bg/" -y "thevoice_live.stream" -b "0" |vlc --meta-title "The Voice" - &

notify-send -t 5000 -i "multimedia-video-player" "The Voice " "The Voice ще стартира след скунди.\n\n Приятно гледане!" &

fi

exit 0
